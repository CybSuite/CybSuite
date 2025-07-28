# API v1 Endpoints

## Schema Operations
- `GET /api/v1/schema/full/` - Get complete schema
- `GET /api/v1/schema/names/` - Get schema names
- `GET /api/v1/schema/entity/{entity}/` - Get entity schema
- `GET /api/v1/schema/entity/{entity}/names/` - Get entity field names
- `GET /api/v1/schema/field/{entity}/{field}/` - Get field details

## Data Operations
- `GET /api/v1/data/record/{entity}/{id}/` - Get record details
- `POST /api/v1/data/record/{entity}/` - Create new record
  - Payload: `{"field1": "value1", "field2": "value2", ...}`
- `PUT /api/v1/data/record/{entity}/{id}/` - Replace record (complete update)
  - Payload: `{"field1": "value1", "field2": "value2", ...}`
- `PATCH /api/v1/data/record/{entity}/{id}/` - Partial update
  - Payload: `{"field1": "new_value1", ...}`
- `GET /api/v1/data/entity/{entity}/` - Get paginated list of records
  - Query params: `skip`, `limit`, `search`, `filters` (JSON string)
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
- `DELETE /api/v1/data/{entity}/{id}/` - Delete record

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
