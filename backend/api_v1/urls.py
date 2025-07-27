from django.urls import path

from . import views

app_name = "api_v1"

urlpatterns = [
    # navbar application endpoints
    path(
        "nav_links/", views.get_navbar, name="nav_links"
    ),  # Frontend expects this endpoint
    # Schema endpoints
    path("schema/full/", views.get_full_schema, name="schema_full"),
    path("schema/names/", views.get_schema_names, name="schema_names"),
    path("schema/entity/<str:entity>/", views.get_entity_schema, name="entity_schema"),
    path(
        "schema/entity/<str:entity>/names/",
        views.get_entity_field_names,
        name="entity_field_names",
    ),
    path(
        "schema/field/<str:entity>/<str:field>/",
        views.get_field_schema,
        name="field_schema",
    ),
    # Data endpoints - specified structure only
    path("data/entity/<str:entity>/", views.get_entity_data, name="entity_data"),
    path("data/options/<str:entity>/", views.get_entity_options, name="entity_options"),
    path(
        "data/record/<str:entity>/<int:record_id>/",
        views.get_record_detail,
        name="record_detail",
    ),
    path("data/count/<str:entity>/", views.get_entity_count, name="entity_count"),
    path("data/record/<str:entity>/", views.create_record, name="create_record"),
    path("data/new/<str:entity>/", views.create_new_record, name="create_new_record"),
    path("data/feed/<str:entity>/", views.feed_record, name="feed_record"),
    path("data/update/<str:entity>/", views.update_record, name="update_record"),
    path(
        "data/<str:entity>/<int:record_id>/", views.delete_record, name="delete_record"
    ),
    # Ingest endpoints
    path("ingest/plugins/", views.list_ingestors, name="list_ingestors"),
    path("ingest/<str:ingestor_name>/", views.ingest_data, name="ingest_data"),
    # Report endpoints
    path("report/<str:reporter_name>/", views.generate_report, name="generate_report"),
    # Plugin endpoints
    path("plugins/reporters/", views.get_reporters, name="get_reporters"),
    path("plugins/ingestors/", views.get_ingestors, name="get_ingestors"),
]
