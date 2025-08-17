import {
  FormFieldConfig,
  FormFieldOption,
} from "../components/data/form/index";
import { FieldSchema } from "@/app/types/Data";

// Convert from EntityFormDialog's FormFieldConfig to a unified format
export function normalizeFormFieldConfig(
  config: FormFieldConfig
): FormFieldConfig {
  return config; // Already in the right format
}

// Convert from BulkUpdateDialog's FieldSchema to FormFieldConfig format
export function convertFieldSchemaToFormFieldConfig(
  field: FieldSchema,
  options: FormFieldOption[] = []
): FormFieldConfig {
  return {
    name: field.name,
    type: mapFieldType(field.annotation, field),
    label: field.pretty_name || field.display_name || field.name,
    required: !field.nullable,
    nullable: field.nullable,
    description: field.description || undefined,
    placeholder: undefined, // FieldSchema doesn't have placeholder
    relation_entity: field.referenced_entity || undefined,
    multiple: isArrayType(field.annotation),
    options:
      options.length > 0
        ? options
        : field.choices
        ? field.choices.map((choice) => ({
            value: choice,
            label: String(choice),
          }))
        : undefined,
    default: field.default !== null ? field.default : undefined,
    min: undefined,
    max: undefined,
    step: undefined,
    max_length: undefined,
    min_length: undefined,
    pattern: undefined,
  };
}

// Check if a type annotation represents an array/set type
function isArrayType(annotation: string): boolean {
  return /^(set|list|array)\[/.test(annotation) || annotation.includes("[]");
}

// Map Python type annotations to form field types
function mapFieldType(annotation: string, field: FieldSchema): string {
  // Handle relation fields first
  if (field.referenced_entity) {
    return "relation";
  }

  // Handle choice fields
  if (field.choices && field.choices.length > 0) {
    return "enum";
  }

  // Handle array/set types
  if (isArrayType(annotation)) {
    // Extract inner type from set[...] or list[...]
    const innerTypeMatch = annotation.match(/^(set|list|array)\[(.+)\]/);
    if (innerTypeMatch) {
      const innerType = innerTypeMatch[2];
      if (innerType.includes("int") || innerType.includes("float")) {
        return "number_tags";
      }
      return "tags";
    }
    return "tags";
  }

  // Handle basic types based on Python type annotations
  if (annotation.includes("'str'") || annotation.includes("str")) {
    // Check if it's a long text field based on field name patterns
    const isTextField = /text|description|content|message|body|note/i.test(
      field.name
    );
    return isTextField ? "text" : "string";
  }

  if (annotation.includes("'int'") || annotation.includes("int")) {
    return "integer";
  }

  if (
    annotation.includes("'float'") ||
    annotation.includes("float") ||
    annotation.includes("decimal")
  ) {
    return "float";
  }

  if (annotation.includes("'bool'") || annotation.includes("bool")) {
    return "boolean";
  }

  if (annotation.includes("datetime")) {
    return "datetime";
  }

  if (annotation.includes("date")) {
    return "date";
  }

  if (annotation.includes("dict") || annotation.includes("json")) {
    return "json";
  }

  // Default fallback
  return "string";
}
