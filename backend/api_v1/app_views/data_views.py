import json
import operator
from functools import reduce
from typing import Dict

from cybsuite.cyberdb import CyberDB, cyberdb_schema, pm_formatters
from django.apps import apps
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.db.models import Prefetch, Q
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..pretty_id_utils import (
    get_entity_pretty_id_config,
    parse_pretty_id_with_relations,
    url_decode_pretty_id,
)
from ..serializers import serialize_model
from ..utils import (
    apply_dict_flattening,
    filter_data_table_queryset,
    format_validation_error,
    get_data_table_params,
    get_flattened_columns_from_sample_data,
)


# Data Operations Endpoints
@api_view(["GET"])
def get_entity_data(request, entity):
    """Get paginated list of records from an entity with optional filters, sorting, and search"""
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

        # Identify dict fields for flattening only if requested
        entity_desc = cyberdb_schema[entity]
        dict_field_names = []
        if flatten_dict_param:
            for field_desc in entity_desc:
                if field_desc.annotation is dict or field_desc.annotation is Dict:
                    dict_field_names.append(field_desc.name)

        # Get the queryset
        queryset = db.request(entity)

        # Get total count before applying filters (for pagination metadata)
        total_count = queryset.count()
        (queryset, filtered_count, _, _) = filter_data_table_queryset(
            queryset, table_params, dict_field_names
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
            serialized = serialize_model(cyberdb_schema, item, entity)
            serialized_items.append(serialized)

        # Apply dict flattening only if requested
        if flatten_dict_param and dict_field_names:
            flattened_items = apply_dict_flattening(serialized_items, dict_field_names)
        else:
            flattened_items = serialized_items

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
def get_record_detail(request, entity, pretty_id):
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Check if record_id is a numeric ID or a pretty_id
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

        # For observation_definition, filter controls by status="ko"
        if entity == "control_definition":
            is_observation = request.GET.get("isObservation", "false").lower() == "true"
            if is_observation and entity == "control_definition":
                obj = obj.__class__.objects.prefetch_related(
                    Prefetch(
                        "controls",
                        queryset=obj.controls.model.objects.filter(status="ko"),
                    )
                ).get(pk=obj.pk)

        # Serialize and return the object
        serialized = serialize_model(cyberdb_schema, obj, entity)

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
def get_entity_options(request, entity):
    """Get simplified list of records for use in dropdowns/filters - returns only id and display representation"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get query parameters
        limit = None
        # limit = request.GET.get('limit')  # TODO: uncomment when pagination from backend is needed
        search = request.GET.get("search")

        if limit:
            limit = int(limit)

        # Get the queryset
        queryset = db.request(entity)

        # Apply search if provided
        if search:
            # Get all fields from the model that can be searched
            model_fields = queryset.model._meta.fields

            # Create a Q object for each searchable field
            q_objects = []
            for field in model_fields:
                # Search in text fields and some common representation fields
                if field.get_internal_type() in [
                    "CharField",
                    "TextField",
                ] or field.name in ["name", "title", "display_name", "label"]:
                    q_objects.append(Q(**{f"{field.name}__icontains": search}))

            # Combine all Q objects with OR operator
            if q_objects:
                queryset = queryset.filter(reduce(operator.or_, q_objects))

        # Apply limit
        if limit:
            queryset = queryset[:limit]

        # Convert to list and create simplified options
        items = list(queryset)
        options = []

        for item in items:
            # Try to get a meaningful string representation
            # Priority: str(item) > name > title > display_name > id
            repr_value = None

            if str(item) != f"{entity} object":
                repr_value = str(item)
            else:
                for attr in ["name", "title", "display_name", "label"]:
                    if hasattr(item, attr):
                        value = getattr(item, attr)
                        if value:
                            repr_value = str(value)
                            break

                # Fallback to ID
                if repr_value is None:
                    repr_value = f"#{item.id}"

            options.append({"id": item.id, "repr": repr_value})

        return Response(options)

    except Exception as e:
        return Response(
            {"error": f"Error fetching entity options: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def get_entity_count(request, entity):
    """Get count of records in an entity"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get the queryset and count
        queryset = db.request(entity)
        count = queryset.count()

        return Response({"count": count})

    except Exception as e:
        return Response(
            {"error": f"Error counting records: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
def create_record(request, entity):
    """Add a new record to an entity"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get data from request
        data = request.data
        entity_desc = cyberdb_schema[entity]
        entity_meta = cyberdb_schema[entity].metadata
        model = apps.get_model(entity_meta["django_app_label"], entity)

        # Process related fields - separate from creation data
        create_data = dict(data)  # Copy to avoid modifying original
        m2m_data = {}

        for field in entity_desc:
            if field.referenced_entity is None or field.name not in create_data:
                continue

            field_value = create_data[field.name]

            if field.is_one_to_many_field():
                # For foreign key fields, use the ID directly
                if field_value is not None:
                    create_data[f"{field.name}_id"] = field_value
                # Remove the field name, keep only the _id version
                del create_data[field.name]
            else:
                # For many-to-many fields, store for later processing
                if isinstance(field_value, list):
                    m2m_data[field.name] = field_value
                    # Remove from create_data since M2M must be set after creation
                    del create_data[field.name]
                else:
                    # Single related object - treat as foreign key
                    if field_value is not None:
                        create_data[f"{field.name}_id"] = field_value
                    del create_data[field.name]

        # Create new record (ensure no ID is passed for creation)
        if "id" in create_data:
            del create_data["id"]

        # Create the object with processed data
        obj = model.objects.create(**create_data)

        # Handle many-to-many relationships after creation
        for field_name, related_ids in m2m_data.items():
            if hasattr(obj, field_name):
                m2m_field = getattr(obj, field_name)
                if related_ids:
                    m2m_field.set(related_ids)
                else:
                    m2m_field.clear()

        # Serialize the resulting object
        serialized = serialize_model(cyberdb_schema, obj, entity)
        return Response(serialized, status=status.HTTP_201_CREATED)

    except (DjangoValidationError, IntegrityError) as e:
        error_response = format_validation_error(e, entity)
        return Response(error_response, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response(
            {"error": f"Error creating record: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["PUT", "PATCH"])
def update_record(request, entity):
    """Update records in an entity"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get data from request
        data = request.data
        entity_desc = cyberdb_schema[entity]
        entity_meta = cyberdb_schema[entity].metadata
        model = apps.get_model(entity_meta["django_app_label"], entity)

        # Ensure ID is provided for update
        if "id" not in data:
            return Response(
                {"error": "ID is required for update operation"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        record_id = data["id"]
        entity_desc = cyberdb_schema[entity]

        # Filter out fields that are linked by related name (reverse foreign keys)
        # These are read-only computed fields and should not be updated
        filtered_data = {}
        for key, value in data.items():
            if key in ["id", "pretty_id"]:
                continue

            # Check if this field exists in the entity schema and is not a reverse relation
            field_desc = None
            for field in entity_desc:
                if field.name == key:
                    field_desc = field
                    break

            # Skip fields that are linked by related name (reverse foreign keys)
            if field_desc and field_desc.is_linked_by_related_name:
                continue

            # Include the field if it's a valid entity field
            if field_desc:
                filtered_data[key] = value
            else:
                print(f"Warning: Field '{key}' not found in entity schema, skipping")

        # Check if record exists
        obj = model.objects.get(pk=record_id)

        if not obj:
            return Response(
                {"error": f"Record with id {record_id} not found in entity {entity}"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Separate many-to-many fields from other fields
        m2m_updates = {}

        # Process related fields and update the object
        for field in entity_desc:
            if (
                field.referenced_entity is None
                or field.name not in filtered_data.keys()
            ):
                continue
            if field.is_linked_by_related_name:
                continue

            field_value = filtered_data[field.name]

            if field.is_one_to_many_field():
                # For foreign key fields, assign the ID instead of the object
                if field_value is not None:
                    setattr(obj, f"{field.name}_id", field_value)
                else:
                    setattr(obj, field.name, None)
                # Remove from filtered_data since we handled it
                del filtered_data[field.name]
            else:
                # For many-to-many fields, store for later processing
                if isinstance(field_value, list):
                    m2m_updates[field.name] = field_value
                    # Remove from filtered_data since we'll handle it separately
                    del filtered_data[field.name]
                else:
                    # Single related object - treat as foreign key
                    if field_value is not None:
                        setattr(obj, f"{field.name}_id", field_value)
                    else:
                        setattr(obj, field.name, None)
                    del filtered_data[field.name]

        # Update non-related fields
        for field, value in filtered_data.items():
            setattr(obj, field, value)

        # Save the object first
        obj.save()

        # Handle many-to-many relationships after saving
        for field_name, related_ids in m2m_updates.items():
            if hasattr(obj, field_name):
                m2m_field = getattr(obj, field_name)
                if related_ids:
                    m2m_field.set(related_ids)
                else:
                    m2m_field.clear()

        # Serialize the resulting object
        serialized = serialize_model(cyberdb_schema, obj, entity)
        return Response(serialized)

    except (DjangoValidationError, IntegrityError) as e:
        error_response = format_validation_error(e, entity)
        return Response(error_response, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response(
            {"error": f"Error updating record: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
def feed_record(request, entity):
    """Upsert (create or update) a record in an entity"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get data from request
        data = request.data

        # Perform the feed operation (upsert)
        obj = db.feed(entity, **data)

        # Serialize the resulting object
        serialized = serialize_model(cyberdb_schema, obj, entity)
        return Response(serialized)

    except Exception as e:
        return Response(
            {"error": f"Error feeding record: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["DELETE"])
def delete_record(request, entity, record_id):
    """Delete a record by its ID"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get the object
        obj = db.first(entity, id=record_id)
        if obj is None:
            return Response(
                {"error": f"Record with id {record_id} not found in entity {entity}"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Delete the object
        obj.delete()

        return Response(
            {
                "status": "success",
                "message": f"Record {record_id} from entity {entity} has been deleted",
            }
        )

    except Exception as e:
        return Response(
            {"error": f"Error deleting record: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["DELETE"])
def bulk_delete_records(request, entity):
    """Delete multiple records by their IDs"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get the list of IDs from request body
        record_ids = request.data.get("ids", [])

        if not record_ids:
            return Response(
                {"error": "No record IDs provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(record_ids, list):
            return Response(
                {"error": "IDs must be provided as a list"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Track results
        deleted_ids = []
        failed_ids = []
        errors = []

        # Delete each record
        for record_id in record_ids:
            try:
                obj = db.first(entity, id=record_id)
                if obj is None:
                    failed_ids.append(record_id)
                    errors.append(f"Record {record_id} not found")
                    continue

                obj.delete()
                deleted_ids.append(record_id)

            except Exception as e:
                failed_ids.append(record_id)
                errors.append(f"Error deleting record {record_id}: {str(e)}")

        # Prepare response
        response_data = {
            "status": "completed",
            "deleted_count": len(deleted_ids),
            "failed_count": len(failed_ids),
            "deleted_ids": deleted_ids,
            "failed_ids": failed_ids,
            "errors": errors,
        }

        # Determine HTTP status based on results
        if len(deleted_ids) == len(record_ids):
            # All records deleted successfully
            response_data[
                "message"
            ] = f"Successfully deleted {len(deleted_ids)} records from entity {entity}"
            return Response(response_data, status=status.HTTP_200_OK)
        elif len(deleted_ids) > 0:
            # Partial success
            response_data[
                "message"
            ] = f"Partially completed: deleted {len(deleted_ids)} records, failed to delete {len(failed_ids)} records"
            return Response(response_data, status=status.HTTP_207_MULTI_STATUS)
        else:
            # All failed
            response_data[
                "message"
            ] = f"Failed to delete any records from entity {entity}"
            return Response(response_data, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        return Response(
            {"error": f"Error processing bulk delete: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
def bulk_update_records(request, entity):
    """Update multiple records with the same values, only for fields without unique/index constraints"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get the data from request body
        request_data = request.data
        record_ids = request_data.get("ids", [])
        update_data = request_data.get("data", {})

        if not record_ids:
            return Response(
                {"error": "No record IDs provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(record_ids, list):
            return Response(
                {"error": "IDs must be provided as a list"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not update_data:
            return Response(
                {"error": "No update data provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate entity exists
        try:
            entity_desc = cyberdb_schema[entity]
        except KeyError:
            return Response(
                {"error": f"Entity '{entity}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Filter out fields with unique or index constraints
        allowed_fields = {}
        forbidden_fields = []

        for field_name, field_value in update_data.items():
            if field_name in ["id", "pretty_id"]:
                forbidden_fields.append(f"{field_name} (read-only)")
                continue

            # Find the field in schema
            field_desc = None
            for field in entity_desc:
                if field.name == field_name:
                    field_desc = field
                    break

            if not field_desc:
                forbidden_fields.append(f"{field_name} (field not found)")
                continue

            # Skip fields that are linked by related name (reverse foreign keys)
            if field_desc.is_linked_by_related_name:
                forbidden_fields.append(f"{field_name} (reverse relation)")
                continue

            # Check for unique or index constraints
            if field_desc.unique or field_desc.indexed:
                forbidden_fields.append(f"{field_name} (unique/indexed field)")
                continue

            # Field is allowed for bulk update
            allowed_fields[field_name] = field_value

        if forbidden_fields:
            return Response(
                {
                    "error": "Some fields cannot be bulk updated",
                    "forbidden_fields": forbidden_fields,
                    "allowed_fields": list(allowed_fields.keys()),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not allowed_fields:
            return Response(
                {"error": "No valid fields provided for bulk update"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Track results
        updated_ids = []
        failed_ids = []
        errors = []

        # Update each record
        for record_id in record_ids:
            try:
                obj = db.first(entity, id=record_id)
                if obj is None:
                    failed_ids.append(record_id)
                    errors.append(f"Record {record_id} not found")
                    continue

                # Prepare the update data for this record
                filtered_data = allowed_fields.copy()

                # Separate many-to-many fields from other fields
                m2m_updates = {}

                # Process related fields and update the object
                for field in entity_desc:
                    if (
                        field.referenced_entity is None
                        or field.name not in filtered_data.keys()
                    ):
                        continue
                    if field.is_linked_by_related_name:
                        continue

                    field_value = filtered_data[field.name]

                    if field.is_one_to_many_field():
                        # For foreign key fields, assign the ID instead of the object
                        if field_value is not None:
                            setattr(obj, f"{field.name}_id", field_value)
                        else:
                            setattr(obj, field.name, None)
                        # Remove from filtered_data since we handled it
                        del filtered_data[field.name]
                    elif field.is_many_to_many_field():
                        # For many-to-many fields, store for later processing
                        m2m_updates[field.name] = field_value
                        # Remove from filtered_data since we'll handle it separately
                        del filtered_data[field.name]

                # Update the remaining non-relational fields
                for field_name, field_value in filtered_data.items():
                    setattr(obj, field_name, field_value)

                # Save the object first for foreign key updates
                obj.save()

                # Handle many-to-many field updates after saving
                for field_name, field_value in m2m_updates.items():
                    if field_value is not None:
                        # Get the many-to-many manager
                        m2m_manager = getattr(obj, field_name)
                        # Clear existing relationships
                        m2m_manager.clear()
                        # Set new relationships if there are any
                        if field_value:
                            m2m_manager.set(field_value)

                updated_ids.append(record_id)

            except (DjangoValidationError, IntegrityError) as e:
                failed_ids.append(record_id)
                error_details = format_validation_error(e, entity)
                errors.append(
                    f"Record {record_id}: {error_details.get('error', str(e))}"
                )
            except Exception as e:
                failed_ids.append(record_id)
                errors.append(f"Error updating record {record_id}: {str(e)}")

        # Prepare response
        response_data = {
            "status": "completed",
            "updated_count": len(updated_ids),
            "failed_count": len(failed_ids),
            "updated_ids": updated_ids,
            "failed_ids": failed_ids,
            "errors": errors,
            "updated_fields": list(allowed_fields.keys()),
        }

        # Determine HTTP status based on results
        if len(updated_ids) == len(record_ids):
            # All records updated successfully
            response_data[
                "message"
            ] = f"Successfully updated {len(updated_ids)} records in entity {entity}"
            return Response(response_data, status=status.HTTP_200_OK)
        elif len(updated_ids) > 0:
            # Partial success
            response_data[
                "message"
            ] = f"Partially completed: updated {len(updated_ids)} records, failed to update {len(failed_ids)} records"
            return Response(response_data, status=status.HTTP_207_MULTI_STATUS)
        else:
            # All failed
            response_data[
                "message"
            ] = f"Failed to update any records in entity {entity}"
            return Response(response_data, status=status.HTTP_400_BAD_REQUEST)

    except (DjangoValidationError, IntegrityError) as e:
        error_response = format_validation_error(e, entity)
        return Response(error_response, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response(
            {"error": f"Error processing bulk update: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
def export_entity_data(request, entity):
    """Export entity data in the specified format"""
    db = CyberDB.from_default_config()
    if db is None or pm_formatters is None:
        return Response(
            {"error": "CyberDB or formatters not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get parameters from request
        format_name = request.data.get("format")
        fields = request.data.get("fields", [])
        export_scope = request.data.get("export_scope", "all")
        include_filters = request.data.get("include_filters", False)
        server_filters = request.data.get("server_filters")
        available_record_ids = request.data.get("available_record_ids", [])
        record_ids = request.data.get("record_ids", [])

        # Legacy support - only override if legacy parameters are explicitly provided
        export_all = request.data.get("export_all")
        if export_all is not None:
            # Legacy mode: use export_all to determine scope
            export_scope = "all" if export_all else "selected"

        if not format_name:
            return Response(
                {"error": "Format name is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Find the formatter plugin
        formatter_plugin = None
        for plugin in pm_formatters:
            if plugin.name == format_name:
                formatter_plugin = plugin
                break

        if not formatter_plugin:
            return Response(
                {"error": f"Formatter '{format_name}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get the entity model and queryset
        entity_desc = cyberdb_schema[entity]
        queryset = db.request(entity)

        # Build filtered queryset based on export scope
        if export_scope == "all":
            # Use all records - but for client-managed tables, respect available_record_ids
            if available_record_ids:
                # Client-managed table: use the provided available record IDs
                queryset = queryset.filter(id__in=available_record_ids)
            elif include_filters and server_filters:
                # Server-managed table: apply server-side filters using the same logic as get_entity_data
                filters = server_filters.get("filters", {})
                search = server_filters.get("search", "")

                # Construct table_params tuple like get_entity_data does
                table_params = (
                    0,  # skip
                    0,  # limit (no limit for export)
                    search,  # legacy search
                    None,  # legacy filters
                    None,  # sort_by
                    False,  # sort_desc
                    search,  # server_search
                    json.dumps(filters)
                    if filters
                    else None,  # server_filters (JSON string)
                    False,  # flatten_dict_param
                )

                # Use the same filtering logic as get_entity_data
                entity_desc = cyberdb_schema[entity]
                dict_field_names = []
                for field_desc in entity_desc:
                    if field_desc.annotation is dict or field_desc.annotation is Dict:
                        dict_field_names.append(field_desc.name)

                (queryset, filtered_count, _, _) = filter_data_table_queryset(
                    queryset, table_params, dict_field_names
                )
            # else: use all records from database (server-managed, no filters)

        elif export_scope == "filtered":
            # Use filtered records - either from server filters or client-provided IDs
            if include_filters and server_filters:
                # Apply server-side filters using the same logic as get_entity_data
                filters = server_filters.get("filters", {})
                search = server_filters.get("search", "")

                # Construct table_params tuple like get_entity_data does
                table_params = (
                    0,  # skip
                    0,  # limit (no limit for export)
                    search,  # legacy search
                    None,  # legacy filters
                    None,  # sort_by
                    False,  # sort_desc
                    search,  # server_search
                    json.dumps(filters)
                    if filters
                    else None,  # server_filters (JSON string)
                    False,  # flatten_dict_param
                )

                # Use the same filtering logic as get_entity_data
                entity_desc = cyberdb_schema[entity]
                dict_field_names = []
                for field_desc in entity_desc:
                    if field_desc.annotation is dict or field_desc.annotation is Dict:
                        dict_field_names.append(field_desc.name)

                (queryset, filtered_count, _, _) = filter_data_table_queryset(
                    queryset, table_params, dict_field_names
                )
            elif available_record_ids:
                # Use client-provided filtered record IDs
                queryset = queryset.filter(id__in=available_record_ids)
            else:
                return Response(
                    {
                        "error": "For filtered export, either server filters or available record IDs must be provided"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        elif export_scope == "selected":
            # Use selected records
            if record_ids:
                queryset = queryset.filter(id__in=record_ids)
            else:
                return Response(
                    {"error": "For selected export, record_ids must be provided"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            return Response(
                {
                    "error": f"Invalid export_scope: {export_scope}. Must be 'all', 'filtered', or 'selected'"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get field names if not provided
        if not fields:
            fields = [
                field.name for field in entity_desc if not field.name.startswith("_")
            ]

        # Convert queryset to list of dicts
        data = []
        for obj in queryset:
            record = {}
            serialized = serialize_model(cyberdb_schema, obj, entity)
            for field_name in fields:
                record[field_name] = serialized.get(field_name)
            data.append(record)

        # Create HTTP response with appropriate content type
        response = HttpResponse(content_type="application/octet-stream")

        # Set filename based on format
        filename = f"{entity}_export.{format_name}"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'

        # Use the formatter to write data
        formatter_instance = formatter_plugin()
        formatter_instance.format(data, response, fields)

        return response

    except KeyError:
        return Response(
            {"error": f"Entity '{entity}' not found"},
            status=status.HTTP_404_NOT_FOUND,
        )
    except Exception as e:
        return Response(
            {"error": f"Export failed: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# Additional Endpoints


@api_view(["GET"])
def get_entity_form_options(request, entity, field_name):
    """Get available options for relation fields"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get the entity schema
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
def get_related_records(request, entity, pretty_id):
    """
    Get records related to a specific entity record.
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
        # Check if dict flattening is requested
        flatten_dict_param = request.GET.get("flatten_dict", "false").lower() == "true"

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

        return Response(
            {"relatedData": related_data, "relatedSchemas": formatted_schemas}
        )

    except Exception as e:
        return Response(
            {"error": f"Error fetching related records: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
