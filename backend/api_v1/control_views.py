import json
import operator
import random
from functools import reduce
from typing import Dict

from django.db.models import Count, Prefetch, Q
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .pretty_id_utils import (
    get_entity_pretty_id_config,
    parse_pretty_id_with_relations,
    url_decode_pretty_id,
)
from .serializers import serialize_model
from .utils import (
    CONFIDENCE_RANKS,
    SEVERITY_RANKS,
    annotate_with_severity_confidence_labels,
    apply_dict_flattening,
    apply_extra_field_filters,
    apply_extra_field_sort,
    filter_data_table_queryset,
    get_data_table_params,
    get_empty_field_description,
    get_flattened_columns_from_sample_data,
    get_max_severity_and_confidence,
)
from .views import CyberDB, cyberdb_schema, example_categories, example_tags


@api_view(["GET"])
def get_control_definition_w_controls_schema(request):
    """Get the detailed schema definition for a given entity"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        entity = "control_definition"
        entity_data = cyberdb_schema[entity].to_json()

        is_observation = request.GET.get("isObservation", "false").lower() == "true"

        # TODO: remove these temporary placeholders:
        entity_data["category"] = random.choice(example_categories)
        rando = random.randint(1, 4)
        entity_data["tags"] = random.sample(example_tags, k=rando)

        if is_observation:
            # Add Total column
            total_status_schema = get_empty_field_description(
                entity=entity,
                name="ko_count",
                display_name="Occurrences Number",
                annotation="<class 'int'>",
                description="Total number of controls.",
            )

            # Rebuild dictionary to give ok_count and ko_count a selected order
            inserts = {
                1: [
                    ("ko_count", total_status_schema),
                ]
            }
        else:
            # Add KO_count, OK_count, NA_count, and Total
            ko_schema = get_empty_field_description(
                entity=entity,
                name="ko_count",
                display_name="KO Count",
                annotation="<class 'int'>",
                description="Number of controls with KO status.",
            )

            ok_schema = get_empty_field_description(
                entity=entity,
                name="ok_count",
                display_name="OK Count",
                annotation="<class 'int'>",
                description="Number of controls with OK status.",
            )

            na_schema = get_empty_field_description(
                entity=entity,
                name="na_count",
                display_name="NA Count",
                annotation="<class 'int'>",
                description="Number of controls with not_applicable status.",
            )

            total_status_schema = get_empty_field_description(
                entity=entity,
                name="total_count",
                display_name="Total",
                annotation="<class 'int'>",
                description="Total number of controls.",
            )

            # Rebuild dictionary to give ok_count and ko_count a selected order
            inserts = {
                1: [
                    ("ko_count", ko_schema),
                    ("ok_count", ok_schema),
                    ("na_count", na_schema),
                    ("total_count", total_status_schema),
                ]
            }

        # Add max_severity and max_confidence
        max_severity_schema = get_empty_field_description(
            entity=entity,
            name="max_severity",
            display_name="Max Severity",
            annotation="<class 'str'>",
            description="Number of controls with KO status.",
            choices=SEVERITY_RANKS.keys(),
        )
        max_confidence_schema = get_empty_field_description(
            entity=entity,
            name="max_confidence",
            display_name="Max Confidence",
            annotation="<class 'str'>",
            description="Number of controls with KO status.",
            choices=CONFIDENCE_RANKS.keys(),
        )

        inserts[1].insert(0, ("max_severity", max_severity_schema))
        inserts[1].insert(1, ("max_confidence", max_confidence_schema))

        new_fields = {}
        for i, (k, v) in enumerate(entity_data["fields"].items()):
            if i in inserts:
                for nk, nv in inserts[i]:
                    new_fields[nk] = nv

            v["hidden_in_list"] = True if k != "name" else False
            new_fields[k] = v

        entity_data["fields"] = new_fields

        return Response(entity_data)
    except KeyError:
        return Response(
            {"error": f"Entity '{entity}' not found"}, status=status.HTTP_404_NOT_FOUND
        )


@api_view(["GET"])
def get_control_definition_w_controls_data(request):
    """Get paginated list of records from a "control_definition with controls" entity with optional filters, sorting, and search"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:

        # Get query parameters
        table_params = get_data_table_params(request)
        (
            skip,
            limit,
            search,
            filters,
            sort_by,
            sort_desc,
            server_search,
            server_filters,
            flatten_dict_param,
        ) = table_params
        is_observation = request.GET.get("isObservation", "false").lower() == "true"

        # Identify dict fields for flattening only if requested
        entity = "control_definition"
        entity_desc = cyberdb_schema[entity]
        dict_field_names = []
        if flatten_dict_param:
            for field_desc in entity_desc:
                if field_desc.annotation is dict or field_desc.annotation is Dict:
                    dict_field_names.append(field_desc.name)

        # Get the queryset
        queryset = db.request(entity)
        # Annotate control counts
        queryset = queryset.annotate(
            ko_count=Count("controls", filter=Q(controls__status="ko"))
        )
        queryset = queryset.annotate(
            ok_count=Count("controls", filter=Q(controls__status="ok"))
        )
        queryset = queryset.annotate(
            na_count=Count("controls", filter=Q(controls__status="not_applicable"))
        )
        if is_observation:
            queryset = queryset.annotate(
                total_count=Count("controls", filter=Q(controls__status="ko"))
            )
        else:
            queryset = queryset.annotate(total_count=Count("controls"))

        # Assign max severity and max confidence
        queryset = annotate_with_severity_confidence_labels(queryset, is_observation)

        # Get total count before applying filters (for pagination metadata)
        total_count = queryset.count()

        (
            queryset,
            filtered_count,
            extra_field_filters,
            extra_field_sort,
        ) = filter_data_table_queryset(queryset, table_params, dict_field_names)

        # Handle error case from filter_data_table_queryset
        if queryset is None:
            return Response(
                {"error": "Invalid filters format"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if is_observation:
            # Keep only control definitions with at least one Control with status "ko"
            queryset = queryset.filter(ko_count__gt=0)
        else:
            # Keep only control definitions with at least one Control
            queryset = queryset.annotate(control_count=Count("controls")).filter(
                control_count__gt=0
            )

        # Apply skip and limit using Django slicing
        if limit > 0:
            queryset = queryset[skip : skip + limit]
        else:
            queryset = queryset[skip:]

        # Convert QuerySet to list and serialize
        items = list(queryset)
        serialized_items = []
        for item in items:
            serialized = serialize_model(
                cyberdb_schema,
                item,
                entity,
                additional_fields=[
                    "ko_count",
                    "ok_count",
                    "na_count",
                    "total_count",
                    "max_severity",
                    "max_confidence",
                ],
            )
            serialized_items.append(serialized)

        # Apply dict flattening only if requested
        if flatten_dict_param and dict_field_names:
            flattened_items = apply_dict_flattening(serialized_items, dict_field_names)
        else:
            flattened_items = serialized_items

        # Apply extra field filters and sorting
        if extra_field_filters:
            # Get global logic from the first filter (they should all have the same logic)
            global_logic = (
                extra_field_filters[0].get("global_logic", "and")
                if extra_field_filters
                else "and"
            )
            flattened_items = apply_extra_field_filters(
                flattened_items, extra_field_filters, global_logic
            )

        if extra_field_sort:
            flattened_items = apply_extra_field_sort(flattened_items, extra_field_sort)

        # Apply post-processing for flattened fields if needed
        if flatten_dict_param and dict_field_names:
            # Handle server-side sorting for flattened fields
            if (
                sort_by
                and "." in sort_by
                and any(sort_by.startswith(f"{df}.") for df in dict_field_names)
            ):
                flattened_items.sort(
                    key=lambda x: str(x.get(sort_by, "")).lower(), reverse=sort_desc
                )

            # Handle server-side filters for flattened fields
            if server_filters:
                try:
                    filter_data = json.loads(server_filters)
                    advanced_filters = filter_data.get("advancedFilters", [])
                    global_logic = filter_data.get("globalLogic", "and")

                    filtered_items = []
                    for item in flattened_items:
                        filter_results = []

                        for filter_item in advanced_filters:
                            column = filter_item.get("column")
                            filter_operator = filter_item.get("operator")
                            value = filter_item.get("value")

                            if not column or not filter_operator:
                                continue

                            # Only handle flattened field filters here
                            if not (
                                "." in column
                                and any(
                                    column.startswith(f"{df}.")
                                    for df in dict_field_names
                                )
                            ):
                                continue

                            item_value = item.get(column, "")
                            item_str = (
                                str(item_value).lower()
                                if item_value is not None
                                else ""
                            )
                            value_str = str(value).lower() if value is not None else ""

                            # Apply filter logic (simplified for flattened fields)
                            if filter_operator == "contains":
                                filter_results.append(value_str in item_str)
                            elif filter_operator == "does_not_contain":
                                filter_results.append(value_str not in item_str)
                            elif filter_operator == "is":
                                filter_results.append(item_str == value_str)
                            elif filter_operator == "is_not":
                                filter_results.append(item_str != value_str)
                            elif filter_operator == "is_empty":
                                filter_results.append(
                                    not item_value or item_str.strip() == ""
                                )
                            elif filter_operator == "is_not_empty":
                                filter_results.append(
                                    item_value and item_str.strip() != ""
                                )
                            else:
                                filter_results.append(
                                    True
                                )  # Unknown operator, include item

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

                    flattened_items = filtered_items
                except json.JSONDecodeError:
                    pass  # Continue with original items

            # Handle server-side search for flattened fields
            if server_search:
                search_filtered_items = []
                search_lower = server_search.lower()

                for item in flattened_items:
                    # Check if search term appears in any flattened field
                    found_in_flattened = False
                    for key, value in item.items():
                        if any(key.startswith(f"{df}.") for df in dict_field_names):
                            if search_lower in str(value).lower():
                                found_in_flattened = True
                                break

                    # Include if found in flattened fields OR if already included from database search
                    if found_in_flattened:
                        search_filtered_items.append(item)

                # If we found matches in flattened fields, use those
                # Otherwise, keep the original items (they matched in database fields)
                if search_filtered_items or not flattened_items:
                    flattened_items = search_filtered_items

        # Apply post-processing filters and search for flattened fields (legacy support)
        if (
            (filters or search)
            and flatten_dict_param
            and dict_field_names
            and not (server_filters or server_search)
        ):
            filtered_items = []
            for item in flattened_items:
                include_item = True

                # Apply flattened field filters
                if filters:
                    try:
                        filter_dict = json.loads(filters)
                        for field, value in filter_dict.items():
                            if (
                                value
                                and "." in field
                                and any(
                                    field.startswith(f"{df}.")
                                    for df in dict_field_names
                                )
                            ):
                                # Apply filter to flattened field
                                item_value = item.get(field, "")
                                if (
                                    isinstance(item_value, str)
                                    and value.lower() not in item_value.lower()
                                ):
                                    include_item = False
                                    break
                                elif (
                                    not isinstance(item_value, str)
                                    and value.lower() not in str(item_value).lower()
                                ):
                                    include_item = False
                                    break
                    except json.JSONDecodeError:
                        pass

                # Apply search to flattened fields
                if search and include_item:
                    search_match_in_flattened = False
                    for key, value in item.items():
                        if any(key.startswith(f"{df}.") for df in dict_field_names):
                            if (
                                isinstance(value, str)
                                and search.lower() in value.lower()
                            ):
                                search_match_in_flattened = True
                                break
                            elif (
                                not isinstance(value, str)
                                and search.lower() in str(value).lower()
                            ):
                                search_match_in_flattened = True
                                break

                    # If we had dict fields and search was applied, we need to check if there was a match
                    # either in regular fields (handled by database query) or in flattened fields
                    if not search_match_in_flattened:
                        # Check if the item would have matched in non-dict fields
                        # If the queryset returned this item, it means it matched non-dict fields
                        # So we should keep it
                        pass  # Keep the item

                if include_item:
                    filtered_items.append(item)

            flattened_items = filtered_items

        # Return response with pagination metadata
        current_page = skip // limit if limit > 0 else 0
        total_pages = (filtered_count + limit - 1) // limit if limit > 0 else 1

        response_data = {
            "data": flattened_items,
            "pagination": {
                "total": total_count,
                "filtered": filtered_count,
                "skip": skip,
                "limit": limit,
                "current_page": current_page,
                "total_pages": total_pages,
                "has_next": (current_page + 1) < total_pages,
                "has_prev": current_page > 0,
            },
        }

        return Response(response_data)

    except Exception as e:
        return Response(
            {"error": f"Error fetching data: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def get_control_definition_record_detail(request, pretty_id):
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Check if record_id is a numeric ID or a pretty_id
        obj = None
        entity = "control_definition"

        # First try to get by numeric ID
        try:
            numeric_id = int(pretty_id)
            obj = db.first(entity, id=numeric_id)
        except ValueError:
            # record_id is not numeric, treat as pretty_id
            pass

        # If not found by ID, try to find by pretty_id
        if obj is None:
            # URL decode the pretty_id
            decoded_pretty_id = url_decode_pretty_id(pretty_id)

            # Get pretty_id configuration for this entity
            pretty_id_fields, separator = get_entity_pretty_id_config(
                cyberdb_schema, entity
            )

            if pretty_id_fields:
                # Parse the pretty_id into field values with relation resolution
                field_values = parse_pretty_id_with_relations(
                    decoded_pretty_id,
                    entity,
                    cyberdb_schema,
                    db,
                    pretty_id_fields,
                    separator,
                )

                # Build filter kwargs for the database query
                filter_kwargs = {}
                for field_name, field_value in field_values.items():
                    if field_value:  # Only add non-empty values
                        filter_kwargs[field_name] = field_value

                # Query the database with the parsed field values
                if filter_kwargs:
                    obj = db.first(entity, **filter_kwargs)

        if obj is None:
            return Response(
                {
                    "error": f"Record with id/pretty_id '{pretty_id}' not found in entity {entity}"
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # Filter controls by status="ko"
        is_observation = request.GET.get("isObservation", "false").lower() == "true"
        if is_observation:
            obj = obj.__class__.objects.prefetch_related(
                Prefetch(
                    "controls",
                    queryset=obj.controls.model.objects.filter(status="ko"),
                )
            ).get(pk=obj.pk)

        obj.ko_count = obj.controls.filter(status="ko").count()
        obj.ok_count = obj.controls.filter(status="ok").count()
        obj.na_count = obj.controls.filter(status="not_applicable").count()

        if is_observation:
            obj.total_count = obj.controls.filter(status="ko").count()
        else:
            obj.total_count = obj.controls.count()

        # Get maximum controls severity and confidence
        max_severities, max_confidence = get_max_severity_and_confidence(obj)
        obj.max_severity = max_severities
        obj.max_confidence = max_confidence

        # Serialize and return the object
        serialized = serialize_model(
            cyberdb_schema,
            obj,
            entity,
            additional_fields=[
                "ko_count",
                "ok_count",
                "na_count",
                "total_count",
                "max_severity",
                "max_confidence",
            ],
        )

        # Check if dict flattening is requested
        flatten_dict_param = request.GET.get("flatten_dict", "false").lower() == "true"

        if flatten_dict_param:
            # Identify dict fields for flattening
            entity_desc = cyberdb_schema[entity]
            dict_field_names = []
            for field_desc in entity_desc:
                if field_desc.annotation is dict or field_desc.annotation is Dict:
                    dict_field_names.append(field_desc.name)

            if dict_field_names:
                # Apply dict flattening to the single record
                flattened_data = apply_dict_flattening([serialized], dict_field_names)
                serialized = flattened_data[0] if flattened_data else serialized

        return Response(serialized)

    except Exception as e:
        return Response(
            {"error": f"Error processing record: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def get_control_definition_form_options(request, field_name):
    """Get available options for relation fields"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        if field_name in ["max_severity", "max_confidence"]:
            choices = (
                SEVERITY_RANKS if field_name == "max_severity" else CONFIDENCE_RANKS
            )
            return Response(
                {
                    "field": field_name,
                    "type": "enum",
                    "options": [
                        {
                            "value": k,
                            "label": k,
                        }
                        for k in choices.keys()
                    ],
                }
            )

        # Get the entity schema
        entity = "control_definition"
        entity_schema = cyberdb_schema[entity]
        if not entity_schema:
            return Response(
                {"error": f"Entity '{entity}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        entity_data = entity_schema.to_json()
        field_data = entity_data.get("fields", {}).get(field_name)

        if not field_data:
            return Response(
                {"error": f"Field '{field_name}' not found in entity '{entity}'"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Handle different field types that need options
        if field_data.get("referenced_entity"):
            # Get related entity records using the existing options endpoint
            related_entity = field_data.get("referenced_entity")
            if not related_entity:
                return Response(
                    {"error": f"No related entity specified for field '{field_name}'"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Get data from the database using the entity options endpoint
            db = CyberDB.from_default_config()
            if db is None:
                return Response(
                    {"error": "Database not available"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            # Get query parameters for search and limit
            limit = int(request.GET.get("limit", 100))
            search = request.GET.get("search")

            # Get the queryset
            queryset = db.request(related_entity)

            # Apply search if provided
            if search:
                # Get entity schema for search fields
                related_entity_schema = cyberdb_schema[related_entity]
                search_fields = []

                # Find text fields for searching
                for fname, fdata in (
                    related_entity_schema.to_json().get("fields", {}).items()
                ):
                    if fdata.get("type") in ["string", "text"]:
                        search_fields.append(fname)

                if search_fields:
                    # Create search query
                    search_queries = [
                        Q(**{f"{field}__icontains": search}) for field in search_fields
                    ]
                    search_query = reduce(operator.or_, search_queries)
                    queryset = queryset.filter(search_query)

            # Apply limit
            queryset = queryset[:limit]

            # Convert to list and create options
            items = list(queryset)
            options = []

            for item in items:
                # Try to get a meaningful representation
                display_value = str(item)

                # Try common display fields first
                for field in ["name", "title", "display_name", "label"]:
                    if hasattr(item, field):
                        display_value = getattr(item, field)
                        break

                options.append(
                    {
                        "value": item.id,
                        "label": display_value,
                    }
                )

            return Response(
                {
                    "field": field_name,
                    "type": "relation",
                    "entity": related_entity,
                    "options": options,
                }
            )

        elif field_data.get("choices"):
            # Return enum values
            values = field_data.get("choices", [])
            options = [{"value": val, "label": val} for val in values]

            return Response(
                {
                    "field": field_name,
                    "type": "enum",
                    "options": options,
                }
            )

        else:
            return Response(
                {"error": f"Field '{field_name}' does not support options"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    except Exception as e:
        return Response(
            {"error": f"Error fetching field options: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def get_control_definition_related_records(request, pretty_id):
    """
    Get records related to a specific control_definition record.
    This endpoint returns a map of entity types to their related records,
    filtered server-side instead of fetching all data and filtering client-side.
    """
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        entity = "control_definition"
        # Check if dict flattening is requested
        flatten_dict_param = request.GET.get("flatten_dict", "false").lower() == "true"
        is_observation = request.GET.get("isObservation", "false").lower() == "true"

        # First, get the main record using the same logic as get_record_detail
        obj = None

        # First try to get by numeric ID
        try:
            numeric_id = int(pretty_id)
            obj = db.first(entity, id=numeric_id)
        except ValueError:
            # record_id is not numeric, treat as pretty_id
            pass

        # If not found by ID, try to find by pretty_id
        if obj is None:
            # URL decode the pretty_id
            decoded_pretty_id = url_decode_pretty_id(pretty_id)

            # Get pretty_id configuration for this entity
            pretty_id_fields, separator = get_entity_pretty_id_config(
                cyberdb_schema, entity
            )

            if pretty_id_fields:
                # Parse the pretty_id into field values with relation resolution
                field_values = parse_pretty_id_with_relations(
                    decoded_pretty_id,
                    entity,
                    cyberdb_schema,
                    db,
                    pretty_id_fields,
                    separator,
                )

                # Build filter kwargs for the database query
                filter_kwargs = {}
                for field_name, field_value in field_values.items():
                    if field_value:  # Only add non-empty values
                        filter_kwargs[field_name] = field_value

                # Query the database with the parsed field values
                if filter_kwargs:
                    obj = db.first(entity, **filter_kwargs)

        if obj is None:
            return Response(
                {
                    "error": f"Record with id/pretty_id '{pretty_id}' not found in entity {entity}"
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # Serialize the main record to get field values
        main_record = serialize_model(cyberdb_schema, obj, entity)

        # Get the entity schema to identify relation fields
        entity_desc = cyberdb_schema[entity]
        related_data = {}
        related_schemas = {}
        related_dict_fields = {}  # Track dict fields for each related entity

        # First, initialize all possible related entities (even with empty arrays)
        for field_desc in entity_desc:
            # Skip if field doesn't have a relationship or doesn't have a referenced entity
            if not field_desc.has_relationship() or not field_desc.referenced_entity:
                continue

            referenced_entity_name = (
                field_desc.referenced_entity.name
                if hasattr(field_desc.referenced_entity, "name")
                else str(field_desc.referenced_entity)
            )

            # Initialize related data and schema for this entity type
            if referenced_entity_name not in related_data:
                related_data[referenced_entity_name] = []
                related_schemas[
                    referenced_entity_name
                ] = referenced_entity_name  # Just store entity name for now

                # If flattening is requested, identify dict fields for this related entity
                if flatten_dict_param:
                    try:
                        related_entity_desc = cyberdb_schema[referenced_entity_name]
                        dict_field_names = []
                        for related_field_desc in related_entity_desc:
                            if (
                                related_field_desc.annotation is dict
                                or related_field_desc.annotation is Dict
                            ):
                                dict_field_names.append(related_field_desc.name)
                        related_dict_fields[referenced_entity_name] = dict_field_names
                    except KeyError:
                        related_dict_fields[referenced_entity_name] = []

        # Now find all relation fields and populate actual data
        for field_desc in entity_desc:
            # Skip if field doesn't have a relationship or doesn't have a referenced entity
            if not field_desc.has_relationship() or not field_desc.referenced_entity:
                continue

            referenced_entity_name = (
                field_desc.referenced_entity.name
                if hasattr(field_desc.referenced_entity, "name")
                else str(field_desc.referenced_entity)
            )
            field_name = field_desc.name
            field_value = main_record.get(field_name)

            # Skip if field value is empty - but keep the empty array in related_data
            if not field_value:
                continue

            # Query related records based on field value
            related_records = []

            if isinstance(field_value, list):
                # Handle array/many-to-many relations
                for item in field_value:
                    if isinstance(item, dict) and "id" in item:
                        # Field value is already serialized with id
                        try:
                            related_obj = db.first(
                                referenced_entity_name, id=item["id"]
                            )
                            if related_obj:
                                related_records.append(related_obj)
                        except:
                            pass
                    elif isinstance(item, (int, str)):
                        # Field value is just an ID
                        try:
                            related_obj = db.first(referenced_entity_name, id=item)
                            if related_obj:
                                related_records.append(related_obj)
                        except:
                            pass
            elif isinstance(field_value, dict) and "id" in field_value:
                # Handle single foreign key relation
                try:
                    related_obj = db.first(referenced_entity_name, id=field_value["id"])
                    if related_obj:
                        related_records.append(related_obj)
                except:
                    pass
            elif isinstance(field_value, (int, str)):
                # Handle single foreign key relation (just ID)
                try:
                    related_obj = db.first(referenced_entity_name, id=field_value)
                    if related_obj:
                        related_records.append(related_obj)
                except:
                    pass

            # keep only controls with status "ko" for observations data
            if is_observation and field_name == "controls":
                related_records = [v for v in related_records if v.status == "ko"]

            # Serialize and add unique related records
            for related_obj in related_records:
                serialized_related = serialize_model(
                    cyberdb_schema, related_obj, referenced_entity_name
                )
                # Check if this record is already in the list (avoid duplicates)
                if not any(
                    r.get("id") == serialized_related.get("id")
                    for r in related_data[referenced_entity_name]
                ):
                    related_data[referenced_entity_name].append(serialized_related)

        # Apply dict flattening to related data if requested
        if flatten_dict_param:
            for entity_name, records in related_data.items():
                dict_field_names = related_dict_fields.get(entity_name, [])
                if dict_field_names and records:
                    flattened_records = apply_dict_flattening(records, dict_field_names)
                    related_data[entity_name] = flattened_records

        # Convert schemas to the format expected by frontend
        formatted_schemas = {}
        for entity_name in related_schemas.keys():
            # Get schema for related entity, filtering out reverse relations
            related_entity_desc = cyberdb_schema[entity_name]

            # Convert field descriptions to the format expected by frontend
            formatted_fields = {}
            for field_desc in related_entity_desc:
                # Skip reverse relations pointing back to the main entity
                if (
                    hasattr(field_desc, "referenced_entity")
                    and field_desc.referenced_entity
                ):
                    ref_entity_name = (
                        field_desc.referenced_entity.name
                        if hasattr(field_desc.referenced_entity, "name")
                        else str(field_desc.referenced_entity)
                    )
                    if ref_entity_name == entity:
                        continue

                # Get referenced entity name as string, not object
                referenced_entity_name = None
                if (
                    hasattr(field_desc, "referenced_entity")
                    and field_desc.referenced_entity
                ):
                    referenced_entity_name = (
                        field_desc.referenced_entity.name
                        if hasattr(field_desc.referenced_entity, "name")
                        else str(field_desc.referenced_entity)
                    )

                # Check if this is a dict field and flattening is requested
                is_dict_field = (
                    field_desc.annotation is dict or field_desc.annotation is Dict
                )
                if flatten_dict_param and is_dict_field:
                    # Skip the original dict field and add flattened fields instead
                    dict_field_names = related_dict_fields.get(entity_name, [])
                    if field_desc.name in dict_field_names:
                        # Get flattened columns for this dict field
                        flattened_columns = get_flattened_columns_from_sample_data(
                            related_data[entity_name], [field_desc.name]
                        )

                        # Add flattened fields to schema
                        for flat_column, flat_type in flattened_columns.items():
                            if flat_column.startswith(f"{field_desc.name}."):
                                display_name = flat_column.replace(
                                    f"{field_desc.name}.", ""
                                ).title()

                                # Convert inferred type to proper Python class annotation
                                if flat_type == "dict":
                                    annotation = "typing.Dict"
                                elif flat_type == "list":
                                    annotation = "typing.List"
                                elif flat_type == "boolean":
                                    annotation = "<class 'bool'>"
                                elif flat_type == "integer":
                                    annotation = "<class 'int'>"
                                elif flat_type == "number":
                                    annotation = "<class 'float'>"
                                elif flat_type == "string":
                                    annotation = "<class 'str'>"
                                elif flat_type == "null":
                                    annotation = "<class 'NoneType'>"
                                else:
                                    annotation = "<class 'str'>"  # fallback

                                formatted_fields[flat_column] = {
                                    "name": flat_column,
                                    "annotation": annotation,
                                    "referenced_entity": None,
                                    "is_linked_by_related_name": False,
                                    "choices": None,
                                    "nullable": True,
                                    "not_editable": True,
                                    "hidden_in_list": False,
                                    "pretty_name": None,
                                    "display_name": display_name,
                                    "description": f"Flattened field from {flat_column.split('.')[0]}",
                                }
                        continue  # Skip adding the original dict field

                formatted_fields[field_desc.name] = {
                    "name": field_desc.name,
                    "annotation": str(field_desc.annotation),
                    "referenced_entity": referenced_entity_name,
                    "is_linked_by_related_name": getattr(
                        field_desc, "is_linked_by_related_name", False
                    ),
                    "choices": getattr(field_desc, "choices", None),
                    "nullable": getattr(field_desc, "nullable", False),
                    "hidden_in_list": getattr(field_desc, "hidden_in_list", False),
                    "pretty_name": getattr(field_desc, "pretty_name", None),
                    "display_name": getattr(field_desc, "display_name", None),
                    "description": getattr(field_desc, "description", None),
                    # Add other field properties as needed
                }

            formatted_schemas[entity_name] = {
                "name": entity_name,
                "fields": formatted_fields,
            }

            # Control entity specific field ordering and visibility
            if entity_name == "control":
                order = [
                    ("status", True),
                    ("confidence", True),
                    ("severity", True),
                    ("details", True),
                    ("justification", False),
                    ("latest_run", False),
                ]
                original = formatted_schemas[entity_name]["fields"]
                new = {}
                for key, is_visible in order:
                    if key == "details":
                        for f in original.keys():
                            if f.startswith("details."):
                                new[f] = original[f]
                                new[f]["hidden_in_list"] = not is_visible
                    else:
                        if is_observation and key == "status":
                            continue

                        new[key] = original[key]
                        new[key]["hidden_in_list"] = not is_visible

                formatted_schemas[entity_name]["fields"] = new

        return Response(
            {"relatedData": related_data, "relatedSchemas": formatted_schemas}
        )

    except Exception as e:
        return Response(
            {"error": f"Error fetching related records: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
