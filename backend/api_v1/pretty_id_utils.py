"""
Utility functions for generating and parsing pretty_id values for entities.
Pretty ID is a human-readable identifier based on specific fields of an entity.
"""

import urllib.parse
from typing import Any, Dict, List

# Characters that are banned in pretty_id fields (from EntityDescription.BANNED_PRETTY_ID_CHARS)
BANNED_PRETTY_ID_CHARS = ["/", "\\", "?", "#", "%", "-"]


def escape_pretty_id_value(value: str, separator: str) -> str:
    """
    Escape a field value for use in pretty_id by adding backslashes before:
    1. The separator character (to avoid conflicts with field boundaries)
    2. Backslashes (to avoid escape sequence conflicts)

    Args:
        value: The field value to escape
        separator: The separator used between fields

    Returns:
        Escaped value safe for pretty_id concatenation
    """
    if not isinstance(value, str):
        value = str(value)

    # Escape backslashes first (order matters!)
    value = value.replace("\\", "\\\\")

    # Escape the separator character
    value = value.replace(separator, f"\\{separator}")

    return value


def unescape_pretty_id_value(escaped_value: str, separator: str) -> str:
    """
    Unescape a field value from pretty_id by removing backslashes.

    Args:
        escaped_value: The escaped field value
        separator: The separator used between fields

    Returns:
        Original unescaped value
    """
    # Unescape separator character
    escaped_value = escaped_value.replace(f"\\{separator}", separator)

    # Unescape backslashes (order matters - do this last!)
    escaped_value = escaped_value.replace("\\\\", "\\")

    return escaped_value


def generate_pretty_id(
    item: Any, pretty_id_fields: List[str], separator: str = "_"
) -> str:
    """
    Generate a pretty_id for an entity item based on specified fields.

    Args:
        item: The entity instance (Django model instance)
        pretty_id_fields: List of field names to use for pretty_id
        separator: Character to separate field values (default: '_')

    Returns:
        Generated pretty_id string with escaped values
    """
    if not pretty_id_fields:
        return str(item.id)

    values = []
    for field_name in pretty_id_fields:
        # Get the field value
        value = getattr(item, field_name, None)

        # Handle None values
        if value is None:
            value = ""

        # Convert to string and escape
        str_value = str(value)
        escaped_value = escape_pretty_id_value(str_value, separator)
        values.append(escaped_value)

    return separator.join(values)


def parse_pretty_id(
    pretty_id: str, pretty_id_fields: List[str], separator: str = "_"
) -> Dict[str, str]:
    """
    Parse a pretty_id string back into field values.

    Args:
        pretty_id: The pretty_id string to parse
        pretty_id_fields: List of field names that make up the pretty_id
        separator: Character that separates field values

    Returns:
        Dictionary mapping field names to their unescaped values
    """
    if not pretty_id_fields:
        return {}

    # Split the pretty_id while respecting escaped separators
    parts = []
    current_part = ""
    i = 0

    while i < len(pretty_id):
        if i < len(pretty_id) - 1 and pretty_id[i] == "\\":
            # This is an escape sequence, add both characters
            current_part += pretty_id[i : i + 2]
            i += 2
        elif pretty_id[i] == separator:
            # This is an unescaped separator, end current part
            parts.append(current_part)
            current_part = ""
            i += 1
        else:
            # Regular character
            current_part += pretty_id[i]
            i += 1

    # Add the last part
    if current_part or len(parts) < len(pretty_id_fields):
        parts.append(current_part)

    # Ensure we have the right number of parts
    while len(parts) < len(pretty_id_fields):
        parts.append("")

    # Create the result dictionary with unescaped values
    result = {}
    for i, field_name in enumerate(pretty_id_fields):
        if i < len(parts):
            result[field_name] = unescape_pretty_id_value(parts[i], separator)
        else:
            result[field_name] = ""

    return result


def parse_pretty_id_with_relations(
    pretty_id: str,
    entity_name: str,
    cyberdb_schema,
    cyberdb_instance,
    pretty_id_fields: List[str] = None,
    separator: str = "_",
) -> Dict[str, Any]:
    """
    Parse a pretty_id string back into field values, resolving relation fields to their IDs.

    Args:
        pretty_id: The pretty_id string to parse
        entity_name: Name of the entity this pretty_id belongs to
        cyberdb_schema: The schema object to get field type information
        cyberdb_instance: The database instance to query for related entities
        pretty_id_fields: List of field names that make up the pretty_id (if None, get from schema)
        separator: Character that separates field values

    Returns:
        Dictionary mapping field names to their values (with relation fields resolved to IDs)
    """
    # Get pretty_id configuration from schema if not provided
    if pretty_id_fields is None:
        pretty_id_fields, separator = get_entity_pretty_id_config(
            cyberdb_schema, entity_name
        )
        if not pretty_id_fields:
            return {}

    # First, parse the pretty_id normally to get string values
    parsed_values = parse_pretty_id(pretty_id, pretty_id_fields, separator)

    # Get entity schema to check field types
    try:
        entity_schema = cyberdb_schema[entity_name]
        entity_data = entity_schema.to_json()
        fields_info = entity_data.get("fields", {})
    except (KeyError, AttributeError):
        # If we can't get schema info, return the parsed values as-is
        return parsed_values

    # Process each field to resolve relations and convert types
    result = {}
    for field_name, field_value in parsed_values.items():
        if field_name in fields_info:
            field_info = fields_info[field_name]
            field_annotation = field_info.get("annotation", "")
            referenced_entity = field_info.get("referenced_entity")

            # Extract the actual type from annotation like "<class 'int'>"
            field_type = extract_type_from_annotation(field_annotation)

            # Check if this is a relation field (has referenced_entity)
            if referenced_entity:
                # This is a relation field, resolve the string representation to an ID
                related_entity_id = resolve_relation_string_to_id(
                    field_value, referenced_entity, cyberdb_instance, cyberdb_schema
                )

                if related_entity_id is not None:
                    result[field_name] = related_entity_id
                else:
                    # Couldn't resolve the relation, keep the original string
                    result[field_name] = field_value
            else:
                # Not a relation field, convert based on type
                result[field_name] = convert_field_value(field_value, field_type)
        else:
            # Field not in schema, keep the original value
            result[field_name] = field_value

    return result


def resolve_relation_string_to_id(
    string_representation: str,
    related_entity_name: str,
    cyberdb_instance,
    cyberdb_schema,
) -> Any:
    """
    Resolve a string representation of a related entity to its actual ID.

    Args:
        string_representation: The string representation (e.g., "192.168.0.10")
        related_entity_name: Name of the related entity (e.g., "host")
        cyberdb_instance: The database instance to query
        cyberdb_schema: The schema object

    Returns:
        The ID of the related entity, or None if not found
    """
    try:
        # Get all entities of the related type using the correct CyberDB API
        queryset = cyberdb_instance.request(related_entity_name)

        # Find the entity whose string representation matches
        for entity in queryset:
            if str(entity) == string_representation:
                return entity.id

        # If no exact match found, return None
        return None

    except Exception as e:
        return None


def url_encode_pretty_id(pretty_id: str) -> str:
    """
    URL encode a pretty_id for safe use in URLs.

    Args:
        pretty_id: The pretty_id string

    Returns:
        URL-encoded pretty_id
    """
    return urllib.parse.quote(pretty_id, safe="")


def url_decode_pretty_id(encoded_pretty_id: str) -> str:
    """
    URL decode a pretty_id from URL parameters.

    Args:
        encoded_pretty_id: The URL-encoded pretty_id

    Returns:
        Original pretty_id string
    """
    return urllib.parse.unquote(encoded_pretty_id)


def get_entity_pretty_id_config(cyberdb_schema, entity_name: str) -> tuple:
    """
    Get the pretty_id configuration for an entity.

    Args:
        cyberdb_schema: The schema object
        entity_name: Name of the entity

    Returns:
        Tuple of (pretty_id_fields, separator) or (None, None) if not found
    """
    try:
        entity_schema = cyberdb_schema[entity_name]
        pretty_id_fields = getattr(entity_schema, "pretty_id_fields", None)
        separator = getattr(entity_schema, "pretty_id_fields_separator", "_")
        # Handle case where pretty_id_fields is a string (single field)
        if isinstance(pretty_id_fields, str):
            pretty_id_fields = [pretty_id_fields]

        return pretty_id_fields, separator
    except (KeyError, AttributeError) as e:
        return None, None


def convert_field_value(value: str, field_type: str) -> Any:
    """
    Convert a string value to the appropriate type based on the field type.

    Args:
        value: The string value to convert
        field_type: The type of the field (e.g., 'int', 'float', 'bool', 'str')

    Returns:
        The converted value with the appropriate type
    """
    if not value or value == "":
        return value

    try:
        # Handle different field types
        if field_type in ["int", "integer"]:
            return int(value)
        elif field_type in ["float", "decimal", "number"]:
            return float(value)
        elif field_type in ["bool", "boolean"]:
            # Handle various boolean representations
            if value.lower() in ["true", "1", "yes", "on"]:
                return True
            elif value.lower() in ["false", "0", "no", "off"]:
                return False
            else:
                # If it's not a clear boolean, try to convert to int first
                try:
                    int_val = int(value)
                    return bool(int_val)
                except ValueError:
                    return value  # Keep as string if can't parse
        else:
            # For string types or unknown types, keep as string
            return value
    except (ValueError, TypeError):
        # If conversion fails, return the original string value
        return value


def extract_type_from_annotation(annotation: str) -> str:
    """
    Extract the simple type name from a Python type annotation.

    Args:
        annotation: Type annotation string like "<class 'int'>" or "str"

    Returns:
        Simple type name like 'int', 'float', 'str', etc.
    """
    if not annotation:
        return "str"

    # Handle Python class annotations like "<class 'int'>"
    if annotation.startswith("<class '") and annotation.endswith("'>"):
        return annotation[8:-2]  # Extract 'int' from "<class 'int'>"

    # Handle simple type names
    annotation_lower = annotation.lower()
    if "int" in annotation_lower:
        return "int"
    elif "float" in annotation_lower:
        return "float"
    elif "bool" in annotation_lower:
        return "bool"
    else:
        return "str"
