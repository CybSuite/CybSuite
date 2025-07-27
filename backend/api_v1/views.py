from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.http import FileResponse
import json
import tempfile
import os
from functools import reduce
import operator
from django.db.models import Q

from .serializers import serialize_model
from .utils import get_db
from .navbar_application import nav_links

# Import the cyberdb_schema (you may need to adjust this import path)
try:
    from cybsuite.cyberdb import cyberdb_schema, CyberDB, pm_ingestors, pm_reporters
except ImportError:
    # Fallback or mock for development
    cyberdb_schema = None
    CyberDB = None
    pm_ingestors = None
    pm_reporters = None

@api_view(['GET'])
def get_navbar(request):
    """Get the navigation bar structure"""
    return Response(nav_links(request))

@api_view(['GET'])
def get_full_schema(request):
    """Get complete schema details for all entities"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    return Response(cyberdb_schema.to_json())


@api_view(['GET'])
def get_schema_names(request):
    """Get a list of all available schema names"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    names = [e.name for e in cyberdb_schema]
    return Response(names)


@api_view(['GET'])
def get_entity_schema(request, entity):
    """Get the detailed schema definition for a given entity"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    try:
        entity_data = cyberdb_schema[entity].to_json()
        return Response(entity_data)
    except KeyError:
        return Response(
            {"error": f"Entity '{entity}' not found"}, 
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
def get_entity_field_names(request, entity):
    """Get list of field names for a given entity"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    try:
        entity_schema = cyberdb_schema[entity]
        field_names = [e.name for e in entity_schema]
        return Response(field_names)
    except KeyError:
        return Response(
            {"error": f"Entity '{entity}' not found"}, 
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
def get_field_schema(request, entity, field):
    """Get details for a specific field in an entity"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    try:
        entity_schema = cyberdb_schema[entity]
    except KeyError:
        return Response(
            {"error": f"Entity '{entity}' not found"}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    try:
        field_data = entity_schema[field].to_json()
        return Response(field_data)
    except KeyError:
        return Response(
            {"error": f"Field '{field}' not found in entity '{entity}'"}, 
            status=status.HTTP_404_NOT_FOUND
        )


# Data Operations Endpoints
@api_view(['GET'])
def get_entity_data(request, entity):
    """Get paginated list of records from an entity with optional filters"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    try:
        # Get query parameters
        skip = int(request.GET.get('skip', 0))
        limit = None
        # limit = request.GET.get('limit')  # TODO: uncomment when pagination from backend is needed
        search = request.GET.get('search')
        filters = request.GET.get('filters')
        
        if limit:
            limit = int(limit)
        
        # Get the queryset
        queryset = db.request(entity)
        
        # Apply column filters if provided
        if filters:
            try:
                filter_dict = json.loads(filters)
                for field, value in filter_dict.items():
                    if value:  # Only apply non-empty filters
                        queryset = queryset.filter(**{f"{field}__icontains": value})
            except json.JSONDecodeError:
                return Response(
                    {"error": "Invalid filters format"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Apply global search if provided
        if search:
            # Get all fields from the model
            model_fields = queryset.model._meta.fields

            # Create a Q object for each field to search in
            q_objects = []
            for field in model_fields:
                # Only search in text and number fields
                if field.get_internal_type() in [
                    "CharField",
                    "TextField",
                    "IntegerField",
                    "FloatField",
                    "DecimalField",
                ]:
                    q_objects.append(Q(**{f"{field.name}__icontains": search}))

            # Combine all Q objects with OR operator
            if q_objects:
                queryset = queryset.filter(reduce(operator.or_, q_objects))

        # Apply skip and limit using Django slicing
        if limit:
            queryset = queryset[skip:skip + limit]
        else:
            queryset = queryset[skip:]

        # Convert QuerySet to list and serialize
        items = list(queryset)
        serialized_items = []
        for item in items:
            serialized = serialize_model(cyberdb_schema, item, entity)
            serialized_items.append(serialized)

        return Response(serialized_items)

    except Exception as e:
        return Response(
            {"error": f"Error fetching data: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET', 'PUT', 'PATCH'])
def get_record_detail(request, entity, record_id):
    """Get details of a single record by its ID, or update it with PUT/PATCH"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    try:
        # Get the object
        obj = db.first(entity, id=record_id)
        if obj is None:
            return Response(
                {"error": f"Record with id {record_id} not found in entity {entity}"}, 
                status=status.HTTP_404_NOT_FOUND
            )

        if request.method == 'GET':
            # Serialize and return the object
            serialized = serialize_model(cyberdb_schema, obj, entity)
            return Response(serialized)
        
        elif request.method == 'PUT':
            # Complete replacement
            data = request.data
            data['id'] = record_id
            
            # Perform the feed operation (will update existing)
            updated_obj = db.feed(entity, **data)
            serialized = serialize_model(cyberdb_schema, updated_obj, entity)
            return Response(serialized)
        
        elif request.method == 'PATCH':
            # Partial update
            current_data = serialize_model(cyberdb_schema, obj, entity)
            update_data = request.data
            
            # Merge current data with updates
            merged_data = {**current_data, **update_data}
            merged_data['id'] = record_id
            
            # Perform the feed operation
            updated_obj = db.feed(entity, **merged_data)
            serialized = serialize_model(cyberdb_schema, updated_obj, entity)
            return Response(serialized)

    except Exception as e:
        return Response(
            {"error": f"Error processing record: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_entity_options(request, entity):
    """Get simplified list of records for use in dropdowns/filters - returns only id and display representation"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    try:
        # Get query parameters
        limit = None
        # limit = request.GET.get('limit')  # TODO: uncomment when pagination from backend is needed
        search = request.GET.get('search')
        
        if limit:
            limit = int(limit)
        
        # Get the queryset
        queryset = db.request(entity)
        
        # Apply search if provided
        if search:
            # Get all fields from the model that can be searched
            model_fields = queryset.model._meta.fields
            
            # Create a Q object for each searchable field
            q_objects = []
            for field in model_fields:
                # Search in text fields and some common representation fields
                if field.get_internal_type() in [
                    "CharField",
                    "TextField",
                ] or field.name in ['name', 'title', 'display_name', 'label']:
                    q_objects.append(Q(**{f"{field.name}__icontains": search}))
            
            # Combine all Q objects with OR operator
            if q_objects:
                queryset = queryset.filter(reduce(operator.or_, q_objects))
        
        # Apply limit
        if limit:
            queryset = queryset[:limit]
        
        # Convert to list and create simplified options
        items = list(queryset)
        options = []
        
        for item in items:
            # Try to get a meaningful string representation
            # Priority: name > title > display_name > str(item) > id
            repr_value = None
            
            for attr in ['name', 'title', 'display_name', 'label']:
                if hasattr(item, attr):
                    value = getattr(item, attr)
                    if value:
                        repr_value = str(value)
                        break
            
            # Fallback to string representation or ID
            if not repr_value:
                repr_value = str(item) if str(item) != f"{entity} object" else f"#{item.id}"
            
            options.append({
                "id": item.id,
                "repr": repr_value
            })
        
        return Response(options)

    except Exception as e:
        return Response(
            {"error": f"Error fetching entity options: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_entity_count(request, entity):
    """Get count of records in an entity"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    try:
        # Get the queryset and count
        queryset = db.request(entity)
        count = queryset.count()
        
        return Response({"count": count})

    except Exception as e:
        return Response(
            {"error": f"Error counting records: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def create_record(request, entity):
    """Add a new record to an entity"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    try:
        # Get data from request
        data = request.data
        
        # Create new record (ensure no ID is passed for creation)
        if 'id' in data:
            del data['id']
        
        # Perform the feed operation to create
        obj = db.feed(entity, **data)

        # Serialize the resulting object
        serialized = serialize_model(cyberdb_schema, obj, entity)
        return Response(serialized, status=status.HTTP_201_CREATED)

    except Exception as e:
        return Response(
            {"error": f"Error creating record: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def create_new_record(request, entity):
    """Create a new entry in an entity"""
    return create_record(request, entity)


@api_view(['POST'])
def update_record(request, entity):
    """Update records in an entity"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    try:
        # Get data from request
        data = request.data
        
        # Ensure ID is provided for update
        if 'id' not in data:
            return Response(
                {"error": "ID is required for update operation"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        record_id = data['id']
        
        # Check if record exists
        obj = db.first(entity, id=record_id)
        if obj is None:
            return Response(
                {"error": f"Record with id {record_id} not found in entity {entity}"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Perform the feed operation
        updated_obj = db.feed(entity, **data)

        # Serialize the resulting object
        serialized = serialize_model(cyberdb_schema, updated_obj, entity)
        return Response(serialized)

    except Exception as e:
        return Response(
            {"error": f"Error updating record: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def feed_record(request, entity):
    """Upsert (create or update) a record in an entity"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    try:
        # Get data from request
        data = request.data
        
        # Perform the feed operation (upsert)
        obj = db.feed(entity, **data)

        # Serialize the resulting object
        serialized = serialize_model(cyberdb_schema, obj, entity)
        return Response(serialized)

    except Exception as e:
        return Response(
            {"error": f"Error feeding record: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['DELETE'])
def delete_record(request, entity, record_id):
    """Delete a record by its ID"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    try:
        # Get the object
        obj = db.first(entity, id=record_id)
        if obj is None:
            return Response(
                {"error": f"Record with id {record_id} not found in entity {entity}"}, 
                status=status.HTTP_404_NOT_FOUND
            )

        # Delete the object
        obj.delete()

        return Response({
            "status": "success",
            "message": f"Record {record_id} from entity {entity} has been deleted",
        })

    except Exception as e:
        return Response(
            {"error": f"Error deleting record: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# Ingest Operations Endpoints
@api_view(['GET'])
def list_ingestors(request):
    """Get a list of all available data ingestors"""
    if pm_ingestors is None:
        return Response(
            {"error": "Ingestors not available"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    ingestors = [{"name": plugin.name} for plugin in pm_ingestors]
    return Response(ingestors)


@api_view(['POST'])
def ingest_data(request, ingestor_name):
    """Ingest data using the specified ingestor plugin"""
    db = CyberDB.from_default_config()
    if db is None or pm_ingestors is None:
        return Response(
            {"error": "Database or ingestors not available"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    try:
        # Get uploaded file
        if 'file' not in request.FILES:
            return Response(
                {"error": "No file provided"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        file = request.FILES['file']
        content = file.read()

        # Get the ingestor plugin
        if ingestor_name not in [plugin.name for plugin in pm_ingestors]:
            return Response(
                {"error": f"Ingestor '{ingestor_name}' not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        ingestor = pm_ingestors[ingestor_name](db)

        # Run the ingestor
        result = ingestor.ingest(content)

        return Response({
            "status": "success",
            "message": f"Data ingested successfully using {ingestor_name}",
            "details": result,
        })

    except Exception as e:
        return Response(
            {"error": f"Error ingesting data: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# Report Operations Endpoints
@api_view(['GET'])
def generate_report(request, reporter_name):
    """Generate a report using the specified reporter and return it as a downloadable file"""
    db = CyberDB.from_default_config()
    if db is None or pm_reporters is None:
        return Response(
            {"error": "Database or reporters not available"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    try:
        # Check if reporter exists
        if reporter_name not in [plugin.name for plugin in pm_reporters]:
            return Response(
                {"error": f"Reporter '{reporter_name}' not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Create temporary file
        reporter = pm_reporters[reporter_name](db)
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=reporter.extension
        ) as tmp_file:
            temp_path = tmp_file.name

        # Generate the report
        reporter.run(temp_path)

        # Determine content type
        content_type = (
            "text/html" if reporter.extension == ".html" else "application/json"
        )

        # Return the file as a downloadable response
        response = FileResponse(
            open(temp_path, 'rb'),
            content_type=content_type,
            as_attachment=True,
            filename=f"report_{reporter_name}{reporter.extension}"
        )
        
        # Clean up temp file after response
        # Note: In production, you might want to use a background task for cleanup
        def cleanup():
            try:
                os.unlink(temp_path)
            except:
                pass
        
        # Store cleanup function for later use
        response.cleanup = cleanup
        
        return response

    except Exception as e:
        return Response(
            {"error": f"Error generating report: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# Plugin Operations Endpoints
@api_view(['GET'])
def get_reporters(request):
    """Get a list of all available reporters"""
    if pm_reporters is None:
        return Response(
            {"error": "Reporters not available"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    reporters = [{"name": plugin.name} for plugin in pm_reporters]
    return Response(reporters)


@api_view(['GET'])
def get_ingestors(request):
    """Get a list of all available ingestors"""
    if pm_ingestors is None:
        return Response(
            {"error": "Ingestors not available"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    ingestors = [{"name": plugin.name} for plugin in pm_ingestors]
    return Response(ingestors)
