from typing import Dict

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError


def get_db(CyberDB):
    """Get CyberDB instance"""
    if CyberDB is None:
        return None
    return CyberDB.from_default_config()


def format_validation_error(error, entity=None):
    """Format validation errors for consistent API responses"""
    if isinstance(error, DjangoValidationError):
        if hasattr(error, "error_dict"):
            # Field-specific validation errors
            return {
                "error": "Validation failed",
                "field_errors": {
                    field: [str(err) for err in errors]
                    for field, errors in error.error_dict.items()
                },
            }
        elif hasattr(error, "error_list"):
            # Non-field validation errors
            return {
                "error": "Validation failed",
                "details": [str(err) for err in error.error_list],
            }
    elif isinstance(error, IntegrityError):
        error_msg = str(error)
        # Try to extract field name from common PostgreSQL integrity error patterns
        if "duplicate key value violates unique constraint" in error_msg.lower():
            # PostgreSQL unique constraint error
            # Pattern: 'duplicate key value violates unique constraint "table_field_key"'
            # or 'DETAIL:  Key (field_name)=(value) already exists.'
            if "detail:" in error_msg.lower() and "key (" in error_msg.lower():
                try:
                    # Extract field name from DETAIL line: Key (field_name)=(value)
                    detail_part = error_msg.lower().split("detail:")[1]
                    field_start = detail_part.find("key (") + 5
                    field_end = detail_part.find(")", field_start)
                    field_names = detail_part[field_start:field_end].strip()

                    # Handle composite unique constraints (multiple fields)
                    if "," in field_names:
                        # Split composite field names and create errors for each field
                        individual_fields = [
                            f.strip().replace("_id", "") for f in field_names.split(",")
                        ]
                        field_errors = {}
                        for field in individual_fields:
                            if field:  # Skip empty fields
                                field_errors[field] = [
                                    "This combination of values must be unique."
                                ]

                        return {
                            "error": "Validation failed",
                            "field_errors": field_errors,
                        }
                    else:
                        # Single field unique constraint
                        field = field_names.replace("_id", "").strip()
                        return {
                            "error": "Validation failed",
                            "field_errors": {field: ["This value must be unique."]},
                        }
                except (IndexError, ValueError):
                    pass
            return {
                "error": "Duplicate value detected",
                "details": ["A record with this value already exists."],
            }
        elif (
            "null value in column" in error_msg.lower()
            and "violates not-null constraint" in error_msg.lower()
        ):
            # PostgreSQL not null constraint error
            # Pattern: 'null value in column "field_name" violates not-null constraint'
            try:
                # Extract field name from error message
                start_idx = error_msg.lower().find('null value in column "') + 22
                end_idx = error_msg.find('"', start_idx)
                field = error_msg[start_idx:end_idx].strip()
                return {
                    "error": "Validation failed",
                    "field_errors": {field: ["This field is required."]},
                }
            except (IndexError, ValueError):
                return {
                    "error": "Validation failed",
                    "details": ["A required field is missing."],
                }
        elif "violates foreign key constraint" in error_msg.lower():
            # PostgreSQL foreign key constraint error
            return {
                "error": "Invalid reference",
                "details": ["Referenced record does not exist."],
            }
        elif "violates check constraint" in error_msg.lower():
            # PostgreSQL check constraint error
            return {
                "error": "Validation failed",
                "details": ["Value does not meet the required constraints."],
            }

    # Default fallback for other exceptions
    return {
        "error": str(error),
        "details": ["An unexpected error occurred while processing your request."],
    }


def flatten_dict(data, parent_key="", sep=".", max_depth=1, current_depth=0):
    """
    Flatten a nested dictionary with configurable depth.

    Args:
        data: Dictionary to flatten
        parent_key: Parent key for nested structure
        sep: Separator for flattened keys
        max_depth: Maximum depth to flatten (1 = only one level)
        current_depth: Current recursion depth

    Returns:
        Flattened dictionary with dot-notation keys
    """
    items = []
    if isinstance(data, dict) and current_depth < max_depth:
        for k, v in data.items():
            new_key = f"{parent_key}{sep}{k}" if parent_key else k
            if isinstance(v, dict) and current_depth + 1 < max_depth:
                # Recursively flatten if we haven't reached max depth
                items.extend(
                    flatten_dict(v, new_key, sep, max_depth, current_depth + 1).items()
                )
            else:
                # Don't flatten further, keep as is
                items.append((new_key, v))
    else:
        # If data is not a dict or we've reached max depth, return it as is with the parent key
        if parent_key:
            items.append((parent_key, data))
    return dict(items)


def get_flattened_columns_from_sample_data(entity, db, dict_field_names):
    """
    Analyze sample data to determine all possible flattened columns and their types.

    Args:
        entity: Entity name
        db: Database connection
        dict_field_names: List of dict field names to analyze

    Returns:
        Dictionary mapping flattened column names to their inferred types
    """
    if not dict_field_names:
        return {}

    # Get a sample of records to analyze (limit to first 100 for efficiency)
    queryset = db.request(entity)[:100]
    items = list(queryset)

    flattened_columns = {}
    type_frequency = {}  # Track type frequency for better type inference

    for item in items:
        for field_name in dict_field_names:
            if hasattr(item, field_name):
                field_value = getattr(item, field_name)
                if field_value and isinstance(field_value, dict):
                    # Use one-level flattening for consistency
                    flattened_data = flatten_dict(field_value, field_name, max_depth=1)

                    for flat_key, flat_value in flattened_data.items():
                        if flat_key not in type_frequency:
                            type_frequency[flat_key] = {}

                        # Infer type from value
                        if isinstance(flat_value, bool):
                            inferred_type = "boolean"
                        elif isinstance(flat_value, int):
                            inferred_type = "integer"
                        elif isinstance(flat_value, float):
                            inferred_type = "number"
                        elif isinstance(flat_value, dict):
                            inferred_type = "dict"
                        elif isinstance(flat_value, list):
                            inferred_type = "list"
                        elif isinstance(flat_value, str):
                            inferred_type = "string"
                        elif flat_value is None:
                            inferred_type = "null"
                        else:
                            inferred_type = "string"  # default fallback

                        # Count type frequency
                        type_frequency[flat_key][inferred_type] = (
                            type_frequency[flat_key].get(inferred_type, 0) + 1
                        )

    # Determine the most common type for each column
    for flat_key, types in type_frequency.items():
        if types:
            # Use the most frequent type, defaulting to string if tied
            most_common_type = max(types.items(), key=lambda x: x[1])[0]
            flattened_columns[flat_key] = most_common_type

    return flattened_columns


def apply_dict_flattening(serialized_data, dict_field_names):
    """
    Apply flattening to serialized data by keeping original dict fields and adding flattened versions.
    Optimized for performance with large datasets.

    Args:
        serialized_data: List of serialized records
        dict_field_names: List of dict field names to flatten

    Returns:
        List of records with original dict fields preserved and flattened dict fields added
    """
    if not dict_field_names:
        return serialized_data

    flattened_data = []

    for record in serialized_data:
        flattened_record = {}

        # Copy all fields first (including dict fields)
        for key, value in record.items():
            flattened_record[key] = value

        # Process dict fields to add flattened versions
        for field_name in dict_field_names:
            if field_name in record:
                field_value = record[field_name]

                if field_value and isinstance(field_value, dict):
                    # Use one-level flattening for consistency
                    flattened_dict = flatten_dict(field_value, field_name, max_depth=1)
                    flattened_record.update(flattened_dict)
                # If field_value is None or not a dict, we keep the original field as is

        flattened_data.append(flattened_record)

    return flattened_data


def map_koalak_type_to_form_type(field_desc):
    """Map koalak FieldDescription type to form field type"""
    import datetime

    annotation = field_desc.annotation

    # Handle None annotation
    if annotation is None:
        return "string"

    # Handle relationship fields
    if field_desc.has_relationship():
        return "relation"

    # Handle choices (enum fields)
    if field_desc.choices:
        return "enum"

    # Handle sequence types (set, list)
    if field_desc.is_sequence():
        # For sequences without relationships, keep them as sequences for tags input
        # They will be rendered as tag inputs on the frontend
        atomic_type = field_desc.atomic_type

        if atomic_type is str:
            return "tags"  # String tags input
        elif atomic_type is int:
            return "number_tags"  # Number tags input
        elif atomic_type is float:
            return "number_tags"  # Number tags input
        else:
            return "tags"  # Default to string tags

    if annotation is bool:
        return "boolean"
    elif annotation is int:
        return "integer"
    elif annotation is float:
        return "number"
    elif annotation is str:
        return "text"  # Use text for string fields to get textarea
    elif annotation is datetime.datetime:
        return "datetime"
    elif annotation is datetime.date:
        return "date"
    elif annotation is datetime.time:
        return "time"
    elif annotation is dict or annotation is Dict:
        return "json"
    else:
        return "string"
