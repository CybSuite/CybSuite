// Types for data entities and API responses

export interface EntityRecord {
  id?: string | number;
  [key: string]: any;
}

export interface FieldSchema {
  name: string;
  pretty_name: string;
  plural_name: string;
  display_name: string;
  dest: string | null;
  default: any;
  choices: any[] | null;
  annotation: string; // Python type annotation like "<class 'str'>" or "set[Entity(control_definition)]"
  description: string | null;
  examples: string[] | null;
  element_examples: any[] | null;
  indexed: boolean;
  unique: boolean;
  nullable: boolean;
  hidden_in_list: boolean;
  hidden_in_detail: boolean;
  in_filter_query: boolean;
  is_linked_by_related_name: boolean;
  entity: string;
  referenced_entity: string | null;
}

export interface EntitySchema {
  name: string;
  fields: {
    [fieldName: string]: FieldSchema;
  };
}

export interface DataListResponse<T = EntityRecord> {
  results: T[];
  count: number;
  next?: string;
  previous?: string;
}

export interface DataCountResponse {
  count: number;
}

// Helper types for column generation
export type ColumnVariant = 'text' | 'number' | 'select' | 'date' | 'boolean' | 'multiSelect';

export interface ColumnTypeInfo {
  variant: ColumnVariant;
  isArray: boolean;
  isRelation: boolean;
  baseType: string;
  referencedEntity?: string;
}
