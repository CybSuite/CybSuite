from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.http import JsonResponse
from django.conf import settings


@api_view(['GET'])
def health_check(request):
    """Health check endpoint - available in all environments"""
    return Response({
        'status': 'ok',
        'message': 'Django backend is running',
        'version': '1.0.0',
        'environment': 'development' if settings.DEV else 'production',
        'debug_mode': settings.DEBUG
    })


@api_view(['GET', 'POST'])
def api_test(request):
    """Test endpoint for development - only available when DEV=True"""
    if request.method == 'GET':
        return Response({
            'method': 'GET',
            'message': 'Successfully connected to Django API (DEV MODE)',
            'data': {
                'timestamp': '2025-06-29',
                'server': 'Django REST Framework',
                'environment': 'development',
                'debug_enabled': settings.DEBUG,
                'dev_mode': settings.DEV
            }
        })
    
    elif request.method == 'POST':
        return Response({
            'method': 'POST',
            'message': 'Data received successfully (DEV MODE)',
            'received_data': request.data,
            'environment': 'development',
            'debug_enabled': settings.DEBUG
        }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def system_info(request):
    """Detailed system information - only available in development"""
    import sys
    import django
    
    return Response({
        'system': {
            'python_version': sys.version,
            'django_version': django.get_version(),
            'environment': 'development' if settings.DEV else 'production',
            'debug': settings.DEBUG,
            'dev_mode': settings.DEV,
        },
        'api': {
            'test_endpoints_enabled': settings.ENABLE_TEST_ENDPOINTS,
            'cors_allowed_origins': getattr(settings, 'CORS_ALLOWED_ORIGINS', []),
            'allowed_hosts': settings.ALLOWED_HOSTS,
        }
    })


def health_root(request):
    """Health app root endpoint"""
    endpoints = {
        'health': '/health/check/',
    }
    
    # Only show dev endpoints in development
    if settings.DEV and settings.ENABLE_TEST_ENDPOINTS:
        endpoints.update({
            'test': '/health/test/',
            'system': '/health/system/',
        })
    
    return JsonResponse({
        'message': 'CybSuite Health Monitoring API',
        'environment': 'development' if settings.DEV else 'production',
        'available_endpoints': endpoints
    })
