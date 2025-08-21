import {
  FieldSchema,
  ColumnTypeInfo,
  ColumnVariant,
  EntitySchema,
} from "@/app/types/Data";

/**
 * Parse Python type annotation to determine column type information
 *
 * Examples of annotations:
 * - "<class 'str'>" -> text
 * - "<class 'int'>" -> number
 * - "<class 'datetime.date'>" -> date
 * - "<class 'datetime.datetime'>" -> date
 * - "<class 'bool'>" -> boolean
 * - "set[Entity(control_definition)]" -> relation (multiselect)
 * - "Entity(user)" -> relation (single)
 * - "list[str]" -> text array
 */
export function parseFieldAnnotation(field: FieldSchema): ColumnTypeInfo {
  const annotation = field.annotation.trim();

  // First check if this field has choices - if so, it's a select type regardless of annotation
  if (
    field.choices &&
    Array.isArray(field.choices) &&
    field.choices.length > 0
  ) {
    return {
      variant: "select",
      isArray: false,
      isRelation: false,
      baseType: "string",
    };
  }

  // Check for set/list collections
  const setMatch = annotation.match(/^set\[(.+)\]$/);
  const listMatch = annotation.match(/^list\[(.+)\]$/);

  if (setMatch || listMatch) {
    const innerType = setMatch?.[1] || listMatch?.[1] || "";

    // Check if it's a relation
    const entityMatch = innerType.match(/Entity\((.+)\)/);
    if (entityMatch) {
      return {
        variant: "multiSelect",
        isArray: true,
        isRelation: true,
        baseType: "relation",
        referencedEntity: entityMatch[1],
      };
    }

    // Handle list of primitive types
    const primitiveType = parseBasicType(innerType);
    return {
      variant: primitiveType.variant,
      isArray: true,
      isRelation: false,
      baseType: primitiveType.baseType,
    };
  }

  // Check for single entity relations
  const entityMatch = annotation.match(/Entity\((.+)\)/);
  if (entityMatch) {
    return {
      variant: "select",
      isArray: false,
      isRelation: true,
      baseType: "relation",
      referencedEntity: entityMatch[1],
    };
  }

  // Check for class annotations like "<class 'str'>"
  const classMatch = annotation.match(/<class '(.+)'>/);
  if (classMatch) {
    const className = classMatch[1];
    return {
      ...parseBasicType(className),
      isArray: false,
      isRelation: false,
    };
  }

  // Fallback to parsing as basic type
  return {
    ...parseBasicType(annotation),
    isArray: false,
    isRelation: false,
  };
}

function parseBasicType(typeStr: string): {
  variant: ColumnVariant;
  baseType: string;
} {
  const lowerType = typeStr.toLowerCase();

  if (lowerType.includes("str") || lowerType.includes("string")) {
    return { variant: "text", baseType: "string" };
  }

  if (
    lowerType.includes("int") ||
    lowerType.includes("integer") ||
    lowerType.includes("float") ||
    lowerType.includes("decimal") ||
    lowerType.includes("number")
  ) {
    return { variant: "number", baseType: "number" };
  }

  if (lowerType.includes("bool") || lowerType.includes("boolean")) {
    return { variant: "boolean", baseType: "boolean" };
  }

  if (lowerType.includes("date") || lowerType.includes("time")) {
    return { variant: "date", baseType: "date" };
  }

  if (lowerType.includes("dict") || lowerType.includes("jsonfield")) {
    return { variant: "text", baseType: "dict" };
  }

  // Default fallback
  return { variant: "text", baseType: "string" };
}

/**
 * Check if a field should be hidden initially in list view
 * This only affects initial visibility, not whether the column exists
 */
export function isHiddenInitially(field: FieldSchema): boolean {
  return field.hidden_in_list;
}

/**
 * Get display name for a field, preferring pretty_name over name
 */
export function getFieldDisplayName(field: FieldSchema): string {
  return field.pretty_name || field.display_name || field.name;
}

/**
 * Format field value based on its type
 */
/**
 * Check if a field can be used for bulk updates (not unique, not indexed, not read-only)
 */
export function isBulkUpdatable(field: FieldSchema): boolean {
  // Skip read-only fields
  if (field.name === "id" || field.name === "pretty_id") {
    return false;
  }

  // Skip reverse relation fields
  if (field.is_linked_by_related_name) {
    return false;
  }

  // Skip unique or indexed fields to avoid constraint violations
  if (field.unique || field.indexed) {
    return false;
  }

  return true;
}

/**
 * Get fields that are safe for bulk updates from a schema
 */
export function getBulkUpdatableFields(schema: EntitySchema): FieldSchema[] {
  if (!schema || !schema.fields) {
    return [];
  }

  return Object.values(schema.fields).filter(isBulkUpdatable);
}

export function formatFieldValue(value: any, typeInfo: ColumnTypeInfo): string {
  if (value === null || value === undefined) {
    return "—";
  }

  // Handle arrays - either actual arrays or stringified JSON arrays
  if (typeInfo.isArray) {
    let arrayValue: any[] = [];

    if (Array.isArray(value)) {
      arrayValue = value;
    } else if (typeof value === "string") {
      // Try to parse stringified JSON array
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          arrayValue = parsed;
        } else {
          // If it's not an array after parsing, treat as single item
          arrayValue = [parsed];
        }
      } catch {
        // If parsing fails, treat the string as a single item
        arrayValue = [value];
      }
    } else {
      // For other types, treat as single item
      arrayValue = [value];
    }

    if (typeInfo.isRelation) {
      // For relation arrays (many-to-many), look for repr field first, then fallback to other identifiers
      return arrayValue
        .map((item) => {
          if (typeof item === "object" && item !== null) {
            return (
              item.repr || item.name || item.title || item.id || String(item)
            );
          }
          return String(item);
        })
        .join(", ");
    } else {
      // For regular arrays (like tags), just join the string values
      return arrayValue.map((item) => String(item)).join(", ");
    }
  }

  // Handle single relation objects (one-to-many or foreign key relations)
  if (typeInfo.isRelation && typeof value === "object" && value !== null) {
    return value.repr || value.name || value.title || value.id || String(value);
  }

  switch (typeInfo.variant) {
    case "boolean":
      return value ? "Yes" : "No";

    case "number":
      return Number(value).toLocaleString();

    case "date":
      try {
        const date = new Date(value);
        // Check if the original value includes time information
        if (
          typeof value === "string" &&
          (value.includes("T") || (value.includes(" ") && value.includes(":")))
        ) {
          // This is a datetime, format with both date and time
          return (
            date.toLocaleDateString() +
            " at " +
            date.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })
          );
        } else {
          // This is a date-only, format just the date
          return date.toLocaleDateString();
        }
      } catch {
        return String(value);
      }

    default:
      return String(value);
  }
}

/**
 * Get filter options for select fields
 */
export function getFilterOptions(
  field: FieldSchema,
  typeInfo: ColumnTypeInfo
): Array<{ label: string; value: string }> | undefined {
  if (typeInfo.variant === "boolean") {
    return [
      { label: "Yes", value: "true" },
      { label: "No", value: "false" },
    ];
  }

  if (field.choices && Array.isArray(field.choices)) {
    return field.choices.map((choice) => ({
      label: String(choice),
      value: String(choice),
    }));
  }

  if (field.examples && Array.isArray(field.examples)) {
    return field.examples.map((example) => ({
      label: String(example),
      value: String(example),
    }));
  }

  // For relations, we'll fetch options dynamically
  if (typeInfo.isRelation && typeInfo.referencedEntity) {
    return []; // Will be populated dynamically
  }

  return undefined;
}

/**
 * Fetch relation options from the API
 */
export async function fetchRelationOptions(
  entity: string,
  api: any
): Promise<Array<{ label: string; value: string }>> {
  try {
    const response = await api.data.getEntityOptions(entity, { limit: 100 }); // Get first 100 options

    if (response.error) {
      console.warn(`API error for entity ${entity}:`, response.error);
      return [];
    }

    if (
      !response.data ||
      !Array.isArray(response.data) ||
      response.data.length === 0
    ) {
      return [];
    }

    const options = response.data.map(
      (item: { id: string | number; repr: string }) => ({
        label: item.repr || `Item ${item.id}`,
        value: String(item.id),
      })
    );

    return options;
  } catch (error) {
    console.error(
      `Exception while fetching options for entity ${entity}:`,
      error
    );
    return [];
  }
}
