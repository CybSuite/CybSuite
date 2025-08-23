# API v1 Endpoints

## Control Definition with Controls (Custom Views)

These endpoints provide merged schema and data for control definitions along with their associated controls.

- `GET /api/v1/schema/entity/control_definition_w_controls/` – Get merged schema for control_definition_w_controls
- `GET /api/v1/data/entity/control_definition_w_controls/` – Get merged data for control_definition_w_controls
- `GET /api/v1/data/record/control_definition_w_controls/{pretty_id}/` – Get record detail for control_definition_w_controls by pretty_id
- `GET /api/v1/data/related/control_definition_w_controls/{pretty_id}/` – Get related records for control_definition_w_controls by pretty_id
- `GET /api/v1/form/options/control_definition_w_controls/{field_name}/` – Get form options for control_definition_w_controls

## Navigation Operations
- `GET /api/v1/nav_links/` - Get navigation bar structure for the frontend

## Schema Operations
- `GET /api/v1/schema/full/` - Get complete schema
- `GET /api/v1/schema/names/` - Get schema names
- `GET /api/v1/schema/entity/{entity}/` - Get entity schema
- `GET /api/v1/schema/entity/{entity}/names/` - Get entity field names
- `GET /api/v1/schema/field/{entity}/{field}/` - Get field details
- `GET /api/v1/schema/categories/` - Get list of all available entity categories
  - Returns: `["category1", "category2", ...]`
- `GET /api/v1/schema/tags/` - Get list of all available entity tags
  - Returns: `["tag1", "tag2", ...]`

## Data Operations
- `GET /api/v1/data/record/{entity}/{id_or_pretty_id}/` - Get record details by ID or pretty_id
  - Supports both numeric IDs and URL-encoded pretty_id values
  - pretty_id is a human-readable identifier based on entity-specific fields
- `POST /api/v1/data/record/{entity}/` - Create new record
  - Payload: `{"field1": "value1", "field2": "value2", ...}`
- `PUT /api/v1/data/record/{entity}/{id_or_pretty_id}/` - Replace record (complete update)
  - Supports both numeric IDs and URL-encoded pretty_id values
  - Payload: `{"field1": "value1", "field2": "value2", ...}`
- `PATCH /api/v1/data/record/{entity}/{id_or_pretty_id}/` - Partial update
  - Supports both numeric IDs and URL-encoded pretty_id values
  - Payload: `{"field1": "new_value1", ...}`
- `GET /api/v1/data/entity/{entity}/` - Get paginated list of records
  - Query params: `skip`, `limit`, `search`, `filters` (JSON string), `flatten_dict` (boolean)
  - Response includes `pretty_id` field for each record when configured
  - `flatten_dict=true` enables flattening of dict/JSON fields into separate columns
- `GET /api/v1/data/count/{entity}/` - Get record count
- `GET /api/v1/data/options/{entity}/` - Get entity options for dropdowns/filters
  - Query params: `limit` (default: 100), `search`
  - Response: `[{"id": 1, "repr": "Display Name"}, ...]`
  - Returns lightweight id/label pairs for UI components
- `POST /api/v1/data/new/{entity}/` - Create new entry (alias for record creation)
  - Payload: `{"field1": "value1", "field2": "value2", ...}`
- `POST /api/v1/data/feed/{entity}/` - Upsert record
  - Payload: `{"field1": "value1", "field2": "value2", ...}`
- `POST /api/v1/data/update/{entity}/` - Update record
  - Payload: `{"id": 123, "field1": "value1", ...}`
- `DELETE /api/v1/data/{entity}/{id_or_pretty_id}/` - Delete record
  - Supports both numeric IDs and URL-encoded pretty_id values
- `POST /api/v1/data/bulk-delete/{entity}/` - Bulk delete multiple records
  - Payload: `{"ids": [1, 2, 3, ...]}`
  - Returns detailed status for each deletion attempt
  - Response: `{"status": "completed", "deleted_count": 2, "failed_count": 1, "deleted_ids": [1, 2], "failed_ids": [3], "errors": ["Record 3 not found"]}`
- `POST /api/v1/data/bulk-update/{entity}/` - Bulk update multiple records
  - Payload: `{"ids": [1, 2, 3, ...], "data": {"field1": "new_value", ...}}`
  - Only allows updates to fields without unique/index constraints
  - Automatically filters out read-only fields (id, pretty_id) and reverse relations
  - Returns detailed status for each update attempt
  - Response: `{"status": "completed", "updated_count": 2, "failed_count": 1, "updated_ids": [1, 2], "failed_ids": [3], "updated_fields": ["field1"], "errors": ["Record 3 not found"]}`

## Pretty ID System

The API now supports **pretty_id** - human-readable identifiers for entities based on specific field combinations.

### Features:
- **Human-readable URLs**: Instead of `/data/service/123`, use `/data/service/192.168.1.1_80_tcp`
- **Field-based identification**: Based on entity schema's `pretty_id_fields` configuration
- **URL-safe encoding**: Automatically handles special characters in field values
- **Backwards compatible**: Still accepts numeric IDs for all operations

### Configuration:
Pretty ID behavior is defined in entity schema files (e.g., `service.yaml`):
```yaml
pretty_id_fields: ['host', 'port', 'protocol']  # Fields to include
# pretty_id_fields_separator: '_'  # Optional, defaults to '_'
```

### API Response Format:
All entity data endpoints now include a `pretty_id` field:
```json
{
  "id": 123,
  "pretty_id": "192.168.1.1_80_tcp",
  "host": "192.168.1.1",
  "port": 80,
  "protocol": "tcp"
}
```

### URL Encoding:
Pretty IDs are URL-encoded when used in paths to handle special characters:
- Original: `host with spaces_443_https`
- URL path: `/data/service/host%20with%20spaces_443_https`

### Field Value Escaping:
Field values containing the separator character are automatically escaped:
- Field value: `web_server` (contains separator `_`)
- Pretty ID: `192.168.1.1_web\_server_80_tcp` (separator escaped as `\_`)

## Dict/JSON Field Flattening

Several data endpoints support automatic flattening of dict/JSON fields into separate columns for easier querying and display.

### Features:
- **Dynamic Column Expansion**: Dict fields are automatically expanded into separate columns
- **Nested Key Support**: Handles nested dictionary structures with dot notation
- **Query Parameter Control**: Use `flatten_dict=true` to enable flattening
- **Post-processing Filters**: Search and filter work on flattened fields

### Usage:
Add `flatten_dict=true` query parameter to these endpoints:
- `GET /api/v1/data/entity/{entity}/?flatten_dict=true`
- `GET /api/v1/data/record/{entity}/{id}/?flatten_dict=true`
- `GET /api/v1/schema/entity/{entity}/?flatten_dict=true`

### Example:
Original record with dict field:
```json
{
  "id": 1,
  "name": "service1",
  "details": {"host": "192.168.1.1", "config": {"ssl": true}}
}
```

Flattened response:
```json
{
  "id": 1,
  "name": "service1",
  "details.host": "192.168.1.1",
  "details.config.ssl": true
}
```

## Ingest Operations
- `GET /api/v1/ingest/plugins/` - List ingestors
- `POST /api/v1/ingest/{ingestor}/` - Ingest file data
  - Payload: multipart/form-data with `file` field


## Report Operations
- `GET /api/v1/report/data/{reporter_name}/` - Get raw data for a report (JSON or other format)
- `GET /api/v1/report/{reporter}/` - Generate and download report

## Plugin Operations
- `GET /api/v1/plugins/reporters/` - List reporters
- `GET /api/v1/plugins/ingestors/` - List ingestors

## Form Operations
- `GET /api/v1/form/schema/{entity}/` - Get form schema for creating/editing an entity
  - Returns: Form configuration with field types, validation rules, and options
  - Response includes field metadata for rendering dynamic forms
  - Automatically excludes system fields (id, created_at, updated_at) and reverse relations
  - Response format: `{"entity": "entity_name", "fields": [...], "required_fields": [...]}`
  - Each field includes: `name`, `type`, `label`, `required`, `description`, `placeholder`, `nullable`
  - Relation fields include `relation_entity` and `multiple` properties
  - Enum fields include `options` array with value/label pairs
- `GET /api/v1/form/options/{entity}/{field_name}/` - Get available options for form fields
  - Returns options for enum fields and relation field choices
  - Used by form components for dropdowns and select inputs
  - For relation fields: Returns `{"options": [{"value": 1, "label": "Display Name"}, ...]}`
  - For enum fields: Returns `{"options": [{"value": "choice1", "label": "Choice 1"}, ...]}`

## Entity Options API Details

### `/api/v1/data/options/{entity}/`

This endpoint provides lightweight API access for fetching entity records formatted for dropdown menus, filter options, and other UI components.

**Features:**
- **Lightweight Response**: Returns only `id` and `repr` fields instead of full entity data
- **Smart Display Names**: Automatically determines best representation from `name`, `title`, `display_name`, `label` fields, or falls back to string representation
- **Search Support**: Filter options by search term across relevant text fields
- **Reasonable Limits**: Default limit of 100 items

**Parameters:**
- `entity` (path): Entity name
- `limit` (query, optional): Max options to return (default: 100)
- `search` (query, optional): Search term filter

**Response Format:**
```json
[
  {"id": 1, "repr": "Display Name or Title"},
  {"id": 2, "repr": "Another Item Name"}
]
```

**Use Cases:**
- Filter dropdowns for relation fields
- Form select options for foreign keys
- Autocomplete components with search

**Example:**
```javascript
// Get searchable control_definition options
const options = await api.data.getEntityOptions('control_definition', {
  limit: 50,
  search: 'security'
});
```
