from .pretty_id_utils import generate_pretty_id, get_entity_pretty_id_config


def serialize_model(cyberdb_schema, item, table_name):
    """Serialize a Django model instance"""
    if cyberdb_schema is None:
        return {}

    result = {}
    table_schema = cyberdb_schema[table_name]

    result["id"] = item.id

    # Add pretty_id if configured for this entity
    pretty_id_fields, separator = get_entity_pretty_id_config(
        cyberdb_schema, table_name
    )
    if pretty_id_fields:
        result["pretty_id"] = generate_pretty_id(item, pretty_id_fields, separator)

    # Iterate through field descriptions properly
    for field_description in table_schema:
        field_name = field_description.name
        value = getattr(item, field_name, None)

        if field_description.referenced_entity is not None:
            if field_description.is_one_to_many_field():
                if value:
                    # Get pretty_id for the related item
                    (
                        related_pretty_id_fields,
                        related_separator,
                    ) = get_entity_pretty_id_config(
                        cyberdb_schema, field_description.referenced_entity.name
                    )
                    related_pretty_id = None
                    if related_pretty_id_fields:
                        related_pretty_id = generate_pretty_id(
                            value, related_pretty_id_fields, related_separator
                        )

                    value = {
                        "id": value.id,
                        "repr": str(value),
                        "pretty_id": related_pretty_id,
                    }

            elif field_description.is_many_to_many_field():
                if value and hasattr(value, "exists") and value.exists():
                    # Get pretty_id configuration for the referenced entity
                    (
                        related_pretty_id_fields,
                        related_separator,
                    ) = get_entity_pretty_id_config(
                        cyberdb_schema, field_description.referenced_entity.name
                    )

                    value = [
                        {
                            "id": related_item.id,
                            "repr": str(related_item),
                            "pretty_id": generate_pretty_id(
                                related_item,
                                related_pretty_id_fields,
                                related_separator,
                            )
                            if related_pretty_id_fields
                            else None,
                        }
                        for related_item in value.all()
                    ]
                else:
                    value = []

            else:
                continue

        result[field_name] = value

    return result
