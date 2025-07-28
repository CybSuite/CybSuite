def serialize_model(cyberdb_schema, item, table_name):
    """Serialize a Django model instance"""
    if cyberdb_schema is None:
        return {}

    result = {}
    table_schema = cyberdb_schema[table_name]

    result["id"] = item.id

    for field_description in table_schema:
        value = getattr(item, field_description.name, None)
        if field_description.referenced_entity is not None:
            if field_description.is_one_to_many_field():
                if value:
                    value = {
                        "id": value.id,
                        "repr": str(value),
                    }

            elif field_description.is_many_to_many_field():
                if value and hasattr(value, "exists") and value.exists():
                    value = [
                        {
                            "id": related_item.id,
                            "repr": str(related_item),
                        }
                        for related_item in value.all()
                    ]
                else:
                    value = []

            else:
                continue

        result[field_description.name] = value

    return result
