from django.urls import path

from . import views

app_name = "api_v1"

urlpatterns = [
    # navbar application endpoints
    path(
        "nav_links/", views.get_navbar, name="nav_links"
    ),  # Frontend expects this endpoint
    # Homepage data endpoint
    path("homepage/", views.get_homepage_data, name="homepage_data"),
    # Control definition related endpoints
    path(
        "schema/entity/control_definition_w_controls/",
        views.get_control_definition_w_controls_schema,
        name="control_definition_schema",
    ),
    path(
        "data/entity/control_definition_w_controls/",
        views.get_control_definition_w_controls_data,
        name="control_definition_data",
    ),
    path(
        "data/record/control_definition_w_controls/<str:pretty_id>/",
        views.get_control_definition_record_detail,
        name="control_definition_data",
    ),
    path(
        "data/related/control_definition_w_controls/<str:pretty_id>/",
        views.get_control_definition_related_records,
        name="control_definition_related",
    ),
    path(
        "form/options/control_definition_w_controls/<str:field_name>/",
        views.get_control_definition_form_options,
        name="control_definition_form_options",
    ),
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
    path("schema/categories/", views.get_schema_categories, name="schema_categories"),
    path("schema/tags/", views.get_schema_tags, name="schema_tags"),
    # Data endpoints - specified structure only
    path("data/entity/<str:entity>/", views.get_entity_data, name="entity_data"),
    path("data/options/<str:entity>/", views.get_entity_options, name="entity_options"),
    path(
        "data/record/<str:entity>/<str:pretty_id>/",
        views.get_record_detail,
        name="record_detail",
    ),
    path(
        "data/related/<str:entity>/<str:pretty_id>/",
        views.get_related_records,
        name="related_records",
    ),
    path("data/count/<str:entity>/", views.get_entity_count, name="entity_count"),
    path("data/record/<str:entity>/", views.create_record, name="create_record"),
    path("data/new/<str:entity>/", views.create_record, name="create_new_record"),
    path("data/feed/<str:entity>/", views.feed_record, name="feed_record"),
    path("data/update/<str:entity>/", views.update_record, name="update_record"),
    path(
        "data/<str:entity>/<int:record_id>/", views.delete_record, name="delete_record"
    ),
    path(
        "data/bulk-delete/<str:entity>/",
        views.bulk_delete_records,
        name="bulk_delete_records",
    ),
    path(
        "data/bulk-update/<str:entity>/",
        views.bulk_update_records,
        name="bulk_update_records",
    ),
    # Ingest endpoints
    path("ingest/plugins/", views.list_ingestors, name="list_ingestors"),
    path("ingest/status/", views.get_ingest_status, name="get_ingest_status"),
    path("ingest/", views.start_ingest, name="start_ingest"),
    # General pattern with parameter MUST come last
    path("ingest/<str:ingestor_name>/", views.ingest_data, name="ingest_data"),
    # Report endpoints
    path(
        "report/data/<str:reporter_name>/",
        views.get_reporter_data,
        name="get_reporter_data",
    ),
    path("report/<str:reporter_name>/", views.generate_report, name="generate_report"),
    # Scan endpoints
    path("scan/", views.start_scan, name="start_scan"),
    path("scan/status/", views.get_scan_status, name="get_scan_status"),
    # Plugin endpoints
    path("plugins/reporters/", views.get_reporters, name="get_reporters"),
    path("plugins/ingestors/", views.get_ingestors, name="get_ingestors"),
    path(
        "plugins/ingestors/autodetect/",
        views.auto_detect_ingestors,
        name="auto_detect_ingestors",
    ),
    path("plugins/scanners/", views.get_scanners, name="get_scanners"),
    path("plugins/formatters/", views.get_formatters, name="get_formatters"),
    # Export endpoints
    path("export/<str:entity>/", views.export_entity_data, name="export_entity_data"),
    # Form endpoints
    path(
        "form/schema/<str:entity>/",
        views.get_entity_form_schema,
        name="entity_form_schema",
    ),
    path(
        "form/options/<str:entity>/<str:field_name>/",
        views.get_entity_form_options,
        name="entity_form_options",
    ),
]
