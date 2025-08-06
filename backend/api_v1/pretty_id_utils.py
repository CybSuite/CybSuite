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
    except (KeyError, AttributeError):
        return None, None
