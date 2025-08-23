import json
import operator
from functools import reduce
from typing import Dict

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.db.models import Q, QuerySet


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
