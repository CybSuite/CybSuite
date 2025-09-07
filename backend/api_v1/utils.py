import json
import logging
import operator
import threading
import time
from datetime import datetime
from functools import reduce
from typing import Dict

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.db.models import Q, QuerySet

from .consumers import ScanStatusBroadcaster


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


def get_flattened_columns_from_sample_data(data: QuerySet | list, dict_field_names):
    """
    Analyze sample data to determine all possible flattened columns and their types.

    Args:
        data: QuerySet or list of records to analyze
        dict_field_names: List of dict field names to analyze

    Returns:
        Dictionary mapping flattened column names to their inferred types
    """
    if not dict_field_names:
        return {}

    if isinstance(data, QuerySet):
        items = list(data)
    else:
        items = data

    flattened_columns = {}
    type_frequency = {}  # Track type frequency for better type inference

    for item in items:
        for field_name in dict_field_names:
            if (
                isinstance(data, QuerySet)
                and hasattr(item, field_name)
                or field_name in item
            ):
                field_value = (
                    getattr(item, field_name)
                    if isinstance(data, QuerySet)
                    else item.get(field_name)
                )
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


def get_empty_field_description(
    entity,
    name,
    display_name,
    annotation,
    description=None,
    choices=None,
    editable=None,
):
    return {
        "name": name,
        "pretty_name": display_name,
        "plural_name": display_name + "s",
        "display_name": display_name,
        "dest": None,
        "default": "NOTHING",
        "choices": choices,
        "annotation": annotation,
        "description": description,
        "examples": None,
        "element_examples": None,
        "indexed": False,
        "unique": False,
        "nullable": True,
        "not_editable": not bool(editable),
        "hidden_in_list": False,
        "hidden_in_detail": False,
        "in_filter_query": True,
        "is_linked_by_related_name": False,
        "entity": entity,
        "referenced_entity": None,
    }


def get_data_table_params(request):
    skip = int(request.GET.get("skip", 0))
    limit = request.GET.get("limit", 0)
    search = request.GET.get("search")
    filters = request.GET.get("filters")

    # Server-side table management parameters
    sort_by = request.GET.get("sort_by")  # field name to sort by
    sort_desc = (
        request.GET.get("sort_desc", "false").lower() == "true"
    )  # sort direction
    server_search = request.GET.get("server_search")  # server-side search query
    server_filters = request.GET.get(
        "server_filters"
    )  # JSON string of server-side filters

    if limit and limit != 0:
        limit = int(limit)

    # Check if dict flattening is requested
    flatten_dict_param = request.GET.get("flatten_dict", "false").lower() == "true"

    return (
        skip,
        limit,
        search,
        filters,
        sort_by,
        sort_desc,
        server_search,
        server_filters,
        flatten_dict_param,
    )


def filter_data_table_queryset(queryset, table_params, dict_field_names):
    (
        skip,
        limit,
        search,
        filters,
        sort_by,
        sort_desc,
        server_search,
        server_filters,
        _,
    ) = table_params

    # Fields added via extra() that can't be used in Django ORM filters
    extra_fields = {
        "max_severity",
        "max_confidence",
        "max_severity_rank",
        "max_confidence_rank",
    }

    # Collect extra field filters for post-processing
    extra_field_filters = []

    # Apply server-side search if provided
    if server_search:
        # Get all fields from the model
        model_fields = queryset.model._meta.fields

        # Create a Q object for each field to search in
        search_q_objects = []
        for field in model_fields:
            # Search in text and number fields, but skip dict fields since they'll be flattened
            if (
                field.get_internal_type()
                in [
                    "CharField",
                    "TextField",
                    "IntegerField",
                    "FloatField",
                    "DecimalField",
                ]
                and field.name not in dict_field_names
                and field.name not in extra_fields
            ):
                search_q_objects.append(
                    Q(**{f"{field.name}__icontains": server_search})
                )

        # Combine all Q objects with OR operator
        if search_q_objects:
            queryset = queryset.filter(reduce(operator.or_, search_q_objects))

    # Apply server-side filters if provided
    if server_filters:
        try:
            filter_data = json.loads(server_filters)
            advanced_filters = filter_data.get("advancedFilters", [])
            global_logic = filter_data.get("globalLogic", "and")

            filter_q_objects = []

            for filter_item in advanced_filters:
                column = filter_item.get("column")
                filter_operator = filter_item.get("operator")
                value = filter_item.get("value")

                if not column or not filter_operator:
                    continue

                # Skip flattened field filters (handle post-processing)
                if "." in column and any(
                    column.startswith(f"{df}.") for df in dict_field_names
                ):
                    continue

                # Collect extra field filters for post-processing
                if column in extra_fields:
                    extra_field_filters.append(
                        {
                            "column": column,
                            "operator": filter_operator,
                            "value": value,
                            "global_logic": global_logic,
                        }
                    )
                    continue

                # Build Django ORM filter based on operator
                if filter_operator == "contains":
                    filter_q_objects.append(Q(**{f"{column}__icontains": value}))
                elif filter_operator == "does_not_contain":
                    filter_q_objects.append(~Q(**{f"{column}__icontains": value}))
                elif filter_operator == "is":
                    filter_q_objects.append(Q(**{f"{column}__iexact": value}))
                elif filter_operator == "is_not":
                    filter_q_objects.append(~Q(**{f"{column}__iexact": value}))
                elif filter_operator == "is_empty":
                    filter_q_objects.append(
                        Q(**{f"{column}__isnull": True}) | Q(**{f"{column}__exact": ""})
                    )
                elif filter_operator == "is_not_empty":
                    filter_q_objects.append(
                        ~Q(**{f"{column}__isnull": True})
                        & ~Q(**{f"{column}__exact": ""})
                    )
                elif filter_operator == "equals":
                    if value is not None:
                        filter_q_objects.append(Q(**{f"{column}__exact": value}))
                elif filter_operator == "not_equals":
                    if value is not None:
                        filter_q_objects.append(~Q(**{f"{column}__exact": value}))
                elif filter_operator == "greater_than":
                    if value is not None:
                        filter_q_objects.append(Q(**{f"{column}__gt": value}))
                elif filter_operator == "less_than":
                    if value is not None:
                        filter_q_objects.append(Q(**{f"{column}__lt": value}))
                elif filter_operator == "greater_equal":
                    if value is not None:
                        filter_q_objects.append(Q(**{f"{column}__gte": value}))
                elif filter_operator == "less_equal":
                    if value is not None:
                        filter_q_objects.append(Q(**{f"{column}__lte": value}))
                elif filter_operator == "has_any_of":
                    if isinstance(value, list) and value:
                        filter_q_objects.append(Q(**{f"{column}__in": value}))
                elif filter_operator == "has_none_of":
                    if isinstance(value, list) and value:
                        filter_q_objects.append(~Q(**{f"{column}__in": value}))
                elif filter_operator == "is_on":
                    if value:
                        filter_q_objects.append(Q(**{f"{column}__date": value}))
                elif filter_operator == "is_before":
                    if value:
                        filter_q_objects.append(Q(**{f"{column}__lt": value}))
                elif filter_operator == "is_after":
                    if value:
                        filter_q_objects.append(Q(**{f"{column}__gt": value}))
                elif filter_operator == "is_between":
                    if (
                        isinstance(value, dict)
                        and value.get("start")
                        and value.get("end")
                    ):
                        filter_q_objects.append(
                            Q(
                                **{
                                    f"{column}__range": [
                                        value["start"],
                                        value["end"],
                                    ]
                                }
                            )
                        )

            # Apply filters with global logic
            if filter_q_objects:
                if global_logic == "and":
                    for q_obj in filter_q_objects:
                        queryset = queryset.filter(q_obj)
                else:  # 'or'
                    queryset = queryset.filter(reduce(operator.or_, filter_q_objects))

        except json.JSONDecodeError:
            # Return error information instead of Response object
            return None, 0, [], None

    # Check if we need post-processing sorting for extra fields
    extra_field_sort = None
    if sort_by and sort_by in extra_fields:
        extra_field_sort = {"field": sort_by, "desc": sort_desc}
        sort_by = None  # Don't apply database sorting for extra fields

    # Apply server-side sorting if provided
    if sort_by:
        # Check if sorting a flattened field (handle post-processing)
        is_flattened_sort = "." in sort_by and any(
            sort_by.startswith(f"{df}.") for df in dict_field_names
        )

        if not is_flattened_sort:
            order_field = f"-{sort_by}" if sort_desc else sort_by
            try:
                queryset = queryset.order_by(order_field)
            except Exception:
                # If sorting fails, continue without sorting
                pass

    # Get filtered count after applying search and filters
    filtered_count = queryset.count()

    # Apply column filters if provided (legacy support)
    if filters:
        try:
            filter_dict = json.loads(filters)
            for field, value in filter_dict.items():
                if value:  # Only apply non-empty filters
                    # Handle flattened field filters (e.g., "details.hello")
                    if "." in field and any(
                        field.startswith(f"{df}.") for df in dict_field_names
                    ):
                        # This is a flattened field filter - we'll need to apply it after serialization
                        # For now, skip database-level filtering for flattened fields
                        continue
                    # Collect extra field filters for post-processing
                    elif field in extra_fields:
                        extra_field_filters.append(
                            {
                                "column": field,
                                "operator": "contains",  # Legacy filters use contains
                                "value": value,
                                "global_logic": "and",
                            }
                        )
                        continue
                    else:
                        queryset = queryset.filter(**{f"{field}__icontains": value})
        except json.JSONDecodeError:
            # Return error information instead of Response object
            return None, 0, [], None

    # Apply legacy global search if provided (and no server_search)
    if search and not server_search:
        # Get all fields from the model
        model_fields = queryset.model._meta.fields

        # Create a Q object for each field to search in
        q_objects = []
        for field in model_fields:
            # Only search in text and number fields, but skip dict fields since they'll be flattened
            if (
                field.get_internal_type()
                in [
                    "CharField",
                    "TextField",
                    "IntegerField",
                    "FloatField",
                    "DecimalField",
                ]
                and field.name not in dict_field_names
                and field.name not in extra_fields
            ):
                q_objects.append(Q(**{f"{field.name}__icontains": search}))

        # Combine all Q objects with OR operator
        if q_objects:
            queryset = queryset.filter(reduce(operator.or_, q_objects))

    # Always return the 4-tuple at the end of the function
    return queryset, filtered_count, extra_field_filters, extra_field_sort


def apply_extra_field_filters(items, extra_field_filters, global_logic="and"):
    """
    Apply filters to extra fields (fields added via extra()) at the post-processing level.

    Args:
        items: List of serialized items to filter
        extra_field_filters: List of filter configurations for extra fields
        global_logic: 'and' or 'or' logic for combining filters

    Returns:
        Filtered list of items
    """
    if not extra_field_filters:
        return items

    filtered_items = []

    for item in items:
        filter_results = []

        for filter_config in extra_field_filters:
            column = filter_config.get("column")
            filter_operator = filter_config.get("operator")
            value = filter_config.get("value")

            if not column or not filter_operator:
                continue

            item_value = item.get(column)

            # Apply filter logic
            if filter_operator == "contains":
                if item_value and value:
                    filter_results.append(str(value).lower() in str(item_value).lower())
                else:
                    filter_results.append(False)
            elif filter_operator == "does_not_contain":
                if item_value and value:
                    filter_results.append(
                        str(value).lower() not in str(item_value).lower()
                    )
                else:
                    filter_results.append(True)
            elif filter_operator == "is" or filter_operator == "equals":
                filter_results.append(
                    str(item_value).lower() == str(value).lower()
                    if item_value and value
                    else item_value == value
                )
            elif filter_operator == "is_not" or filter_operator == "not_equals":
                filter_results.append(
                    str(item_value).lower() != str(value).lower()
                    if item_value and value
                    else item_value != value
                )
            elif filter_operator == "is_empty":
                filter_results.append(not item_value or str(item_value).strip() == "")
            elif filter_operator == "is_not_empty":
                filter_results.append(item_value and str(item_value).strip() != "")
            elif filter_operator == "has_any_of":
                if isinstance(value, list) and value:
                    filter_results.append(item_value in value)
                else:
                    filter_results.append(False)
            elif filter_operator == "has_none_of":
                if isinstance(value, list) and value:
                    filter_results.append(item_value not in value)
                else:
                    filter_results.append(True)
            else:
                # Unknown operator, include item
                filter_results.append(True)

        # Apply global logic
        if filter_results:
            if global_logic == "and":
                include_item = all(filter_results)
            else:  # 'or'
                include_item = any(filter_results)
        else:
            include_item = True

        if include_item:
            filtered_items.append(item)

    return filtered_items


def apply_extra_field_sort(items, extra_field_sort):
    """
    Apply sorting to extra fields at the post-processing level.

    Args:
        items: List of serialized items to sort
        extra_field_sort: Dict with 'field' and 'desc' keys

    Returns:
        Sorted list of items
    """
    if not extra_field_sort:
        return items

    field = extra_field_sort.get("field")
    desc = extra_field_sort.get("desc", False)

    if not field:
        return items

    # Define sorting key function
    def sort_key(item):
        value = item.get(field, "")

        # Handle None values
        if value is None:
            return 0  # Lowest rank for None values

        # Use rank-based sorting for severity and confidence fields
        if field == "max_severity":
            return SEVERITY_RANKS.get(str(value).lower(), 0)
        elif field == "max_confidence":
            return CONFIDENCE_RANKS.get(str(value).lower(), 0)
        else:
            # For other fields, use alphabetic sorting
            return str(value).lower()

    return sorted(items, key=sort_key, reverse=desc)


SEVERITY_RANKS = {
    "undefined": 1,
    "info": 2,
    "low": 3,
    "medium": 4,
    "high": 5,
    "critical": 6,
}
CONFIDENCE_RANKS = {
    "undefined": 1,
    "true_positive": 2,
    "certain": 3,
    "firm": 4,
    "tentative": 5,
    "manual": 6,
    "false_positive": 7,
}


def get_max_severity_and_confidence(obj):
    severities = [c.severity for c in obj.controls.all() if c.severity]
    max_severity = (
        max(severities, key=lambda s: SEVERITY_RANKS.get(s, 0)) if severities else None
    )

    highest_controls = [c for c in obj.controls.all() if c.severity == max_severity]
    confidences = [c.confidence for c in highest_controls if c.confidence]
    if max_severity is None:
        max_confidence = None
    else:
        max_confidence = (
            max(confidences, key=lambda c: CONFIDENCE_RANKS.get(c, 0))
            if confidences
            else None
        )

    return max_severity, max_confidence


def annotate_with_severity_confidence_labels(queryset, is_observation):
    if not queryset.exists():
        return queryset

    Control = queryset.first().controls.model

    # Use raw SQL for direct label calculation to avoid any Django ORM complexity
    control_table = Control._meta.db_table
    control_def_table = queryset.model._meta.db_table

    # Build the CASE statements for SQL ranking
    severity_case_sql = (
        "CASE "
        + " ".join(
            [f"WHEN c.severity = '{k}' THEN {v}" for k, v in SEVERITY_RANKS.items()]
        )
        + " ELSE 0 END"
    )
    confidence_case_sql = (
        "CASE "
        + " ".join(
            [f"WHEN c.confidence = '{k}' THEN {v}" for k, v in CONFIDENCE_RANKS.items()]
        )
        + " ELSE 0 END"
    )

    # Build the CASE statements to convert max rank directly to label
    severity_label_cases = []
    for k, v in SEVERITY_RANKS.items():
        severity_label_cases.append(f"WHEN MAX({severity_case_sql}) = {v} THEN '{k}'")
    severity_label_sql = "CASE " + " ".join(severity_label_cases) + " ELSE NULL END"

    confidence_label_cases = []
    for k, v in CONFIDENCE_RANKS.items():
        confidence_label_cases.append(
            f"WHEN MAX({confidence_case_sql}) = {v} THEN '{k}'"
        )
    confidence_label_sql = "CASE " + " ".join(confidence_label_cases) + " ELSE NULL END"

    # Add status filter if is_observation is True
    status_filter = " AND c.status = 'ko'" if is_observation else ""

    queryset = queryset.extra(
        select={
            "max_severity": f"""
                SELECT {severity_label_sql}
                FROM {control_table} c
                WHERE c.control_definition_id = {control_def_table}.id{status_filter}
            """,
            "max_confidence": f"""
                SELECT {confidence_label_sql}
                FROM {control_table} c
                WHERE c.control_definition_id = {control_def_table}.id{status_filter}
                AND ({severity_case_sql}) = (
                    SELECT MAX({severity_case_sql.replace('c.', 'c2.')})
                    FROM {control_table} c2
                    WHERE c2.control_definition_id = {control_def_table}.id{status_filter.replace('c.', 'c2.')}
                )
            """,
        }
    )

    return queryset


class WebSocketLogHandler(logging.Handler):
    """Custom log handler that broadcasts log messages via WebSocket"""

    def __init__(self, broadcast_func, scanner_name):
        super().__init__()
        self.broadcast_func = broadcast_func
        self.scanner_name = scanner_name
        self.setLevel(logging.INFO)  # Capture INFO level and above

        # Set up formatter for readable log messages
        formatter = logging.Formatter("%(levelname)s: %(message)s")
        self.setFormatter(formatter)

    def emit(self, record):
        """Emit a log record by broadcasting it via WebSocket"""
        try:
            log_message = self.format(record)

            # Broadcast log message to the scan status group
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    "scan_status",
                    {
                        "type": "log_message",
                        "data": {
                            "scanner_name": self.scanner_name,
                            "level": record.levelname,
                            "message": log_message,
                            "timestamp": time.time(),
                        },
                    },
                )
        except Exception:
            # Don't let logging errors crash the scanner
            pass


def get_progress_display_mode(progress_info):
    """Determine how many progress bars to show and their types"""
    total_portions = progress_info.get("total_portions")
    total_steps = progress_info.get("total_steps")

    if total_portions is not None and total_portions > 1:
        # Multi-portion scan - show two progress bars
        return {
            "mode": "dual",
            "overall_bar": "portions",  # First bar shows portion progress
            "current_bar": "steps"
            if total_steps and total_steps > 0
            else "indeterminate",  # Second bar shows current portion steps
        }
    elif total_steps is not None and total_steps > 0:
        # Single portion with steps - show one progress bar for steps
        return {"mode": "single", "overall_bar": "steps"}
    else:
        # Fully indeterminate - show one indeterminate progress bar
        return {"mode": "single", "overall_bar": "indeterminate"}


def calculate_progress_percentage(progress_info):
    """Calculate progress percentage based on current state"""
    total_portions = progress_info.get("total_portions")
    current_portion = progress_info.get("current_portion", 0)
    total_steps = progress_info.get("total_steps")
    current_step = progress_info.get("current_step", 0)

    if total_portions is not None and total_portions > 0:
        # Progress uses portions - percentage is based on portions only
        return int((current_portion / total_portions) * 100)
    elif total_steps is not None and total_steps > 0:
        # Progress uses steps only (no portions) - percentage is based on steps
        return int((current_step / total_steps) * 100)
    else:
        # Indeterminate progress (no portions, no steps)
        return 0


def calculate_progress_bar_percentage(progress_info):
    """Calculate progress bar percentage (separate from overall percentage)"""
    total_steps = progress_info.get("total_steps")
    current_step = progress_info.get("current_step", 0)

    if total_steps is not None and total_steps > 0:
        # Progress bar shows current portion step progress
        return int((current_step / total_steps) * 100)
    else:
        # No steps - progress bar is indeterminate
        return 0


def get_progress_message(scanner_name, progress_info):
    """Generate progress message based on current state"""
    total_portions = progress_info.get("total_portions")
    current_portion = progress_info.get("current_portion", 0)
    total_steps = progress_info.get("total_steps")
    current_step = progress_info.get("current_step", 0)

    if total_portions is not None and total_portions > 1:
        # Multi-portion scan
        portion_text = f"Portion {current_portion}/{total_portions}"

        if total_steps is not None and total_steps > 0:
            # Current portion has determinate steps
            return f"{scanner_name} scan - {portion_text}, Step {current_step}/{total_steps}"
        else:
            # Current portion is indeterminate
            return f"{scanner_name} scan - {portion_text} (processing...)"
    elif total_steps is not None and total_steps > 0:
        # Single portion with determinate steps
        return f"{scanner_name} scan - Step {current_step}/{total_steps}"
    else:
        # Completely indeterminate
        return f"{scanner_name} scan in progress..."


def format_scan_results(scan_results, scanner_instance):
    """Format scan results for frontend consumption"""
    if not scan_results:
        return {
            "message": "Scan completed with no results",
            "summary": {},
            "details": [],
        }

    # Get basic statistics from scanner instance
    summary = {
        "identified_observations": getattr(scanner_instance, "_nb_identified_obs", 0),
        "new_observations": getattr(scanner_instance, "_nb_new_obs", 0),
    }

    # Add unprinted control counts if available
    if hasattr(scanner_instance, "track_unprinted_controls"):
        summary["unprinted_controls"] = dict(scanner_instance.track_unprinted_controls)

    if hasattr(scanner_instance, "track_unprinted_feed_insertions"):
        summary["unprinted_feed_insertions"] = dict(
            scanner_instance.track_unprinted_feed_insertions
        )

    return {
        "message": f"Scan completed successfully",
        "summary": summary,
        "details": scan_results if isinstance(scan_results, (list, dict)) else [],
    }


def run_scan_async(db, pm_cyberdb_scanner, scanner_name, scan_kwargs=None):
    """Run a real scan in a separate thread with WebSocket status updates"""
    if scan_kwargs is None:
        scan_kwargs = {}

    def real_scan():
        scanner_instance = None
        scan_complete_event = threading.Event()

        try:
            broadcast_func = async_to_sync(ScanStatusBroadcaster.broadcast_status)
            start_time = datetime.now().isoformat()

            # Get scanner class and initialize it
            scanner_class = None
            for plugin in pm_cyberdb_scanner:
                if plugin.name == scanner_name:
                    scanner_class = plugin
                    break

            if not scanner_class:
                raise ValueError(f"Scanner '{scanner_name}' not found")

            scanner_instance = scanner_class(db)

            # Set up real-time log streaming
            log_handler = WebSocketLogHandler(broadcast_func, scanner_name)
            scanner_instance.logger.addHandler(log_handler)
            original_log_level = scanner_instance.logger.level
            # Temporarily lower log level to capture more logs during scan
            scanner_instance.logger.setLevel(logging.INFO)

            # Broadcast scan started
            broadcast_func(
                {
                    "status": "running",
                    "scanner_name": scanner_name,
                    "start_time": start_time,
                    "end_time": None,
                    "progress": 0,
                    "progress_type": "indeterminate",
                    "current_portion": 0,
                    "total_portions": None,
                    "current_step": 0,
                    "total_steps": None,
                    "portion_label": None,
                    "step_label": None,
                    "message": f"Initializing {scanner_name} scanner...",
                    "results": None,
                    "error": None,
                }
            )

            # Monitor progress in a separate thread
            def progress_monitor():
                last_progress = None
                while not scan_complete_event.is_set():
                    if scanner_instance is None:
                        break

                    try:
                        current_progress = scanner_instance.get_progress()

                        # Only broadcast if progress changed
                        if current_progress != last_progress:
                            display_info = get_progress_display_mode(current_progress)
                            progress_percentage = calculate_progress_percentage(
                                current_progress
                            )
                            progress_bar_percentage = calculate_progress_bar_percentage(
                                current_progress
                            )

                            broadcast_func(
                                {
                                    "status": "running",
                                    "scanner_name": scanner_name,
                                    "start_time": start_time,
                                    "end_time": None,
                                    "progress": progress_percentage,
                                    "progress_bar": progress_bar_percentage,
                                    "display_mode": display_info["mode"],
                                    "current_portion": current_progress.get(
                                        "current_portion", 0
                                    ),
                                    "total_portions": current_progress.get(
                                        "total_portions"
                                    ),
                                    "current_step": current_progress.get(
                                        "current_step", 0
                                    ),
                                    "total_steps": current_progress.get("total_steps"),
                                    "portion_label": current_progress.get(
                                        "portion_label"
                                    ),
                                    "step_label": current_progress.get("step_label"),
                                    "message": get_progress_message(
                                        scanner_name, current_progress
                                    ),
                                    "results": None,
                                    "error": None,
                                }
                            )
                            last_progress = current_progress.copy()

                        # Check every 500ms, but allow for immediate exit
                        if scan_complete_event.wait(0.5):
                            break

                    except Exception as e:
                        # If scanner is done or error occurred, stop monitoring
                        break

            # Start progress monitoring thread
            progress_thread = threading.Thread(target=progress_monitor, daemon=True)
            progress_thread.start()

            # Run the actual scan
            scan_results = scanner_instance.run(**scan_kwargs)

            # Get final progress and show 100% completion briefly before marking as complete
            final_progress = scanner_instance.get_progress()
            display_info = get_progress_display_mode(final_progress)

            # Show 100% progress for a brief moment
            broadcast_func(
                {
                    "status": "running",
                    "scanner_name": scanner_name,
                    "start_time": start_time,
                    "end_time": None,
                    "progress": 100,
                    "progress_bar": 100,
                    "display_mode": display_info["mode"],
                    "current_portion": final_progress.get("total_portions", 1),
                    "total_portions": final_progress.get("total_portions", 1),
                    "current_step": final_progress.get("total_steps", 1),
                    "total_steps": final_progress.get("total_steps", 1),
                    "portion_label": final_progress.get("portion_label"),
                    "step_label": final_progress.get("step_label"),
                    "message": "Scan completed - finalizing results...",
                    "results": None,
                    "error": None,
                }
            )

            # Brief delay to show 100% completion (1.5 seconds)
            time.sleep(1.5)

            # Signal that scan is complete
            scan_complete_event.set()

            # Wait a moment for progress thread to finish
            progress_thread.join(timeout=1.0)

            # Clean up log handler
            if scanner_instance:
                scanner_instance.logger.removeHandler(log_handler)
                scanner_instance.logger.setLevel(original_log_level)

            # Scan completed successfully
            end_time = datetime.now().isoformat()

            # Format results for the frontend
            formatted_results = format_scan_results(scan_results, scanner_instance)

            broadcast_func(
                {
                    "status": "completed",
                    "scanner_name": scanner_name,
                    "start_time": start_time,
                    "end_time": end_time,
                    "progress": 100,
                    "progress_bar": 100,
                    "display_mode": "single",
                    "current_portion": final_progress.get("current_portion", 1),
                    "total_portions": final_progress.get("total_portions", 1),
                    "current_step": final_progress.get("current_step", 1),
                    "total_steps": final_progress.get("total_steps", 1),
                    "portion_label": final_progress.get("portion_label"),
                    "step_label": final_progress.get("step_label"),
                    "message": "Scan completed successfully",
                    "results": formatted_results,
                    "error": None,
                }
            )

        except Exception as e:
            # Signal that scan is complete (with error)
            scan_complete_event.set()

            # Clean up log handler
            if scanner_instance:
                try:
                    scanner_instance.logger.removeHandler(log_handler)
                    scanner_instance.logger.setLevel(original_log_level)
                except:
                    pass  # Ignore cleanup errors

            # Broadcast scan failed
            end_time = datetime.now().isoformat()
            try:
                final_progress = (
                    scanner_instance.get_progress() if scanner_instance else {}
                )
                broadcast_func(
                    {
                        "status": "failed",
                        "scanner_name": scanner_name,
                        "start_time": start_time,
                        "end_time": end_time,
                        "progress": final_progress.get("current_step", 0)
                        if final_progress.get("total_steps")
                        else 0,
                        "progress_bar": 0,
                        "display_mode": "single",
                        "current_portion": final_progress.get("current_portion", 0),
                        "total_portions": final_progress.get("total_portions"),
                        "current_step": final_progress.get("current_step", 0),
                        "total_steps": final_progress.get("total_steps"),
                        "portion_label": final_progress.get("portion_label"),
                        "step_label": final_progress.get("step_label"),
                        "message": f"Scan failed: {str(e)}",
                        "results": None,
                        "error": str(e),
                    }
                )
            except:
                # Fallback error broadcast
                broadcast_func(
                    {
                        "status": "failed",
                        "scanner_name": scanner_name,
                        "start_time": start_time,
                        "end_time": end_time,
                        "progress": 0,
                        "progress_type": "indeterminate",
                        "current_portion": 0,
                        "total_portions": None,
                        "current_step": 0,
                        "total_steps": None,
                        "portion_label": None,
                        "step_label": None,
                        "message": f"Scan failed: {str(e)}",
                        "results": None,
                        "error": str(e),
                    }
                )

    # Run in thread to not block the request
    thread = threading.Thread(target=real_scan)
    thread.daemon = True
    thread.start()


def run_multiple_scans_async(db, pm_cyberdb_scanner, scanner_names, scan_kwargs=None):
    """Run multiple scans sequentially in a separate thread with WebSocket status updates"""
    if scan_kwargs is None:
        scan_kwargs = {}

    if not scanner_names or len(scanner_names) == 0:
        raise ValueError("No scanner names provided")

    # If only one scanner, use the single scan function
    if len(scanner_names) == 1:
        return run_scan_async(db, pm_cyberdb_scanner, scanner_names[0], scan_kwargs)

    def multiple_scans():
        all_results = []
        all_scan_details = []
        overall_start_time = datetime.now().isoformat()

        try:
            broadcast_func = async_to_sync(ScanStatusBroadcaster.broadcast_status)

            # Broadcast multi-scan started
            broadcast_func(
                {
                    "status": "running",
                    "scanner_name": f"Multiple Scanners ({len(scanner_names)} scanners)",
                    "scanner_names": scanner_names,
                    "start_time": overall_start_time,
                    "end_time": None,
                    "progress": 0,
                    "progress_bar": 0,
                    "display_mode": "dual",
                    "current_portion": 0,
                    "total_portions": len(scanner_names),
                    "current_step": 0,
                    "total_steps": 1,  # Will be updated per scanner
                    "portion_label": f"Multi-Scan Progress ({len(scanner_names)} scanners)",
                    "step_label": None,
                    "message": f"Starting multi-scan with {len(scanner_names)} scanners...",
                    "results": None,
                    "error": None,
                    "multi_scan": True,
                    "scanned_scanners": [],
                }
            )

            # Run each scanner sequentially
            for i, scanner_name in enumerate(scanner_names):
                try:
                    scanner_start_time = datetime.now().isoformat()

                    # Get scanner class and initialize it
                    scanner_class = None
                    for plugin in pm_cyberdb_scanner:
                        if plugin.name == scanner_name:
                            scanner_class = plugin
                            break

                    if not scanner_class:
                        raise ValueError(f"Scanner '{scanner_name}' not found")

                    scanner_instance = scanner_class(db)

                    # Set up real-time log streaming for current scanner
                    log_handler = WebSocketLogHandler(broadcast_func, scanner_name)
                    scanner_instance.logger.addHandler(log_handler)
                    original_log_level = scanner_instance.logger.level
                    scanner_instance.logger.setLevel(logging.INFO)

                    # Calculate overall progress
                    overall_progress = int((i / len(scanner_names)) * 100)

                    # Broadcast current scanner starting
                    broadcast_func(
                        {
                            "status": "running",
                            "scanner_name": f"Multiple Scanners ({len(scanner_names)} scanners)",
                            "scanner_names": scanner_names,
                            "current_scanner": scanner_name,
                            "start_time": overall_start_time,
                            "end_time": None,
                            "progress": overall_progress,
                            "progress_bar": 0,
                            "display_mode": "dual",
                            "current_portion": i + 1,
                            "total_portions": len(scanner_names),
                            "current_step": 0,
                            "total_steps": None,
                            "portion_label": f"Multi-Scan Progress ({len(scanner_names)} scanners)",
                            "step_label": f"Running {scanner_name}",
                            "message": f"Running {scanner_name} scanner ({i + 1}/{len(scanner_names)})...",
                            "results": None,
                            "error": None,
                            "multi_scan": True,
                            "scanned_scanners": [s["name"] for s in all_scan_details],
                        }
                    )

                    # Monitor progress for current scanner
                    scan_complete_event = threading.Event()

                    def progress_monitor():
                        last_progress = None
                        while not scan_complete_event.is_set():
                            if scanner_instance is None:
                                break

                            try:
                                current_progress = scanner_instance.get_progress()

                                # Only broadcast if progress changed
                                if current_progress != last_progress:
                                    display_info = get_progress_display_mode(
                                        current_progress
                                    )
                                    progress_bar_percentage = (
                                        calculate_progress_bar_percentage(
                                            current_progress
                                        )
                                    )
                                    overall_progress = int(
                                        (i / len(scanner_names)) * 100
                                    )

                                    broadcast_func(
                                        {
                                            "status": "running",
                                            "scanner_name": f"Multiple Scanners ({len(scanner_names)} scanners)",
                                            "scanner_names": scanner_names,
                                            "current_scanner": scanner_name,
                                            "start_time": overall_start_time,
                                            "end_time": None,
                                            "progress": overall_progress,
                                            "progress_bar": progress_bar_percentage,
                                            "display_mode": "dual",
                                            "current_portion": i + 1,
                                            "total_portions": len(scanner_names),
                                            "current_step": current_progress.get(
                                                "current_step", 0
                                            ),
                                            "total_steps": current_progress.get(
                                                "total_steps"
                                            ),
                                            "portion_label": f"Multi-Scan Progress ({len(scanner_names)} scanners)",
                                            "step_label": current_progress.get(
                                                "step_label"
                                            )
                                            or f"Running {scanner_name}",
                                            "message": get_progress_message(
                                                scanner_name, current_progress
                                            ),
                                            "results": None,
                                            "error": None,
                                            "multi_scan": True,
                                            "scanned_scanners": [
                                                s["name"] for s in all_scan_details
                                            ],
                                        }
                                    )
                                    last_progress = current_progress.copy()

                                # Check every 500ms
                                if scan_complete_event.wait(0.5):
                                    break

                            except Exception:
                                break

                    # Start progress monitoring thread
                    progress_thread = threading.Thread(
                        target=progress_monitor, daemon=True
                    )
                    progress_thread.start()

                    # Run the actual scan
                    scan_results = scanner_instance.run(**scan_kwargs)

                    # Signal scan complete for this scanner
                    scan_complete_event.set()
                    progress_thread.join(timeout=1.0)

                    # Clean up log handler
                    scanner_instance.logger.removeHandler(log_handler)
                    scanner_instance.logger.setLevel(original_log_level)

                    # Store results
                    scanner_end_time = datetime.now().isoformat()
                    formatted_results = format_scan_results(
                        scan_results, scanner_instance
                    )

                    scan_detail = {
                        "name": scanner_name,
                        "start_time": scanner_start_time,
                        "end_time": scanner_end_time,
                        "status": "completed",
                        "results": formatted_results,
                        "error": None,
                    }

                    all_scan_details.append(scan_detail)
                    all_results.append(formatted_results)

                    # Broadcast scanner completion
                    overall_progress = int(((i + 1) / len(scanner_names)) * 100)
                    broadcast_func(
                        {
                            "status": "running",
                            "scanner_name": f"Multiple Scanners ({len(scanner_names)} scanners)",
                            "scanner_names": scanner_names,
                            "current_scanner": scanner_name,
                            "start_time": overall_start_time,
                            "end_time": None,
                            "progress": overall_progress,
                            "progress_bar": 100,
                            "display_mode": "dual",
                            "current_portion": i + 1,
                            "total_portions": len(scanner_names),
                            "current_step": scanner_instance.get_progress().get(
                                "total_steps", 1
                            )
                            if scanner_instance
                            else 1,
                            "total_steps": scanner_instance.get_progress().get(
                                "total_steps", 1
                            )
                            if scanner_instance
                            else 1,
                            "portion_label": f"Multi-Scan Progress ({len(scanner_names)} scanners)",
                            "step_label": f"{scanner_name} completed",
                            "message": f"{scanner_name} completed successfully",
                            "results": None,
                            "error": None,
                            "multi_scan": True,
                            "scanned_scanners": [s["name"] for s in all_scan_details],
                        }
                    )

                except Exception as e:
                    # Handle individual scanner failure
                    scanner_end_time = datetime.now().isoformat()
                    scan_detail = {
                        "name": scanner_name,
                        "start_time": scanner_start_time
                        if "scanner_start_time" in locals()
                        else datetime.now().isoformat(),
                        "end_time": scanner_end_time,
                        "status": "failed",
                        "results": None,
                        "error": str(e),
                    }
                    all_scan_details.append(scan_detail)

                    # Clean up on error
                    if "scanner_instance" in locals() and scanner_instance:
                        try:
                            scanner_instance.logger.removeHandler(log_handler)
                            scanner_instance.logger.setLevel(original_log_level)
                        except:
                            pass

                    # Continue with next scanner
                    continue

            # All scanners completed
            overall_end_time = datetime.now().isoformat()

            # Prepare combined results
            combined_results = {
                "message": f"Multi-scan completed: {len(all_scan_details)} scanners processed",
                "summary": {
                    "total_scanners": len(scanner_names),
                    "successful_scans": len(
                        [s for s in all_scan_details if s["status"] == "completed"]
                    ),
                    "failed_scans": len(
                        [s for s in all_scan_details if s["status"] == "failed"]
                    ),
                    "scan_details": all_scan_details,
                },
                "details": all_results,
                "multi_scan": True,
            }

            broadcast_func(
                {
                    "status": "completed",
                    "scanner_name": f"Multiple Scanners ({len(scanner_names)} scanners)",
                    "scanner_names": scanner_names,
                    "start_time": overall_start_time,
                    "end_time": overall_end_time,
                    "progress": 100,
                    "progress_bar": 100,
                    "display_mode": "single",
                    "current_portion": len(scanner_names),
                    "total_portions": len(scanner_names),
                    "current_step": 1,
                    "total_steps": 1,
                    "portion_label": f"Multi-Scan Completed ({len(scanner_names)} scanners)",
                    "step_label": None,
                    "message": f"Multi-scan completed successfully: {len([s for s in all_scan_details if s['status'] == 'completed'])} of {len(scanner_names)} scanners succeeded",
                    "results": combined_results,
                    "error": None,
                    "multi_scan": True,
                    "scanned_scanners": [s["name"] for s in all_scan_details],
                }
            )

        except Exception as e:
            # Handle overall multi-scan failure
            overall_end_time = datetime.now().isoformat()
            broadcast_func(
                {
                    "status": "failed",
                    "scanner_name": f"Multiple Scanners ({len(scanner_names)} scanners)",
                    "scanner_names": scanner_names,
                    "start_time": overall_start_time,
                    "end_time": overall_end_time,
                    "progress": 0,
                    "progress_bar": 0,
                    "display_mode": "single",
                    "current_portion": 0,
                    "total_portions": len(scanner_names),
                    "current_step": 0,
                    "total_steps": None,
                    "portion_label": f"Multi-Scan Failed ({len(scanner_names)} scanners)",
                    "step_label": None,
                    "message": f"Multi-scan failed: {str(e)}",
                    "results": None,
                    "error": str(e),
                    "multi_scan": True,
                    "scanned_scanners": [s["name"] for s in all_scan_details],
                }
            )

    # Run in thread to not block the request
    thread = threading.Thread(target=multiple_scans)
    thread.daemon = True
    thread.start()
