import random
from typing import Dict

from api_v1 import example_categories, example_tags
from cybsuite.cyberdb import CyberDB, cyberdb_schema
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..utils import (
    get_empty_field_description,
    get_flattened_columns_from_sample_data,
    map_koalak_type_to_form_type,
)


@api_view(["GET"])
def get_full_schema(request):
    """Get complete schema details for all entities"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    entities_data = cyberdb_schema.to_json()

    # TODO: remove these temporary placeholders:
    for entity_data in entities_data["entities"]:
        entity_data["category"] = random.choice(example_categories)
        rando = random.randint(1, 4)
        entity_data["tags"] = random.sample(example_tags, k=rando)

    return Response(entities_data)


@api_view(["GET"])
def get_schema_names(request):
    """Get a list of all available schema names"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    names = [e.name for e in cyberdb_schema]
    return Response(names)


@api_view(["GET"])
def get_entity_schema(request, entity):
    """Get the detailed schema definition for a given entity"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        entity_data = cyberdb_schema[entity].to_json()

        # Check if dict flattening is requested
        flatten_dict_param = request.GET.get("flatten_dict", "false").lower() == "true"

        # Identify dict fields and get flattened columns only if requested
        if flatten_dict_param:
            db = CyberDB.from_default_config()
            if db is not None:
                entity_desc = cyberdb_schema[entity]
                dict_field_names = []
                for field_desc in entity_desc:
                    if field_desc.annotation is dict or field_desc.annotation is Dict:
                        dict_field_names.append(field_desc.name)

                if dict_field_names:
                    # Get flattened columns from sample data
                    sample = db.request(entity)[:100]
                    flattened_columns = get_flattened_columns_from_sample_data(
                        sample, dict_field_names
                    )

                    # The fields structure is a dictionary, not a list
                    fields_dict = entity_data.get("fields", {})

                    # Add flattened columns as new fields at the position of the original dict fields
                    # First, collect the flattened columns grouped by their source dict field
                    dict_field_positions = {}
                    field_keys = list(fields_dict.keys())

                    for dict_field_name in dict_field_names:
                        if dict_field_name in field_keys:
                            dict_field_positions[dict_field_name] = field_keys.index(
                                dict_field_name
                            )

                    # Create a new ordered fields dictionary
                    new_fields_dict = {}

                    for i, (field_name, field_data) in enumerate(fields_dict.items()):
                        if field_name not in dict_field_names:
                            # Add non-dict field
                            new_fields_dict[field_name] = field_data
                        else:
                            # This is a dict field - add its flattened columns here instead
                            for flat_column, flat_type in flattened_columns.items():
                                if flat_column.startswith(f"{field_name}."):
                                    display_name = flat_column.replace(
                                        f"{field_name}.", ""
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

                                    new_fields_dict[
                                        flat_column
                                    ] = get_empty_field_description(
                                        entity=entity,
                                        name=flat_column,
                                        display_name=display_name,
                                        annotation=annotation,
                                        description=f"Flattened field from {flat_column.split('.')[0]}",
                                    )

                    fields_dict = new_fields_dict
                    entity_data["fields"] = fields_dict

        # TODO: remove these temporary placeholders:
        entity_data["category"] = random.choice(example_categories)
        rando = random.randint(1, 4)
        entity_data["tags"] = random.sample(example_tags, k=rando)

        return Response(entity_data)
    except KeyError:
        return Response(
            {"error": f"Entity '{entity}' not found"}, status=status.HTTP_404_NOT_FOUND
        )


@api_view(["GET"])
def get_entity_field_names(request, entity):
    """Get list of field names for a given entity"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        entity_schema = cyberdb_schema[entity]
        field_names = [e.name for e in entity_schema]
        return Response(field_names)
    except KeyError:
        return Response(
            {"error": f"Entity '{entity}' not found"}, status=status.HTTP_404_NOT_FOUND
        )


@api_view(["GET"])
def get_field_schema(request, entity, field):
    """Get details for a specific field in an entity"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        entity_schema = cyberdb_schema[entity]
    except KeyError:
        return Response(
            {"error": f"Entity '{entity}' not found"}, status=status.HTTP_404_NOT_FOUND
        )

    try:
        field_data = entity_schema[field].to_json()
        return Response(field_data)
    except KeyError:
        return Response(
            {"error": f"Field '{field}' not found in entity '{entity}'"},
            status=status.HTTP_404_NOT_FOUND,
        )


# Additional Endpoints
@api_view(["GET"])
def get_schema_categories(request):
    """Get a list of all available entity categories"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        entities_data = cyberdb_schema.to_json()
        categories = set()

        for entity_data in entities_data["entities"]:
            if entity_data.get("category"):
                categories.add(entity_data["category"])

        categories = set(
            example_categories
        )  # TODO: remove this temporary placeholder when real data is available:

        return Response(sorted(list(categories)))
    except Exception as e:
        return Response(
            {"error": f"Error fetching categories: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def get_schema_tags(request):
    """Get a list of all available entity tags"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        entities_data = cyberdb_schema.to_json()
        tags = set()

        for entity_data in entities_data["entities"]:
            if entity_data.get("tags"):
                for tag in entity_data["tags"]:
                    tags.add(tag)

        tags = set(
            example_tags
        )  # TODO: remove this temporary placeholder when real data is available

        return Response(sorted(list(tags)))
    except Exception as e:
        return Response(
            {"error": f"Error fetching tags: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def get_entity_form_schema(request, entity):
    """Get form schema for creating/editing an entity"""
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

        form_schema = {
            "entity": entity,
            "fields": [],
            "required_fields": [],
        }

        # Process fields
        for field_name, field_desc in entity_schema._fields.items():
            # Skip system fields like id, created_at, updated_at
            if field_name in ["id", "created_at", "updated_at"]:
                continue

            if field_desc.is_linked_by_related_name:
                continue

            # Map koalak field types to form field types
            field_type = map_koalak_type_to_form_type(field_desc)
            field_required = field_desc.required

            # Build field schema
            field_schema = {
                "name": field_name,
                "type": field_type,
                "label": field_desc.display_name
                or field_name.replace("_", " ").title(),
                "required": field_required,
                "description": field_desc.description or "",
                "placeholder": "",
                "nullable": field_desc.nullable,
            }

            # Add type-specific configurations based on field type
            if field_type == "relation":
                field_schema["relation_entity"] = (
                    field_desc.referenced_entity.name
                    if field_desc.referenced_entity
                    else None
                )
                field_schema["multiple"] = field_desc.is_sequence()
            elif field_type == "enum" and field_desc.choices:
                field_schema["options"] = [
                    {"value": choice, "label": choice} for choice in field_desc.choices
                ]
            elif field_type == "boolean":
                # Use field default value
                default_value = field_desc.get_default()
                if default_value is not None and default_value != field_desc.NOTHING:
                    field_schema["default"] = bool(default_value)
                else:
                    field_schema["default"] = False
            elif field_type in ["integer", "number"]:
                field_schema["min"] = field_desc.min
                field_schema["max"] = field_desc.max
                field_schema["step"] = 1 if field_type == "integer" else "any"
            elif field_type in ["string", "text", "email", "url"]:
                field_schema["max_length"] = field_desc.max_length
                field_schema[
                    "min_length"
                ] = None  # Can be added to FieldDescription if needed
                field_schema[
                    "pattern"
                ] = None  # Can be added to FieldDescription if needed

            # Set default value if available and valid
            default_value = field_desc.get_default()
            if (
                default_value is not None
                and default_value != field_desc.NOTHING
                and default_value != ""
            ):
                field_schema["default"] = default_value

            form_schema["fields"].append(field_schema)

            if field_schema["required"]:
                form_schema["required_fields"].append(field_name)

        return Response(form_schema)

    except Exception as e:
        return Response(
            {"error": f"Error generating form schema: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
