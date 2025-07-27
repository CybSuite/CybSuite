import { FieldSchema, ColumnTypeInfo, ColumnVariant } from '@/app/types/Data';

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
  if (field.choices && Array.isArray(field.choices) && field.choices.length > 0) {
    return {
      variant: 'select',
      isArray: false,
      isRelation: false,
      baseType: 'string'
    };
  }
  
  // Check for set/list collections
  const setMatch = annotation.match(/^set\[(.+)\]$/);
  const listMatch = annotation.match(/^list\[(.+)\]$/);
  
  if (setMatch || listMatch) {
    const innerType = setMatch?.[1] || listMatch?.[1] || '';
    const isArray = true;
    
    // Check if it's a relation
    const entityMatch = innerType.match(/Entity\((.+)\)/);
    if (entityMatch) {
      return {
        variant: 'multiSelect',
        isArray: true,
        isRelation: true,
        baseType: 'relation',
        referencedEntity: entityMatch[1]
      };
    }
    
    // Handle list of primitive types
    const primitiveType = parseBasicType(innerType);
    return {
      variant: primitiveType.variant,
      isArray: true,
      isRelation: false,
      baseType: primitiveType.baseType
    };
  }
  
  // Check for single entity relations
  const entityMatch = annotation.match(/Entity\((.+)\)/);
  if (entityMatch) {
    return {
      variant: 'select',
      isArray: false,
      isRelation: true,
      baseType: 'relation',
      referencedEntity: entityMatch[1]
    };
  }
  
  // Check for class annotations like "<class 'str'>"
  const classMatch = annotation.match(/<class '(.+)'>/);
  if (classMatch) {
    const className = classMatch[1];
    return {
      ...parseBasicType(className),
      isArray: false,
      isRelation: false
    };
  }
  
  // Fallback to parsing as basic type
  return {
    ...parseBasicType(annotation),
    isArray: false,
    isRelation: false
  };
}

function parseBasicType(typeStr: string): { variant: ColumnVariant; baseType: string } {
  const lowerType = typeStr.toLowerCase();
  
  if (lowerType.includes('str') || lowerType.includes('string')) {
    return { variant: 'text', baseType: 'string' };
  }
  
  if (lowerType.includes('int') || lowerType.includes('integer') || 
      lowerType.includes('float') || lowerType.includes('decimal') ||
      lowerType.includes('number')) {
    return { variant: 'number', baseType: 'number' };
  }
  
  if (lowerType.includes('bool') || lowerType.includes('boolean')) {
    return { variant: 'boolean', baseType: 'boolean' };
  }
  
  if (lowerType.includes('date') || lowerType.includes('time')) {
    return { variant: 'date', baseType: 'date' };
  }
  
  // Default fallback
  return { variant: 'text', baseType: 'string' };
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
export function formatFieldValue(value: any, typeInfo: ColumnTypeInfo): string {
  if (value === null || value === undefined) {
    return '—';
  }
  
  if (typeInfo.isArray && Array.isArray(value)) {
    if (typeInfo.isRelation) {
      // For relation arrays (many-to-many), look for repr field first, then fallback to other identifiers
      return value.map(item => {
        if (typeof item === 'object' && item !== null) {
          return item.repr || item.name || item.title || item.id || String(item);
        }
        return String(item);
      }).join(', ');
    } else {
      return value.map(item => String(item)).join(', ');
    }
  }
  
  // Handle single relation objects (one-to-many or foreign key relations)
  if (typeInfo.isRelation && typeof value === 'object' && value !== null) {
    return value.repr || value.name || value.title || value.id || String(value);
  }
  
  switch (typeInfo.variant) {
    case 'boolean':
      return value ? 'Yes' : 'No';
      
    case 'number':
      return Number(value).toLocaleString();
      
    case 'date':
      try {
        return new Date(value).toLocaleDateString();
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
export function getFilterOptions(field: FieldSchema, typeInfo: ColumnTypeInfo): Array<{ label: string; value: string }> | undefined {
  if (typeInfo.variant === 'boolean') {
    return [
      { label: 'Yes', value: 'true' },
      { label: 'No', value: 'false' }
    ];
  }
  
  if (field.choices && Array.isArray(field.choices)) {
    return field.choices.map(choice => ({
      label: String(choice),
      value: String(choice)
    }));
  }
  
  if (field.examples && Array.isArray(field.examples)) {
    return field.examples.map(example => ({
      label: String(example),
      value: String(example)
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
export async function fetchRelationOptions(entity: string, api: any): Promise<Array<{ label: string; value: string }>> {
  try {
    const response = await api.data.getEntityOptions(entity, { limit: 100 }); // Get first 100 options
    
    if (response.error) {
      console.warn(`API error for entity ${entity}:`, response.error);
      return [];
    }
    
    if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
      return [];
    }
    
    const options = response.data.map((item: { id: string | number; repr: string }) => ({
      label: item.repr || `Item ${item.id}`,
      value: String(item.id)
    }));
    
    return options;
  } catch (error) {
    console.error(`Exception while fetching options for entity ${entity}:`, error);
    return [];
  }
}
