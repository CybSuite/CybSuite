from django.urls import path

from . import views

app_name = "health"

urlpatterns = [
    path("", views.health_root, name="health_root"),
    path("check/", views.health_check, name="health_check"),
    path("test/", views.api_test, name="api_test"),
    path("system/", views.system_info, name="system_info"),
]
