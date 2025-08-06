import { EntityRecord, EntitySchema } from '@/app/types/Data';

// Component to get record title
export function getRecordTitle(schema: EntitySchema, record: EntityRecord): string {
    const entityDisplayName = schema.name.charAt(0).toUpperCase() + schema.name.slice(1);

    // First, try to find a field marked as repr
    const reprField = Object.values(schema.fields).find(field => (field as any).repr);
    if (reprField && record[reprField.name]) {
        const reprValue = record[reprField.name];
        if (typeof reprValue === 'object' && reprValue.repr) {
            return String(reprValue.repr);
        }
        return String(reprValue);
    }

    // If no repr field, try common name fields
    const nameFields = ['name', 'title', 'label', 'hostname', 'ip'];
    for (const fieldName of nameFields) {
        if (record[fieldName]) {
            const fieldValue = record[fieldName];
            if (typeof fieldValue === 'object' && fieldValue.repr) {
                return String(fieldValue.repr);
            }
            return String(fieldValue);
        }
    }

    // Fallback to pretty_id if available
    if (record.pretty_id) {
        return String(record.pretty_id);
    }

    // Last resort: use entity name with ID
    return `${entityDisplayName} #${record.id}`;
}
