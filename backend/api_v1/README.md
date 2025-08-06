# API v1 Endpoints

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
  - Query params: `skip`, `limit`, `search`, `filters` (JSON string)
  - Response includes `pretty_id` field for each record when configured
- `GET /api/v1/data/count/{entity}/` - Get record count
- `GET /api/v1/data/options/{entity}/` - Get entity options for dropdowns/filters
  - Query params: `limit` (default: 100), `search`
  - Response: `[{"id": 1, "repr": "Display Name"}, ...]`
  - Returns lightweight id/label pairs for UI components
- `POST /api/v1/data/new/{entity}/` - Create new entry
  - Payload: `{"field1": "value1", "field2": "value2", ...}`
- `POST /api/v1/data/feed/{entity}/` - Upsert record
  - Payload: `{"field1": "value1", "field2": "value2", ...}`
- `POST /api/v1/data/update/{entity}/` - Update record
  - Payload: `{"id": 123, "field1": "value1", ...}`
- `DELETE /api/v1/data/{entity}/{id_or_pretty_id}/` - Delete record
  - Supports both numeric IDs and URL-encoded pretty_id values

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

## Ingest Operations
- `GET /api/v1/ingest/plugins/` - List ingestors
- `POST /api/v1/ingest/{ingestor}/` - Ingest file data
  - Payload: multipart/form-data with `file` field

## Report Operations
- `GET /api/v1/report/{reporter}/` - Generate and download report

## Plugin Operations
- `GET /api/v1/plugins/reporters/` - List reporters
- `GET /api/v1/plugins/ingestors/` - List ingestors

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
