import json
import operator
import os
import random
import shutil
import tarfile
import tempfile
import zipfile
from functools import reduce
from typing import Dict

from django.apps import apps
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.db.models import Count, F, Prefetch, Q, Value
from django.db.models.functions import Coalesce
from django.http import FileResponse, HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from .navbar_application import nav_links
from .pretty_id_utils import (
    generate_pretty_id,
    get_entity_pretty_id_config,
    parse_pretty_id_with_relations,
    url_decode_pretty_id,
)
from .serializers import serialize_model
from .utils import (
    SEVERITY_RANKS,
    apply_dict_flattening,
    filter_data_table_queryset,
    format_validation_error,
    get_data_table_params,
    get_empty_field_description,
    get_flattened_columns_from_sample_data,
    map_koalak_type_to_form_type,
    run_ingest_async,
    run_multiple_ingests_async,
    run_multiple_scans_async,
    run_scan_async,
)

# Import the cyberdb_schema (you may need to adjust this import path)
try:
    from cybsuite.cyberdb import (
        CyberDB,
        cyberdb_schema,
        pm_cyberdb_scanner,
        pm_ingestors,
        pm_reporters,
    )
    from cybsuite.cyberdb.bases.base_formatter import pm_formatters
except ImportError:
    # Fallback or mock for development
    cyberdb_schema = None
    CyberDB = None
    pm_ingestors = None
    pm_reporters = None
    pm_cyberdb_scanner = None
    pm_formatters = None

# TODO: remove these temporary placeholders:
example_categories = ["pentest", "network", "vulnerability"]
example_tags = [
    "pentest",
    "network",
    "vulnerability",
    "exploit",
    "reconnaissance",
    "malware",
]


def decompress_file(compressed_file_path: str, original_filename: str) -> str:
    """
    Decompress a compressed file to a temporary directory.

    Args:
        compressed_file_path: Path to the compressed file
        original_filename: Original filename to determine compression type

    Returns:
        Path to the temporary directory containing decompressed files

    Raises:
        Exception: If decompression fails or format is unsupported
    """
    # Create a temporary directory for decompression
    temp_dir = tempfile.mkdtemp(prefix="cybsuite_decompressed_")

    try:
        filename_lower = original_filename.lower()

        if filename_lower.endswith(".zip"):
            with zipfile.ZipFile(compressed_file_path, "r") as zip_ref:
                zip_ref.extractall(temp_dir)
        elif filename_lower.endswith((".tar", ".tar.gz", ".tgz")):
            with tarfile.open(compressed_file_path, "r:*") as tar_ref:
                tar_ref.extractall(temp_dir)
        elif filename_lower.endswith(".gz") and not filename_lower.endswith(".tar.gz"):
            import gzip

            # For single .gz files, decompress to a single file
            with gzip.open(compressed_file_path, "rb") as gz_file:
                # Remove .gz extension for output filename
                output_filename = (
                    original_filename[:-3]
                    if original_filename.endswith(".gz")
                    else "decompressed_file"
                )
                output_path = os.path.join(temp_dir, output_filename)
                with open(output_path, "wb") as output_file:
                    shutil.copyfileobj(gz_file, output_file)
        elif filename_lower.endswith(".bz2"):
            import bz2

            # For single .bz2 files, decompress to a single file
            with bz2.open(compressed_file_path, "rb") as bz2_file:
                # Remove .bz2 extension for output filename
                output_filename = (
                    original_filename[:-4]
                    if original_filename.endswith(".bz2")
                    else "decompressed_file"
                )
                output_path = os.path.join(temp_dir, output_filename)
                with open(output_path, "wb") as output_file:
                    shutil.copyfileobj(bz2_file, output_file)
        else:
            # For unsupported formats like .rar, .7z - we can't handle these with standard library
            raise Exception(
                f"Unsupported compression format: {original_filename}. Only .zip, .tar, .tar.gz, .gz, and .bz2 are supported."
            )

        return temp_dir

    except Exception as e:
        # Clean up temp directory if decompression failed
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        raise Exception(f"Decompression failed: {str(e)}")


@api_view(["GET"])
def get_navbar(request):
    """Get the navigation bar structure"""
    return Response(nav_links(request))


@api_view(["GET"])
def get_homepage_data(request):
    """Get comprehensive data for the homepage dashboard"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        homepage_data = {}

        # Executive Summary Data
        try:
            # Get report
            reporter = pm_reporters["controls_json"](db)
            report_data = reporter.do_processing()

            # Get highest severity control overall (not just observations)
            control_queryset = db.request("control")
            observation_queryset = control_queryset.filter(
                status="ko"
            )  # Keep this for observation count

            # Get highest severity control from ALL controls (not just ko ones)
            highest_observation = None
            try:
                # Get all controls and find the one with highest severity
                all_controls = list(control_queryset)
                if all_controls:
                    highest_observation = max(
                        all_controls,
                        key=lambda ctrl: SEVERITY_RANKS.get(
                            getattr(ctrl, "severity", "undefined"), 0
                        ),
                    )
            except Exception:
                # Final fallback: just get the first control
                highest_observation = control_queryset.first()

            # Count controls and observations
            control_count = control_queryset.count()
            observation_count = observation_queryset.count()

            # Get control definitions count
            control_definition_count = db.request("control_definition").count()

            homepage_data["execsum"] = {
                "highest_observation": {
                    "severity": getattr(highest_observation, "severity", "high")
                    if highest_observation
                    else None,
                    "title": str(highest_observation) if highest_observation else None,
                    "id": highest_observation.id if highest_observation else None,
                }
                if highest_observation
                else None,
                "control_count": control_count,
                "observation_count": observation_count,
                "control_definition_count": control_definition_count,
                "total_control_definitions": report_data["summary"][
                    "total_control_definitions"
                ],
                "total_observations_definitions": report_data["summary"][
                    "total_observations_definitions"
                ],
                "total_controls_occurrences": report_data["summary"][
                    "total_control_occurrences"
                ],
                "total_observations_occurrences": report_data["summary"][
                    "total_observations_occurrences"
                ],
                "observations_occurrences_by_severity": report_data["summary"][
                    "observations_occurrences_by_severity"
                ],
                "observations_definitions_by_severity": report_data["summary"][
                    "observations_definitions_by_severity"
                ],
                "controls": report_data["controls"],
            }
        except Exception as e:
            homepage_data["execsum"] = {
                "error": f"Error fetching execsum data: {str(e)}"
            }

        # Active Directory Data
        try:
            # Get AD domain count
            domain_count = db.request("ad_domain").count()

            # Get AD users count
            ad_user_count = db.request("ad_user").count()

            # Get AD computers count
            ad_computer_count = db.request("ad_computer").count()

            # Get top domain (most users or most referenced)
            top_domains = (
                db.request("ad_domain")
                .annotate(
                    users=Coalesce(Count("ad_users", distinct=True), Value(0)),
                    computers=Coalesce(Count("ad_computers", distinct=True), Value(0)),
                )
                .annotate(total_domains=F("users") + F("computers"))
                .order_by("-total_domains")[:3]
            )

            (pretty_id_fields, separator) = get_entity_pretty_id_config(
                cyberdb_schema, "ad_domain"
            )

            homepage_data["ad"] = {
                "domain_count": domain_count,
                "ad_user_count": ad_user_count,
                "ad_computer_count": ad_computer_count,
                "top_domains": [
                    {
                        "name": str(d),
                        "id": d.id,
                        "pretty_id": generate_pretty_id(
                            d,
                            pretty_id_fields,
                            separator,
                        ),
                        "users_count": d.users,
                        "computers_count": d.computers,
                    }
                    for d in top_domains
                ]
                if top_domains
                else None,
            }
        except Exception as e:
            homepage_data["ad"] = {"error": f"Error fetching AD data: {str(e)}"}

        # Pentest Data
        try:
            # Get host count
            host_count = db.request("host").count()

            # Get service count
            service_count = db.request("service").count()

            # Get password count
            password_count = (
                db.request("password").count()
                + db.request("ad_user")
                .filter(~Q(password=""), password__isnull=False)
                .count()
                + db.request("windows_user")
                .filter(~Q(password=""), password__isnull=False)
                .count()
            )

            dns_count = db.request("dns").count()

            # Get top services (most common ports/protocols)
            top_services_by_port = []
            try:
                # Get distinct services grouped by port and protocol
                services_by_port = (
                    db.request("service").values("port", "protocol").distinct()[:10]
                )
                services_by_name = db.request("service").values("name").distinct()[:10]

                services_by_port_counts = {}
                services_by_name_counts = {}

                for service in services_by_port:
                    port = service.get("port")
                    protocol = service.get("protocol", "tcp")
                    key = f"{port}/{protocol}"

                    count = (
                        db.request("service")
                        .filter(port=port, protocol=protocol)
                        .count()
                    )

                    services_by_port_counts[key] = count

                for service in services_by_name:
                    name = service.get("name")

                    count = db.request("service").filter(name=name).count()

                    services_by_name_counts[str(name)] = count

                # Sort by count and get top 5
                top_services_by_port = sorted(
                    services_by_port_counts.items(), key=lambda x: x[1], reverse=True
                )[:5]

                top_services_by_name = sorted(
                    services_by_name_counts.items(), key=lambda x: x[1], reverse=True
                )[:5]

                top_services_by_port = [
                    {"service": service, "count": count}
                    for service, count in top_services_by_port
                ]
                top_services_by_name = [
                    {"service": service, "count": count}
                    for service, count in top_services_by_name
                ]
            except Exception:
                top_services_by_port = []

            homepage_data["pentest"] = {
                "host_count": host_count,
                "service_count": service_count,
                "password_count": password_count,
                "dns_count": dns_count,
                "top_services_by_port": top_services_by_port,
                "top_services_by_name": top_services_by_name,
            }
        except Exception as e:
            homepage_data["pentest"] = {
                "error": f"Error fetching pentest data: {str(e)}"
            }

        return Response(homepage_data)

    except Exception as e:
        return Response(
            {"error": f"Error fetching homepage data: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def get_full_schema(request):
    """Get complete schema details for all entities"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    entities_data = cyberdb_schema.to_json()

    # TODO: remove these temporary placeholders:
    for entity_data in entities_data["entities"]:
        entity_data["category"] = random.choice(example_categories)
        rando = random.randint(1, 4)
        entity_data["tags"] = random.sample(example_tags, k=rando)

    return Response(entities_data)


@api_view(["GET"])
def get_schema_names(request):
    """Get a list of all available schema names"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    names = [e.name for e in cyberdb_schema]
    return Response(names)


@api_view(["GET"])
def get_entity_schema(request, entity):
    """Get the detailed schema definition for a given entity"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        entity_data = cyberdb_schema[entity].to_json()

        # Check if dict flattening is requested
        flatten_dict_param = request.GET.get("flatten_dict", "false").lower() == "true"

        # Identify dict fields and get flattened columns only if requested
        if flatten_dict_param:
            db = CyberDB.from_default_config()
            if db is not None:
                entity_desc = cyberdb_schema[entity]
                dict_field_names = []
                for field_desc in entity_desc:
                    if field_desc.annotation is dict or field_desc.annotation is Dict:
                        dict_field_names.append(field_desc.name)

                if dict_field_names:
                    # Get flattened columns from sample data
                    sample = db.request(entity)[:100]
                    flattened_columns = get_flattened_columns_from_sample_data(
                        sample, dict_field_names
                    )

                    # The fields structure is a dictionary, not a list
                    fields_dict = entity_data.get("fields", {})

                    # Add flattened columns as new fields at the position of the original dict fields
                    # First, collect the flattened columns grouped by their source dict field
                    dict_field_positions = {}
                    field_keys = list(fields_dict.keys())

                    for dict_field_name in dict_field_names:
                        if dict_field_name in field_keys:
                            dict_field_positions[dict_field_name] = field_keys.index(
                                dict_field_name
                            )

                    # Create a new ordered fields dictionary
                    new_fields_dict = {}

                    for i, (field_name, field_data) in enumerate(fields_dict.items()):
                        if field_name not in dict_field_names:
                            # Add non-dict field
                            new_fields_dict[field_name] = field_data
                        else:
                            # This is a dict field - add its flattened columns here instead
                            for flat_column, flat_type in flattened_columns.items():
                                if flat_column.startswith(f"{field_name}."):
                                    display_name = flat_column.replace(
                                        f"{field_name}.", ""
                                    ).title()

                                    # Convert inferred type to proper Python class annotation
                                    if flat_type == "dict":
                                        annotation = "typing.Dict"
                                    elif flat_type == "list":
                                        annotation = "typing.List"
                                    elif flat_type == "boolean":
                                        annotation = "<class 'bool'>"
                                    elif flat_type == "integer":
                                        annotation = "<class 'int'>"
                                    elif flat_type == "number":
                                        annotation = "<class 'float'>"
                                    elif flat_type == "string":
                                        annotation = "<class 'str'>"
                                    elif flat_type == "null":
                                        annotation = "<class 'NoneType'>"
                                    else:
                                        annotation = "<class 'str'>"  # fallback

                                    new_fields_dict[
                                        flat_column
                                    ] = get_empty_field_description(
                                        entity=entity,
                                        name=flat_column,
                                        display_name=display_name,
                                        annotation=annotation,
                                        description=f"Flattened field from {flat_column.split('.')[0]}",
                                    )

                    fields_dict = new_fields_dict
                    entity_data["fields"] = fields_dict

        # TODO: remove these temporary placeholders:
        entity_data["category"] = random.choice(example_categories)
        rando = random.randint(1, 4)
        entity_data["tags"] = random.sample(example_tags, k=rando)

        return Response(entity_data)
    except KeyError:
        return Response(
            {"error": f"Entity '{entity}' not found"}, status=status.HTTP_404_NOT_FOUND
        )


@api_view(["GET"])
def get_entity_field_names(request, entity):
    """Get list of field names for a given entity"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        entity_schema = cyberdb_schema[entity]
        field_names = [e.name for e in entity_schema]
        return Response(field_names)
    except KeyError:
        return Response(
            {"error": f"Entity '{entity}' not found"}, status=status.HTTP_404_NOT_FOUND
        )


@api_view(["GET"])
def get_field_schema(request, entity, field):
    """Get details for a specific field in an entity"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        entity_schema = cyberdb_schema[entity]
    except KeyError:
        return Response(
            {"error": f"Entity '{entity}' not found"}, status=status.HTTP_404_NOT_FOUND
        )

    try:
        field_data = entity_schema[field].to_json()
        return Response(field_data)
    except KeyError:
        return Response(
            {"error": f"Field '{field}' not found in entity '{entity}'"},
            status=status.HTTP_404_NOT_FOUND,
        )


# Data Operations Endpoints
@api_view(["GET"])
def get_entity_data(request, entity):
    """Get paginated list of records from an entity with optional filters, sorting, and search"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get query parameters
        table_params = get_data_table_params(request)
        (
            skip,
            limit,
            search,
            filters,
            sort_by,
            sort_desc,
            server_search,
            server_filters,
            flatten_dict_param,
        ) = table_params

        # Identify dict fields for flattening only if requested
        entity_desc = cyberdb_schema[entity]
        dict_field_names = []
        if flatten_dict_param:
            for field_desc in entity_desc:
                if field_desc.annotation is dict or field_desc.annotation is Dict:
                    dict_field_names.append(field_desc.name)

        # Get the queryset
        queryset = db.request(entity)

        # Get total count before applying filters (for pagination metadata)
        total_count = queryset.count()
        (queryset, filtered_count, _, _) = filter_data_table_queryset(
            queryset, table_params, dict_field_names
        )

        # Apply skip and limit using Django slicing
        if limit > 0:
            queryset = queryset[skip : skip + limit]
        else:
            queryset = queryset[skip:]

        # Convert QuerySet to list and serialize
        items = list(queryset)
        serialized_items = []
        for item in items:
            serialized = serialize_model(cyberdb_schema, item, entity)
            serialized_items.append(serialized)

        # Apply dict flattening only if requested
        if flatten_dict_param and dict_field_names:
            flattened_items = apply_dict_flattening(serialized_items, dict_field_names)
        else:
            flattened_items = serialized_items

        # Apply post-processing for flattened fields if needed
        if flatten_dict_param and dict_field_names:
            # Handle server-side sorting for flattened fields
            if (
                sort_by
                and "." in sort_by
                and any(sort_by.startswith(f"{df}.") for df in dict_field_names)
            ):
                flattened_items.sort(
                    key=lambda x: str(x.get(sort_by, "")).lower(), reverse=sort_desc
                )

            # Handle server-side filters for flattened fields
            if server_filters:
                try:
                    filter_data = json.loads(server_filters)
                    advanced_filters = filter_data.get("advancedFilters", [])
                    global_logic = filter_data.get("globalLogic", "and")

                    filtered_items = []
                    for item in flattened_items:
                        filter_results = []

                        for filter_item in advanced_filters:
                            column = filter_item.get("column")
                            filter_operator = filter_item.get("operator")
                            value = filter_item.get("value")

                            if not column or not filter_operator:
                                continue

                            # Only handle flattened field filters here
                            if not (
                                "." in column
                                and any(
                                    column.startswith(f"{df}.")
                                    for df in dict_field_names
                                )
                            ):
                                continue

                            item_value = item.get(column, "")
                            item_str = (
                                str(item_value).lower()
                                if item_value is not None
                                else ""
                            )
                            value_str = str(value).lower() if value is not None else ""

                            # Apply filter logic (simplified for flattened fields)
                            if filter_operator == "contains":
                                filter_results.append(value_str in item_str)
                            elif filter_operator == "does_not_contain":
                                filter_results.append(value_str not in item_str)
                            elif filter_operator == "is":
                                filter_results.append(item_str == value_str)
                            elif filter_operator == "is_not":
                                filter_results.append(item_str != value_str)
                            elif filter_operator == "is_empty":
                                filter_results.append(
                                    not item_value or item_str.strip() == ""
                                )
                            elif filter_operator == "is_not_empty":
                                filter_results.append(
                                    item_value and item_str.strip() != ""
                                )
                            else:
                                filter_results.append(
                                    True
                                )  # Unknown operator, include item

                        # Apply global logic
                        if filter_results:
                            if global_logic == "and":
                                include_item = all(filter_results)
                            else:  # 'or'
                                include_item = any(filter_results)
                        else:
                            include_item = True

                        if include_item:
                            filtered_items.append(item)

                    flattened_items = filtered_items
                except json.JSONDecodeError:
                    pass  # Continue with original items

            # Handle server-side search for flattened fields
            if server_search:
                search_filtered_items = []
                search_lower = server_search.lower()

                for item in flattened_items:
                    # Check if search term appears in any flattened field
                    found_in_flattened = False
                    for key, value in item.items():
                        if any(key.startswith(f"{df}.") for df in dict_field_names):
                            if search_lower in str(value).lower():
                                found_in_flattened = True
                                break

                    # Include if found in flattened fields OR if already included from database search
                    if found_in_flattened:
                        search_filtered_items.append(item)

                # If we found matches in flattened fields, use those
                # Otherwise, keep the original items (they matched in database fields)
                if search_filtered_items or not flattened_items:
                    flattened_items = search_filtered_items

        # Apply post-processing filters and search for flattened fields (legacy support)
        if (
            (filters or search)
            and flatten_dict_param
            and dict_field_names
            and not (server_filters or server_search)
        ):
            filtered_items = []
            for item in flattened_items:
                include_item = True

                # Apply flattened field filters
                if filters:
                    try:
                        filter_dict = json.loads(filters)
                        for field, value in filter_dict.items():
                            if (
                                value
                                and "." in field
                                and any(
                                    field.startswith(f"{df}.")
                                    for df in dict_field_names
                                )
                            ):
                                # Apply filter to flattened field
                                item_value = item.get(field, "")
                                if (
                                    isinstance(item_value, str)
                                    and value.lower() not in item_value.lower()
                                ):
                                    include_item = False
                                    break
                                elif (
                                    not isinstance(item_value, str)
                                    and value.lower() not in str(item_value).lower()
                                ):
                                    include_item = False
                                    break
                    except json.JSONDecodeError:
                        pass

                # Apply search to flattened fields
                if search and include_item:
                    search_match_in_flattened = False
                    for key, value in item.items():
                        if any(key.startswith(f"{df}.") for df in dict_field_names):
                            if (
                                isinstance(value, str)
                                and search.lower() in value.lower()
                            ):
                                search_match_in_flattened = True
                                break
                            elif (
                                not isinstance(value, str)
                                and search.lower() in str(value).lower()
                            ):
                                search_match_in_flattened = True
                                break

                    # If we had dict fields and search was applied, we need to check if there was a match
                    # either in regular fields (handled by database query) or in flattened fields
                    if not search_match_in_flattened:
                        # Check if the item would have matched in non-dict fields
                        # If the queryset returned this item, it means it matched non-dict fields
                        # So we should keep it
                        pass  # Keep the item

                if include_item:
                    filtered_items.append(item)

            flattened_items = filtered_items

        # Return response with pagination metadata
        current_page = skip // limit if limit > 0 else 0
        total_pages = (filtered_count + limit - 1) // limit if limit > 0 else 1

        response_data = {
            "data": flattened_items,
            "pagination": {
                "total": total_count,
                "filtered": filtered_count,
                "skip": skip,
                "limit": limit,
                "current_page": current_page,
                "total_pages": total_pages,
                "has_next": (current_page + 1) < total_pages,
                "has_prev": current_page > 0,
            },
        }

        return Response(response_data)

    except Exception as e:
        return Response(
            {"error": f"Error fetching data: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def get_record_detail(request, entity, pretty_id):
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Check if record_id is a numeric ID or a pretty_id
        obj = None

        # First try to get by numeric ID
        try:
            numeric_id = int(pretty_id)
            obj = db.first(entity, id=numeric_id)
        except ValueError:
            # record_id is not numeric, treat as pretty_id
            pass

        # If not found by ID, try to find by pretty_id
        if obj is None:
            # URL decode the pretty_id
            decoded_pretty_id = url_decode_pretty_id(pretty_id)

            # Get pretty_id configuration for this entity
            pretty_id_fields, separator = get_entity_pretty_id_config(
                cyberdb_schema, entity
            )

            if pretty_id_fields:
                # Parse the pretty_id into field values with relation resolution
                field_values = parse_pretty_id_with_relations(
                    decoded_pretty_id,
                    entity,
                    cyberdb_schema,
                    db,
                    pretty_id_fields,
                    separator,
                )

                # Build filter kwargs for the database query
                filter_kwargs = {}
                for field_name, field_value in field_values.items():
                    if field_value:  # Only add non-empty values
                        filter_kwargs[field_name] = field_value

                # Query the database with the parsed field values
                if filter_kwargs:
                    obj = db.first(entity, **filter_kwargs)

        if obj is None:
            return Response(
                {
                    "error": f"Record with id/pretty_id '{pretty_id}' not found in entity {entity}"
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # For observation_definition, filter controls by status="ko"
        if entity == "control_definition":
            is_observation = request.GET.get("isObservation", "false").lower() == "true"
            if is_observation and entity == "control_definition":
                obj = obj.__class__.objects.prefetch_related(
                    Prefetch(
                        "controls",
                        queryset=obj.controls.model.objects.filter(status="ko"),
                    )
                ).get(pk=obj.pk)

        # Serialize and return the object
        serialized = serialize_model(cyberdb_schema, obj, entity)

        # Check if dict flattening is requested
        flatten_dict_param = request.GET.get("flatten_dict", "false").lower() == "true"

        if flatten_dict_param:
            # Identify dict fields for flattening
            entity_desc = cyberdb_schema[entity]
            dict_field_names = []
            for field_desc in entity_desc:
                if field_desc.annotation is dict or field_desc.annotation is Dict:
                    dict_field_names.append(field_desc.name)

            if dict_field_names:
                # Apply dict flattening to the single record
                flattened_data = apply_dict_flattening([serialized], dict_field_names)
                serialized = flattened_data[0] if flattened_data else serialized

        return Response(serialized)

    except Exception as e:
        return Response(
            {"error": f"Error processing record: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def get_entity_options(request, entity):
    """Get simplified list of records for use in dropdowns/filters - returns only id and display representation"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get query parameters
        limit = None
        # limit = request.GET.get('limit')  # TODO: uncomment when pagination from backend is needed
        search = request.GET.get("search")

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
                ] or field.name in ["name", "title", "display_name", "label"]:
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
            # Priority: str(item) > name > title > display_name > id
            repr_value = None

            if str(item) != f"{entity} object":
                repr_value = str(item)
            else:
                for attr in ["name", "title", "display_name", "label"]:
                    if hasattr(item, attr):
                        value = getattr(item, attr)
                        if value:
                            repr_value = str(value)
                            break

                # Fallback to ID
                if repr_value is None:
                    repr_value = f"#{item.id}"

            options.append({"id": item.id, "repr": repr_value})

        return Response(options)

    except Exception as e:
        return Response(
            {"error": f"Error fetching entity options: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def get_entity_count(request, entity):
    """Get count of records in an entity"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get the queryset and count
        queryset = db.request(entity)
        count = queryset.count()

        return Response({"count": count})

    except Exception as e:
        return Response(
            {"error": f"Error counting records: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
def create_record(request, entity):
    """Add a new record to an entity"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get data from request
        data = request.data
        entity_desc = cyberdb_schema[entity]
        entity_meta = cyberdb_schema[entity].metadata
        model = apps.get_model(entity_meta["django_app_label"], entity)

        # Process related fields - separate from creation data
        create_data = dict(data)  # Copy to avoid modifying original
        m2m_data = {}

        for field in entity_desc:
            if field.referenced_entity is None or field.name not in create_data:
                continue

            field_value = create_data[field.name]

            if field.is_one_to_many_field():
                # For foreign key fields, use the ID directly
                if field_value is not None:
                    create_data[f"{field.name}_id"] = field_value
                # Remove the field name, keep only the _id version
                del create_data[field.name]
            else:
                # For many-to-many fields, store for later processing
                if isinstance(field_value, list):
                    m2m_data[field.name] = field_value
                    # Remove from create_data since M2M must be set after creation
                    del create_data[field.name]
                else:
                    # Single related object - treat as foreign key
                    if field_value is not None:
                        create_data[f"{field.name}_id"] = field_value
                    del create_data[field.name]

        # Create new record (ensure no ID is passed for creation)
        if "id" in create_data:
            del create_data["id"]

        # Create the object with processed data
        obj = model.objects.create(**create_data)

        # Handle many-to-many relationships after creation
        for field_name, related_ids in m2m_data.items():
            if hasattr(obj, field_name):
                m2m_field = getattr(obj, field_name)
                if related_ids:
                    m2m_field.set(related_ids)
                else:
                    m2m_field.clear()

        # Serialize the resulting object
        serialized = serialize_model(cyberdb_schema, obj, entity)
        return Response(serialized, status=status.HTTP_201_CREATED)

    except (DjangoValidationError, IntegrityError) as e:
        error_response = format_validation_error(e, entity)
        return Response(error_response, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response(
            {"error": f"Error creating record: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["PUT", "PATCH"])
def update_record(request, entity):
    """Update records in an entity"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get data from request
        data = request.data
        entity_desc = cyberdb_schema[entity]
        entity_meta = cyberdb_schema[entity].metadata
        model = apps.get_model(entity_meta["django_app_label"], entity)

        # Ensure ID is provided for update
        if "id" not in data:
            return Response(
                {"error": "ID is required for update operation"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        record_id = data["id"]
        entity_desc = cyberdb_schema[entity]

        # Filter out fields that are linked by related name (reverse foreign keys)
        # These are read-only computed fields and should not be updated
        filtered_data = {}
        for key, value in data.items():
            if key in ["id", "pretty_id"]:
                continue

            # Check if this field exists in the entity schema and is not a reverse relation
            field_desc = None
            for field in entity_desc:
                if field.name == key:
                    field_desc = field
                    break

            # Skip fields that are linked by related name (reverse foreign keys)
            if field_desc and field_desc.is_linked_by_related_name:
                continue

            # Include the field if it's a valid entity field
            if field_desc:
                filtered_data[key] = value
            else:
                print(f"Warning: Field '{key}' not found in entity schema, skipping")

        # Check if record exists
        obj = model.objects.get(pk=record_id)

        if not obj:
            return Response(
                {"error": f"Record with id {record_id} not found in entity {entity}"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Separate many-to-many fields from other fields
        m2m_updates = {}

        # Process related fields and update the object
        for field in entity_desc:
            if (
                field.referenced_entity is None
                or field.name not in filtered_data.keys()
            ):
                continue
            if field.is_linked_by_related_name:
                continue

            field_value = filtered_data[field.name]

            if field.is_one_to_many_field():
                # For foreign key fields, assign the ID instead of the object
                if field_value is not None:
                    setattr(obj, f"{field.name}_id", field_value)
                else:
                    setattr(obj, field.name, None)
                # Remove from filtered_data since we handled it
                del filtered_data[field.name]
            else:
                # For many-to-many fields, store for later processing
                if isinstance(field_value, list):
                    m2m_updates[field.name] = field_value
                    # Remove from filtered_data since we'll handle it separately
                    del filtered_data[field.name]
                else:
                    # Single related object - treat as foreign key
                    if field_value is not None:
                        setattr(obj, f"{field.name}_id", field_value)
                    else:
                        setattr(obj, field.name, None)
                    del filtered_data[field.name]

        # Update non-related fields
        for field, value in filtered_data.items():
            setattr(obj, field, value)

        # Save the object first
        obj.save()

        # Handle many-to-many relationships after saving
        for field_name, related_ids in m2m_updates.items():
            if hasattr(obj, field_name):
                m2m_field = getattr(obj, field_name)
                if related_ids:
                    m2m_field.set(related_ids)
                else:
                    m2m_field.clear()

        # Serialize the resulting object
        serialized = serialize_model(cyberdb_schema, obj, entity)
        return Response(serialized)

    except (DjangoValidationError, IntegrityError) as e:
        error_response = format_validation_error(e, entity)
        return Response(error_response, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response(
            {"error": f"Error updating record: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
def feed_record(request, entity):
    """Upsert (create or update) a record in an entity"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
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
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["DELETE"])
def delete_record(request, entity, record_id):
    """Delete a record by its ID"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get the object
        obj = db.first(entity, id=record_id)
        if obj is None:
            return Response(
                {"error": f"Record with id {record_id} not found in entity {entity}"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Delete the object
        obj.delete()

        return Response(
            {
                "status": "success",
                "message": f"Record {record_id} from entity {entity} has been deleted",
            }
        )

    except Exception as e:
        return Response(
            {"error": f"Error deleting record: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["DELETE"])
def bulk_delete_records(request, entity):
    """Delete multiple records by their IDs"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get the list of IDs from request body
        record_ids = request.data.get("ids", [])

        if not record_ids:
            return Response(
                {"error": "No record IDs provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(record_ids, list):
            return Response(
                {"error": "IDs must be provided as a list"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Track results
        deleted_ids = []
        failed_ids = []
        errors = []

        # Delete each record
        for record_id in record_ids:
            try:
                obj = db.first(entity, id=record_id)
                if obj is None:
                    failed_ids.append(record_id)
                    errors.append(f"Record {record_id} not found")
                    continue

                obj.delete()
                deleted_ids.append(record_id)

            except Exception as e:
                failed_ids.append(record_id)
                errors.append(f"Error deleting record {record_id}: {str(e)}")

        # Prepare response
        response_data = {
            "status": "completed",
            "deleted_count": len(deleted_ids),
            "failed_count": len(failed_ids),
            "deleted_ids": deleted_ids,
            "failed_ids": failed_ids,
            "errors": errors,
        }

        # Determine HTTP status based on results
        if len(deleted_ids) == len(record_ids):
            # All records deleted successfully
            response_data[
                "message"
            ] = f"Successfully deleted {len(deleted_ids)} records from entity {entity}"
            return Response(response_data, status=status.HTTP_200_OK)
        elif len(deleted_ids) > 0:
            # Partial success
            response_data[
                "message"
            ] = f"Partially completed: deleted {len(deleted_ids)} records, failed to delete {len(failed_ids)} records"
            return Response(response_data, status=status.HTTP_207_MULTI_STATUS)
        else:
            # All failed
            response_data[
                "message"
            ] = f"Failed to delete any records from entity {entity}"
            return Response(response_data, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        return Response(
            {"error": f"Error processing bulk delete: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
def bulk_update_records(request, entity):
    """Update multiple records with the same values, only for fields without unique/index constraints"""
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get the data from request body
        request_data = request.data
        record_ids = request_data.get("ids", [])
        update_data = request_data.get("data", {})

        if not record_ids:
            return Response(
                {"error": "No record IDs provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(record_ids, list):
            return Response(
                {"error": "IDs must be provided as a list"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not update_data:
            return Response(
                {"error": "No update data provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate entity exists
        try:
            entity_desc = cyberdb_schema[entity]
        except KeyError:
            return Response(
                {"error": f"Entity '{entity}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Filter out fields with unique or index constraints
        allowed_fields = {}
        forbidden_fields = []

        for field_name, field_value in update_data.items():
            if field_name in ["id", "pretty_id"]:
                forbidden_fields.append(f"{field_name} (read-only)")
                continue

            # Find the field in schema
            field_desc = None
            for field in entity_desc:
                if field.name == field_name:
                    field_desc = field
                    break

            if not field_desc:
                forbidden_fields.append(f"{field_name} (field not found)")
                continue

            # Skip fields that are linked by related name (reverse foreign keys)
            if field_desc.is_linked_by_related_name:
                forbidden_fields.append(f"{field_name} (reverse relation)")
                continue

            # Check for unique or index constraints
            if field_desc.unique or field_desc.indexed:
                forbidden_fields.append(f"{field_name} (unique/indexed field)")
                continue

            # Field is allowed for bulk update
            allowed_fields[field_name] = field_value

        if forbidden_fields:
            return Response(
                {
                    "error": "Some fields cannot be bulk updated",
                    "forbidden_fields": forbidden_fields,
                    "allowed_fields": list(allowed_fields.keys()),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not allowed_fields:
            return Response(
                {"error": "No valid fields provided for bulk update"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Track results
        updated_ids = []
        failed_ids = []
        errors = []

        # Update each record
        for record_id in record_ids:
            try:
                obj = db.first(entity, id=record_id)
                if obj is None:
                    failed_ids.append(record_id)
                    errors.append(f"Record {record_id} not found")
                    continue

                # Prepare the update data for this record
                filtered_data = allowed_fields.copy()

                # Separate many-to-many fields from other fields
                m2m_updates = {}

                # Process related fields and update the object
                for field in entity_desc:
                    if (
                        field.referenced_entity is None
                        or field.name not in filtered_data.keys()
                    ):
                        continue
                    if field.is_linked_by_related_name:
                        continue

                    field_value = filtered_data[field.name]

                    if field.is_one_to_many_field():
                        # For foreign key fields, assign the ID instead of the object
                        if field_value is not None:
                            setattr(obj, f"{field.name}_id", field_value)
                        else:
                            setattr(obj, field.name, None)
                        # Remove from filtered_data since we handled it
                        del filtered_data[field.name]
                    elif field.is_many_to_many_field():
                        # For many-to-many fields, store for later processing
                        m2m_updates[field.name] = field_value
                        # Remove from filtered_data since we'll handle it separately
                        del filtered_data[field.name]

                # Update the remaining non-relational fields
                for field_name, field_value in filtered_data.items():
                    setattr(obj, field_name, field_value)

                # Save the object first for foreign key updates
                obj.save()

                # Handle many-to-many field updates after saving
                for field_name, field_value in m2m_updates.items():
                    if field_value is not None:
                        # Get the many-to-many manager
                        m2m_manager = getattr(obj, field_name)
                        # Clear existing relationships
                        m2m_manager.clear()
                        # Set new relationships if there are any
                        if field_value:
                            m2m_manager.set(field_value)

                updated_ids.append(record_id)

            except (DjangoValidationError, IntegrityError) as e:
                failed_ids.append(record_id)
                error_details = format_validation_error(e, entity)
                errors.append(
                    f"Record {record_id}: {error_details.get('error', str(e))}"
                )
            except Exception as e:
                failed_ids.append(record_id)
                errors.append(f"Error updating record {record_id}: {str(e)}")

        # Prepare response
        response_data = {
            "status": "completed",
            "updated_count": len(updated_ids),
            "failed_count": len(failed_ids),
            "updated_ids": updated_ids,
            "failed_ids": failed_ids,
            "errors": errors,
            "updated_fields": list(allowed_fields.keys()),
        }

        # Determine HTTP status based on results
        if len(updated_ids) == len(record_ids):
            # All records updated successfully
            response_data[
                "message"
            ] = f"Successfully updated {len(updated_ids)} records in entity {entity}"
            return Response(response_data, status=status.HTTP_200_OK)
        elif len(updated_ids) > 0:
            # Partial success
            response_data[
                "message"
            ] = f"Partially completed: updated {len(updated_ids)} records, failed to update {len(failed_ids)} records"
            return Response(response_data, status=status.HTTP_207_MULTI_STATUS)
        else:
            # All failed
            response_data[
                "message"
            ] = f"Failed to update any records in entity {entity}"
            return Response(response_data, status=status.HTTP_400_BAD_REQUEST)

    except (DjangoValidationError, IntegrityError) as e:
        error_response = format_validation_error(e, entity)
        return Response(error_response, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response(
            {"error": f"Error processing bulk update: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# Ingest Operations Endpoints
@api_view(["GET"])
def list_ingestors(request):
    """Get a list of all available data ingestors"""
    if pm_ingestors is None:
        return Response(
            {"error": "Ingestors not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    ingestors = [{"name": plugin.name} for plugin in pm_ingestors]
    return Response(ingestors)


@api_view(["POST"])
@parser_classes([MultiPartParser])
def ingest_data(request, ingestor_name):
    """Ingest data using the specified ingestor plugin"""
    db = CyberDB.from_default_config()
    if db is None or pm_ingestors is None:
        return Response(
            {"error": "Database or ingestors not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get uploaded file
        if "file" not in request.FILES:
            return Response(
                {"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST
            )

        file = request.FILES["file"]

        # Check if the uploaded item is a folder (folders typically have size 0 and no content)
        if file.size == 0 and (
            not hasattr(file, "content_type")
            or file.content_type == "application/octet-stream"
        ):
            return Response(
                {
                    "error": "Folder uploads are not supported. Please upload individual files only."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        file_content = file.read()

        # Decode bytes to text with UTF-8, fallback to latin-1
        try:
            if isinstance(file_content, bytes):
                try:
                    file_text = file_content.decode("utf-8")
                except UnicodeDecodeError:
                    file_text = file_content.decode("latin-1")
            else:
                file_text = file_content
        except Exception as decode_error:
            return Response(
                {"error": f"Failed to decode file content: {str(decode_error)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create temporary file for the ingestor
        import tempfile

        temp_file = tempfile.NamedTemporaryFile(
            mode="w", delete=False, suffix=f"_{file.name}"
        )
        try:
            temp_file.write(file_text)
            temp_file.flush()
            temp_file_path = temp_file.name
        finally:
            temp_file.close()

        # Validate ingestor exists
        available_ingestors = [plugin.name for plugin in pm_ingestors]
        if ingestor_name not in available_ingestors:
            # Clean up temp file
            import os

            try:
                os.unlink(temp_file_path)
            except:
                pass
            return Response(
                {"error": f"Ingestor '{ingestor_name}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Run the ingestor using CyberDB's ingest method
        try:
            db.ingest(ingestor_name, temp_file_path)
        finally:
            # Clean up temporary file
            import os

            try:
                os.unlink(temp_file_path)
            except:
                pass

        return Response(
            {
                "status": "success",
                "message": f"Data ingested successfully using {ingestor_name}",
                "details": None,
            }
        )

    except Exception as e:
        return Response(
            {"error": f"Error ingesting data: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# New Ingest Operations Endpoints with async support and file upload
@api_view(["POST"])
@parser_classes([MultiPartParser])
def start_ingest(request):
    """Start a new ingest (single ingestor or multiple ingestors) with file upload support"""
    if pm_ingestors is None:
        return Response(
            {"error": "Ingestors not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Check if an ingest is already running
        current_status = cache.get("current_ingest_status", {})
        if current_status.get("status") == "running":
            return Response(
                {
                    "error": "An ingest is already running",
                    "current_ingestor": current_status.get("ingestor_name"),
                    "start_time": current_status.get("start_time"),
                },
                status=status.HTTP_409_CONFLICT,
            )

        # Check if this is compressed file mode
        compressed_file_mode = request.data.get("compressed_file_mode") == "true"

        # Get uploaded files and save them to temporary files
        files = []
        has_compressed_files = False  # Track if we processed any compressed files
        for key in request.FILES:
            if key.startswith("files["):
                file_obj = request.FILES[key]

                # Check if the uploaded item is a folder
                if file_obj.size == 0 and (
                    not hasattr(file_obj, "content_type")
                    or file_obj.content_type == "application/octet-stream"
                ):
                    return Response(
                        {
                            "error": f"Folder uploads are not supported. '{file_obj.name}' appears to be a folder. Please upload individual files only."
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if compressed_file_mode:
                    # Handle compressed files
                    compressed_extensions = [
                        ".zip",
                        ".tar",
                        ".tar.gz",
                        ".rar",
                        ".7z",
                        ".gz",
                        ".bz2",
                    ]
                    is_compressed = any(
                        file_obj.name.lower().endswith(ext)
                        for ext in compressed_extensions
                    )

                    if not is_compressed:
                        return Response(
                            {
                                "error": f"File '{file_obj.name}' is not a supported compressed file format. Supported formats: {', '.join(compressed_extensions)}"
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    # Create a temporary file for the compressed file
                    temp_compressed_file = tempfile.NamedTemporaryFile(
                        delete=False, suffix=f"_compressed_{file_obj.name}"
                    )

                    # Write compressed file content (keep as binary)
                    file_content = file_obj.read()
                    temp_compressed_file.write(file_content)
                    temp_compressed_file.close()

                    # Decompress the file to a temporary directory
                    try:
                        decompressed_dir = decompress_file(
                            temp_compressed_file.name, file_obj.name
                        )
                        files.append(
                            decompressed_dir
                        )  # Store directory path instead of file path
                        has_compressed_files = (
                            True  # Mark that we processed compressed files
                        )
                    except Exception as e:
                        # Clean up the temporary compressed file
                        os.unlink(temp_compressed_file.name)
                        return Response(
                            {
                                "error": f"Failed to decompress '{file_obj.name}': {str(e)}"
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    finally:
                        # Clean up the temporary compressed file
                        if os.path.exists(temp_compressed_file.name):
                            os.unlink(temp_compressed_file.name)
                else:
                    # Handle regular files (existing logic)
                    # Create a temporary file
                    temp_file = tempfile.NamedTemporaryFile(
                        mode="w+", delete=False, suffix=f"_{file_obj.name}"
                    )

                    # Read and decode the file content
                    file_content = file_obj.read()
                    try:
                        if isinstance(file_content, bytes):
                            file_content = file_content.decode("utf-8")
                    except UnicodeDecodeError:
                        # If UTF-8 decoding fails, try latin-1 as fallback
                        try:
                            file_content = file_content.decode("latin-1")
                        except UnicodeDecodeError:
                            # If all else fails, use error handling
                            file_content = file_content.decode(
                                "utf-8", errors="replace"
                            )

                    # Write content to temporary file
                    temp_file.write(file_content)
                    temp_file.close()

                    # Store the temporary file path
                    files.append(temp_file.name)

        if not files:
            return Response(
                {"error": "No files provided"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Check for both single ingestor and multiple ingestors formats
        ingestor_name = request.data.get("ingestor_name")
        ingestor_names_str = request.data.get("ingestor_names")

        # Parse ingestor_names if it's a JSON string
        ingestor_names = None
        if ingestor_names_str:
            try:
                ingestor_names = (
                    json.loads(ingestor_names_str)
                    if isinstance(ingestor_names_str, str)
                    else ingestor_names_str
                )
            except json.JSONDecodeError:
                return Response(
                    {"error": "ingestor_names must be valid JSON"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Handle multiple ingestors
        if ingestor_names:
            if not isinstance(ingestor_names, list) or len(ingestor_names) == 0:
                return Response(
                    {"error": "ingestor_names must be a non-empty list"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validate all ingestor names exist
            available_ingestors = [plugin.name for plugin in pm_ingestors]
            invalid_ingestors = [
                name for name in ingestor_names if name not in available_ingestors
            ]

            if invalid_ingestors:
                return Response(
                    {"error": f"Ingestors not found: {', '.join(invalid_ingestors)}"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Safety check: Replace file-only ingestors with "all" if we have compressed files
            if has_compressed_files:
                original_ingestors = ingestor_names.copy()
                modified_ingestors = []

                for ingestor_name in ingestor_names:
                    # Find the ingestor plugin
                    selected_plugin = None
                    for plugin in pm_ingestors:
                        if plugin.name == ingestor_name:
                            selected_plugin = plugin
                            break

                    # Check if it's file-only
                    if (
                        selected_plugin
                        and hasattr(selected_plugin, "autodetect_is_file")
                        and selected_plugin.autodetect_is_file
                        and not getattr(selected_plugin, "autodetect_is_dir", False)
                    ):

                        # Replace with "all" ingestor, but avoid duplicates
                        if "all" not in modified_ingestors:
                            modified_ingestors.append("all")
                    else:
                        # Keep the original ingestor
                        modified_ingestors.append(ingestor_name)

                # Update the ingestor list if changes were made
                if modified_ingestors != original_ingestors:
                    ingestor_names = modified_ingestors
                    import logging

                    logger = logging.getLogger(__name__)
                    logger.info(
                        f"Multi-ingest: Replaced file-only ingestors with 'all' ingestor "
                        f"for compressed file handling. Original: {original_ingestors}, "
                        f"Modified: {ingestor_names}"
                    )

            # Get additional ingest parameters from request
            ingest_kwargs = request.data.get("ingest_kwargs", {})

            # Start multiple ingests
            db = CyberDB.from_default_config()
            run_multiple_ingests_async(
                db, pm_ingestors, ingestor_names, files, ingest_kwargs
            )

            return Response(
                {
                    "status": "Multi-ingest started",
                    "ingestor_names": ingestor_names,
                    "total_ingestors": len(ingestor_names),
                    "total_files": len(files),
                    "message": f"Multi-ingest with {len(ingestor_names)} ingestors and {len(files)} file(s) has been initiated. Use WebSocket connection to monitor progress.",
                },
                status=status.HTTP_202_ACCEPTED,
            )

        # Handle single ingestor (backward compatibility)
        elif ingestor_name:
            # Handle auto-detection for compressed files
            if ingestor_name == "auto-detect" and compressed_file_mode:
                try:
                    # Auto-detect ingestors for decompressed contents
                    detected_ingestors = []

                    for file_path in files:
                        # files contains directory paths for compressed files
                        if os.path.isdir(file_path):
                            # Scan directory for files and auto-detect
                            import glob

                            dir_files = glob.glob(
                                os.path.join(file_path, "**", "*"), recursive=True
                            )
                            dir_files = [f for f in dir_files if os.path.isfile(f)]

                            for dir_file in dir_files:
                                for plugin in pm_ingestors:
                                    try:
                                        if plugin.autodetect_from_path(dir_file):
                                            if plugin.name not in detected_ingestors:
                                                detected_ingestors.append(plugin.name)
                                            break  # Use first matching ingestor for this file
                                    except Exception:
                                        continue

                    if not detected_ingestors:
                        # No specific ingestors detected, use "all" as fallback
                        ingestor_name = "all"
                    else:
                        # Check if the detected ingestor can handle directories
                        first_detected = detected_ingestors[0]
                        first_detected_plugin = None

                        # Find the plugin class for the first detected ingestor
                        for plugin in pm_ingestors:
                            if plugin.name == first_detected:
                                first_detected_plugin = plugin
                                break

                        # If the detected ingestor is file-only (can't handle directories),
                        # use "all" ingestor as fallback to properly handle the directory structure
                        if (
                            first_detected_plugin
                            and hasattr(first_detected_plugin, "autodetect_is_file")
                            and first_detected_plugin.autodetect_is_file
                            and not getattr(
                                first_detected_plugin, "autodetect_is_dir", False
                            )
                        ):

                            ingestor_name = "all"
                            import logging

                            logger = logging.getLogger(__name__)
                            logger.info(
                                f"Detected ingestor '{first_detected}' is file-only, using 'all' ingestor "
                                f"to handle compressed file directory structure"
                            )
                        else:
                            # Use the detected ingestor (it can handle directories or is not file-only)
                            ingestor_name = first_detected

                except Exception as e:
                    return Response(
                        {"error": f"Auto-detection failed: {str(e)}"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )

            # Check if the ingestor exists (skip for auto-detect since we just set it)
            if ingestor_name != "auto-detect" and ingestor_name not in [
                plugin.name for plugin in pm_ingestors
            ]:
                return Response(
                    {"error": f"Ingestor '{ingestor_name}' not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Safety check: If user manually selected a file-only ingestor but we have
            # compressed files that were decompressed to directories, use "all" ingestor
            if ingestor_name != "auto-detect" and has_compressed_files:
                # Get the selected ingestor plugin
                selected_plugin = None
                for plugin in pm_ingestors:
                    if plugin.name == ingestor_name:
                        selected_plugin = plugin
                        break

                # Check if the selected ingestor is file-only
                if (
                    selected_plugin
                    and hasattr(selected_plugin, "autodetect_is_file")
                    and selected_plugin.autodetect_is_file
                    and not getattr(selected_plugin, "autodetect_is_dir", False)
                ):

                    import logging

                    logger = logging.getLogger(__name__)
                    logger.info(
                        f"User selected file-only ingestor '{ingestor_name}' but compressed files "
                        f"require directory handling, using 'all' ingestor as fallback"
                    )
                    ingestor_name = "all"

            # Get additional ingest parameters from request
            ingest_kwargs = request.data.get("ingest_kwargs", {})

            # Start the real ingest
            db = CyberDB.from_default_config()
            run_ingest_async(db, pm_ingestors, ingestor_name, files, ingest_kwargs)

            return Response(
                {
                    "status": "Ingest started",
                    "ingestor_name": ingestor_name,
                    "total_files": len(files),
                    "message": f"Ingest with {len(files)} file(s) has been initiated. Use WebSocket connection to monitor progress.",
                },
                status=status.HTTP_202_ACCEPTED,
            )

        else:
            return Response(
                {
                    "error": "Either ingestor_name (for single ingest) or ingestor_names (for multi-ingest) is required"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    except Exception as e:
        return Response(
            {"error": f"Error starting ingest: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def get_ingest_status(request):
    """Get current ingest status"""
    current_status = cache.get(
        "current_ingest_status",
        {
            "status": "idle",
            "ingestor_name": None,
            "start_time": None,
            "end_time": None,
            "progress": 0,
            "progress_bar": 0,
            "progress_type": "indeterminate",
            "current_portion": 0,
            "total_portions": None,
            "current_step": 0,
            "total_steps": None,
            "message": "No ingest running",
            "results": None,
            "error": None,
        },
    )

    return Response(current_status)


@api_view(["POST"])
@parser_classes([MultiPartParser])
def auto_detect_ingestors(request):
    """Auto-detect suitable ingestors for uploaded files"""
    if pm_ingestors is None:
        return Response(
            {"error": "Ingestors not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get uploaded files and create temporary files for autodetection
        temp_files = []
        files = {}
        for key in request.FILES:
            if key.startswith("files["):
                file_obj = request.FILES[key]

                # Check if the uploaded item is a folder
                if file_obj.size == 0 and (
                    not hasattr(file_obj, "content_type")
                    or file_obj.content_type == "application/octet-stream"
                ):
                    return Response(
                        {
                            "error": f"Folder uploads are not supported. '{file_obj.name}' appears to be a folder. Please upload individual files only."
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                file_content = file_obj.read()

                # Decode bytes to text with proper encoding handling
                try:
                    if isinstance(file_content, bytes):
                        try:
                            file_text = file_content.decode("utf-8")
                        except UnicodeDecodeError:
                            file_text = file_content.decode("latin-1")
                    else:
                        file_text = file_content
                except Exception:
                    file_text = file_content.decode("utf-8", errors="replace")

                # Create temporary file for autodetection
                import tempfile
                from pathlib import Path

                temp_file = tempfile.NamedTemporaryFile(
                    mode="w", delete=False, suffix=f"_{file_obj.name}"
                )
                try:
                    temp_file.write(file_text)
                    temp_file.flush()
                    temp_file_path = Path(temp_file.name)
                finally:
                    temp_file.close()

                temp_files.append(temp_file_path)
                files[file_obj.name] = temp_file_path

        if not files:
            return Response(
                {"error": "No files provided"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            detections = {}

            # For each file, check which ingestors can handle it using autodetect_from_path
            for filename, file_path in files.items():
                suitable_ingestors = []

                for plugin in pm_ingestors:
                    try:
                        # Use the real autodetect_from_path method from BaseIngestor
                        if plugin.autodetect_from_path(file_path):
                            suitable_ingestors.append(plugin.name)
                    except Exception:
                        # Skip ingestors that fail autodetection
                        continue

                detections[filename] = suitable_ingestors

            return Response({"detections": detections})

        finally:
            # Clean up temporary files
            import os

            for temp_file_path in temp_files:
                try:
                    os.unlink(temp_file_path)
                except Exception:
                    pass

    except Exception as e:
        return Response(
            {"error": f"Error during auto-detection: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# Report Operations Endpoints
@api_view(["GET"])
def get_reporter_data(request, reporter_name):
    """Get report data as JSON from the specified reporter"""
    db = CyberDB.from_default_config()
    if db is None or pm_reporters is None:
        return Response(
            {"error": "Database or reporters not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Check if reporter exists
        if reporter_name not in [plugin.name for plugin in pm_reporters]:
            return Response(
                {"error": f"Reporter '{reporter_name}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get the reporter plugin
        reporter = pm_reporters[reporter_name](db)

        # Check if reporter supports JSON data extraction
        if not hasattr(reporter, "do_processing"):
            return Response(
                {
                    "error": f"Reporter '{reporter_name}' does not support data extraction"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get query parameters for filtering
        latest_run = request.GET.get("latest_run")
        if latest_run:
            try:
                latest_run = int(latest_run)
                reporter.configure(latest_run=latest_run)
            except ValueError:
                return Response(
                    {"error": "Invalid latest_run parameter - must be an integer"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            reporter.configure()

        # Generate the report data
        report_data = reporter.do_processing()

        return Response(report_data)

    except Exception as e:
        return Response(
            {"error": f"Error generating report data: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def generate_report(request, reporter_name):
    """Generate a report using the specified reporter and return it as a downloadable file"""
    db = CyberDB.from_default_config()
    if db is None or pm_reporters is None:
        return Response(
            {"error": "Database or reporters not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Check if reporter exists
        if reporter_name not in [plugin.name for plugin in pm_reporters]:
            return Response(
                {"error": f"Reporter '{reporter_name}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Create temporary file
        reporter = pm_reporters[reporter_name](db)
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=reporter.extension
        ) as tmp_file:
            temp_path = tmp_file.name

        # Configure the reporter if needed
        latest_run = request.GET.get("latest_run")
        if latest_run:
            try:
                latest_run = int(latest_run)
                reporter.configure(latest_run=latest_run)
            except ValueError:
                return Response(
                    {"error": "Invalid latest_run parameter - must be an integer"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            reporter.configure()

        # Generate the report
        reporter.run(temp_path)

        # Determine content type based on file extension
        if reporter.extension == ".html":
            content_type = "text/html"
        elif reporter.extension == ".json":
            content_type = "application/json"
        elif reporter.extension == ".xlsx":
            content_type = (
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
        elif reporter.extension == ".csv":
            content_type = "text/csv"
        else:
            content_type = "application/octet-stream"

        # Return the file as a downloadable response
        response = FileResponse(
            open(temp_path, "rb"),
            content_type=content_type,
            as_attachment=True,
            filename=f"report_{reporter_name}{reporter.extension}",
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
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# Scan Operations Endpoints
@api_view(["POST"])
def start_scan(request):
    """Start a new scan (single scanner or multiple scanners)"""
    if pm_cyberdb_scanner is None:
        return Response(
            {"error": "Scanners not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Check if a scan is already running
        current_status = cache.get("current_scan_status", {})
        if current_status.get("status") == "running":
            return Response(
                {
                    "error": "A scan is already running",
                    "current_scanner": current_status.get("scanner_name"),
                    "start_time": current_status.get("start_time"),
                },
                status=status.HTTP_409_CONFLICT,
            )

        # Check for both single scanner and multiple scanners formats
        scanner_name = request.data.get("scanner_name")
        scanner_names = request.data.get("scanner_names")

        # Handle multiple scanners
        if scanner_names:
            if not isinstance(scanner_names, list) or len(scanner_names) == 0:
                return Response(
                    {"error": "scanner_names must be a non-empty list"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validate all scanner names exist
            available_scanners = [plugin.name for plugin in pm_cyberdb_scanner]
            invalid_scanners = [
                name for name in scanner_names if name not in available_scanners
            ]

            if invalid_scanners:
                return Response(
                    {"error": f"Scanners not found: {', '.join(invalid_scanners)}"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Get additional scan parameters from request
            scan_kwargs = request.data.get("scan_kwargs", {})

            # Start multiple scans
            db = CyberDB.from_default_config()
            run_multiple_scans_async(db, pm_cyberdb_scanner, scanner_names, scan_kwargs)

            return Response(
                {
                    "status": "Multi-scan started",
                    "scanner_names": scanner_names,
                    "total_scanners": len(scanner_names),
                    "message": f"Multi-scan with {len(scanner_names)} scanners has been initiated. Use WebSocket connection to monitor progress.",
                },
                status=status.HTTP_202_ACCEPTED,
            )

        # Handle single scanner (backward compatibility)
        elif scanner_name:
            # Check if the scanner exists
            if scanner_name not in [plugin.name for plugin in pm_cyberdb_scanner]:
                return Response(
                    {"error": f"Scanner '{scanner_name}' not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Get additional scan parameters from request
            scan_kwargs = request.data.get("scan_kwargs", {})

            # Start the real scan
            db = CyberDB.from_default_config()
            run_scan_async(db, pm_cyberdb_scanner, scanner_name, scan_kwargs)

            return Response(
                {
                    "status": "Scan started",
                    "scanner_name": scanner_name,
                    "message": "Scan has been initiated. Use WebSocket connection to monitor progress.",
                },
                status=status.HTTP_202_ACCEPTED,
            )

        else:
            return Response(
                {
                    "error": "Either scanner_name (for single scan) or scanner_names (for multi-scan) is required"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    except Exception as e:
        return Response(
            {"error": f"Error starting scan: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def get_scan_status(request):
    """Get current scan status"""
    current_status = cache.get(
        "current_scan_status",
        {
            "status": "idle",
            "scanner_name": None,
            "start_time": None,
            "end_time": None,
            "progress": 0,
            "progress_bar": 0,
            "progress_type": "indeterminate",
            "current_portion": 0,
            "total_portions": None,
            "current_step": 0,
            "total_steps": None,
            "message": "No scan running",
            "results": None,
            "error": None,
        },
    )

    return Response(current_status)


# Plugin Operations Endpoints
@api_view(["GET"])
def get_reporters(request):
    """Get a list of all available reporters"""
    if pm_reporters is None:
        return Response(
            {"error": "Reporters not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    reporters = [{"name": plugin.name} for plugin in pm_reporters]
    return Response(reporters)


@api_view(["GET"])
def get_ingestors(request):
    """Get a list of all available ingestors with metadata"""
    if pm_ingestors is None:
        return Response(
            {"error": "Ingestors not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    ingestors = []
    for ingestor in pm_ingestors:
        ingestor_info = {"name": ingestor.name}
        if ingestor.metadata:
            ingestor_info["description"] = (
                ingestor.metadata.description
                if ingestor.metadata.description is not None
                else None
            )
        else:
            ingestor_info["description"] = None

        # Add autodetect capabilities if available
        if hasattr(ingestor, "autodetect_is_file"):
            ingestor_info["autodetect_is_file"] = ingestor.autodetect_is_file
        if hasattr(ingestor, "autodetect_is_dir"):
            ingestor_info["autodetect_is_dir"] = ingestor.autodetect_is_dir

        ingestors.append(ingestor_info)

    return Response(ingestors)


@api_view(["GET"])
def get_scanners(request):
    """Get a list of all available database scanners"""
    if pm_cyberdb_scanner is None:
        return Response(
            {"error": "Database scanners not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    db_scanners = []
    for scanner in pm_cyberdb_scanner:
        scanner_info = {"name": scanner.name}
        if scanner.metadata:
            scanner_info["description"] = (
                scanner.metadata.description
                if scanner.metadata.description is not None
                else None
            )
            scanner_info["tags"] = (
                scanner.metadata.tags if scanner.metadata.tags is not None else []
            )
        else:
            scanner_info["description"] = None
            scanner_info["tags"] = []

        db_scanners.append(scanner_info)

    return Response(db_scanners)


@api_view(["GET"])
def get_formatters(request):
    """Get a list of all available data formatters"""
    if pm_formatters is None:
        return Response(
            {"error": "Formatters not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    formatters = []
    for plugin in pm_formatters:
        formatter_info = {"name": plugin.name}
        if hasattr(plugin, "metadata") and plugin.metadata:
            formatter_info["description"] = (
                plugin.metadata.description
                if plugin.metadata.description is not None
                else None
            )
        else:
            formatter_info["description"] = None
        formatters.append(formatter_info)

    return Response(formatters)


@api_view(["POST"])
def export_entity_data(request, entity):
    """Export entity data in the specified format"""
    db = CyberDB.from_default_config()
    if db is None or pm_formatters is None:
        return Response(
            {"error": "CyberDB or formatters not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get parameters from request
        format_name = request.data.get("format")
        fields = request.data.get("fields", [])
        export_scope = request.data.get("export_scope", "all")
        include_filters = request.data.get("include_filters", False)
        server_filters = request.data.get("server_filters")
        available_record_ids = request.data.get("available_record_ids", [])
        record_ids = request.data.get("record_ids", [])

        # Legacy support - only override if legacy parameters are explicitly provided
        export_all = request.data.get("export_all")
        if export_all is not None:
            # Legacy mode: use export_all to determine scope
            export_scope = "all" if export_all else "selected"

        if not format_name:
            return Response(
                {"error": "Format name is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Find the formatter plugin
        formatter_plugin = None
        for plugin in pm_formatters:
            if plugin.name == format_name:
                formatter_plugin = plugin
                break

        if not formatter_plugin:
            return Response(
                {"error": f"Formatter '{format_name}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get the entity model and queryset
        entity_desc = cyberdb_schema[entity]
        queryset = db.request(entity)

        # Build filtered queryset based on export scope
        if export_scope == "all":
            # Use all records - but for client-managed tables, respect available_record_ids
            if available_record_ids:
                # Client-managed table: use the provided available record IDs
                queryset = queryset.filter(id__in=available_record_ids)
            elif include_filters and server_filters:
                # Server-managed table: apply server-side filters using the same logic as get_entity_data
                filters = server_filters.get("filters", {})
                search = server_filters.get("search", "")

                # Construct table_params tuple like get_entity_data does
                table_params = (
                    0,  # skip
                    0,  # limit (no limit for export)
                    search,  # legacy search
                    None,  # legacy filters
                    None,  # sort_by
                    False,  # sort_desc
                    search,  # server_search
                    json.dumps(filters)
                    if filters
                    else None,  # server_filters (JSON string)
                    False,  # flatten_dict_param
                )

                # Use the same filtering logic as get_entity_data
                entity_desc = cyberdb_schema[entity]
                dict_field_names = []
                for field_desc in entity_desc:
                    if field_desc.annotation is dict or field_desc.annotation is Dict:
                        dict_field_names.append(field_desc.name)

                (queryset, filtered_count, _, _) = filter_data_table_queryset(
                    queryset, table_params, dict_field_names
                )
            # else: use all records from database (server-managed, no filters)

        elif export_scope == "filtered":
            # Use filtered records - either from server filters or client-provided IDs
            if include_filters and server_filters:
                # Apply server-side filters using the same logic as get_entity_data
                filters = server_filters.get("filters", {})
                search = server_filters.get("search", "")

                # Construct table_params tuple like get_entity_data does
                table_params = (
                    0,  # skip
                    0,  # limit (no limit for export)
                    search,  # legacy search
                    None,  # legacy filters
                    None,  # sort_by
                    False,  # sort_desc
                    search,  # server_search
                    json.dumps(filters)
                    if filters
                    else None,  # server_filters (JSON string)
                    False,  # flatten_dict_param
                )

                # Use the same filtering logic as get_entity_data
                entity_desc = cyberdb_schema[entity]
                dict_field_names = []
                for field_desc in entity_desc:
                    if field_desc.annotation is dict or field_desc.annotation is Dict:
                        dict_field_names.append(field_desc.name)

                (queryset, filtered_count, _, _) = filter_data_table_queryset(
                    queryset, table_params, dict_field_names
                )
            elif available_record_ids:
                # Use client-provided filtered record IDs
                queryset = queryset.filter(id__in=available_record_ids)
            else:
                return Response(
                    {
                        "error": "For filtered export, either server filters or available record IDs must be provided"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        elif export_scope == "selected":
            # Use selected records
            if record_ids:
                queryset = queryset.filter(id__in=record_ids)
            else:
                return Response(
                    {"error": "For selected export, record_ids must be provided"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            return Response(
                {
                    "error": f"Invalid export_scope: {export_scope}. Must be 'all', 'filtered', or 'selected'"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get field names if not provided
        if not fields:
            fields = [
                field.name for field in entity_desc if not field.name.startswith("_")
            ]

        # Convert queryset to list of dicts
        data = []
        for obj in queryset:
            record = {}
            serialized = serialize_model(cyberdb_schema, obj, entity)
            for field_name in fields:
                record[field_name] = serialized.get(field_name)
            data.append(record)

        # Create HTTP response with appropriate content type
        response = HttpResponse(content_type="application/octet-stream")

        # Set filename based on format
        filename = f"{entity}_export.{format_name}"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'

        # Use the formatter to write data
        formatter_instance = formatter_plugin()
        formatter_instance.format(data, response, fields)

        return response

    except KeyError:
        return Response(
            {"error": f"Entity '{entity}' not found"},
            status=status.HTTP_404_NOT_FOUND,
        )
    except Exception as e:
        return Response(
            {"error": f"Export failed: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# Additional Endpoints
@api_view(["GET"])
def get_schema_categories(request):
    """Get a list of all available entity categories"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        entities_data = cyberdb_schema.to_json()
        categories = set()

        for entity_data in entities_data["entities"]:
            if entity_data.get("category"):
                categories.add(entity_data["category"])

        categories = set(
            example_categories
        )  # TODO: remove this temporary placeholder when real data is available:

        return Response(sorted(list(categories)))
    except Exception as e:
        return Response(
            {"error": f"Error fetching categories: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def get_schema_tags(request):
    """Get a list of all available entity tags"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        entities_data = cyberdb_schema.to_json()
        tags = set()

        for entity_data in entities_data["entities"]:
            if entity_data.get("tags"):
                for tag in entity_data["tags"]:
                    tags.add(tag)

        tags = set(
            example_tags
        )  # TODO: remove this temporary placeholder when real data is available

        return Response(sorted(list(tags)))
    except Exception as e:
        return Response(
            {"error": f"Error fetching tags: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def get_entity_form_schema(request, entity):
    """Get form schema for creating/editing an entity"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get the entity schema
        entity_schema = cyberdb_schema[entity]
        if not entity_schema:
            return Response(
                {"error": f"Entity '{entity}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        form_schema = {
            "entity": entity,
            "fields": [],
            "required_fields": [],
        }

        # Process fields
        for field_name, field_desc in entity_schema._fields.items():
            # Skip system fields like id, created_at, updated_at
            if field_name in ["id", "created_at", "updated_at"]:
                continue

            if field_desc.is_linked_by_related_name:
                continue

            # Map koalak field types to form field types
            field_type = map_koalak_type_to_form_type(field_desc)
            field_required = field_desc.required

            # Build field schema
            field_schema = {
                "name": field_name,
                "type": field_type,
                "label": field_desc.display_name
                or field_name.replace("_", " ").title(),
                "required": field_required,
                "description": field_desc.description or "",
                "placeholder": "",
                "nullable": field_desc.nullable,
            }

            # Add type-specific configurations based on field type
            if field_type == "relation":
                field_schema["relation_entity"] = (
                    field_desc.referenced_entity.name
                    if field_desc.referenced_entity
                    else None
                )
                field_schema["multiple"] = field_desc.is_sequence()
            elif field_type == "enum" and field_desc.choices:
                field_schema["options"] = [
                    {"value": choice, "label": choice} for choice in field_desc.choices
                ]
            elif field_type == "boolean":
                # Use field default value
                default_value = field_desc.get_default()
                if default_value is not None and default_value != field_desc.NOTHING:
                    field_schema["default"] = bool(default_value)
                else:
                    field_schema["default"] = False
            elif field_type in ["integer", "number"]:
                field_schema["min"] = field_desc.min
                field_schema["max"] = field_desc.max
                field_schema["step"] = 1 if field_type == "integer" else "any"
            elif field_type in ["string", "text", "email", "url"]:
                field_schema["max_length"] = field_desc.max_length
                field_schema[
                    "min_length"
                ] = None  # Can be added to FieldDescription if needed
                field_schema[
                    "pattern"
                ] = None  # Can be added to FieldDescription if needed

            # Set default value if available and valid
            default_value = field_desc.get_default()
            if (
                default_value is not None
                and default_value != field_desc.NOTHING
                and default_value != ""
            ):
                field_schema["default"] = default_value

            form_schema["fields"].append(field_schema)

            if field_schema["required"]:
                form_schema["required_fields"].append(field_name)

        return Response(form_schema)

    except Exception as e:
        return Response(
            {"error": f"Error generating form schema: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def get_entity_form_options(request, entity, field_name):
    """Get available options for relation fields"""
    if cyberdb_schema is None:
        return Response(
            {"error": "Schema not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Get the entity schema
        entity_schema = cyberdb_schema[entity]
        if not entity_schema:
            return Response(
                {"error": f"Entity '{entity}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        entity_data = entity_schema.to_json()
        field_data = entity_data.get("fields", {}).get(field_name)

        if not field_data:
            return Response(
                {"error": f"Field '{field_name}' not found in entity '{entity}'"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Handle different field types that need options
        if field_data.get("referenced_entity"):
            # Get related entity records using the existing options endpoint
            related_entity = field_data.get("referenced_entity")
            if not related_entity:
                return Response(
                    {"error": f"No related entity specified for field '{field_name}'"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Get data from the database using the entity options endpoint
            db = CyberDB.from_default_config()
            if db is None:
                return Response(
                    {"error": "Database not available"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            # Get query parameters for search and limit
            limit = int(request.GET.get("limit", 100))
            search = request.GET.get("search")

            # Get the queryset
            queryset = db.request(related_entity)

            # Apply search if provided
            if search:
                # Get entity schema for search fields
                related_entity_schema = cyberdb_schema[related_entity]
                search_fields = []

                # Find text fields for searching
                for fname, fdata in (
                    related_entity_schema.to_json().get("fields", {}).items()
                ):
                    if fdata.get("type") in ["string", "text"]:
                        search_fields.append(fname)

                if search_fields:
                    # Create search query
                    search_queries = [
                        Q(**{f"{field}__icontains": search}) for field in search_fields
                    ]
                    search_query = reduce(operator.or_, search_queries)
                    queryset = queryset.filter(search_query)

            # Apply limit
            queryset = queryset[:limit]

            # Convert to list and create options
            items = list(queryset)
            options = []

            for item in items:
                # Try to get a meaningful representation
                display_value = str(item)

                # Try common display fields first
                for field in ["name", "title", "display_name", "label"]:
                    if hasattr(item, field):
                        display_value = getattr(item, field)
                        break

                options.append(
                    {
                        "value": item.id,
                        "label": display_value,
                    }
                )

            return Response(
                {
                    "field": field_name,
                    "type": "relation",
                    "entity": related_entity,
                    "options": options,
                }
            )

        elif field_data.get("choices"):
            # Return enum values
            values = field_data.get("choices", [])
            options = [{"value": val, "label": val} for val in values]

            return Response(
                {
                    "field": field_name,
                    "type": "enum",
                    "options": options,
                }
            )

        else:
            return Response(
                {"error": f"Field '{field_name}' does not support options"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    except Exception as e:
        return Response(
            {"error": f"Error fetching field options: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def get_related_records(request, entity, pretty_id):
    """
    Get records related to a specific entity record.
    This endpoint returns a map of entity types to their related records,
    filtered server-side instead of fetching all data and filtering client-side.
    """
    db = CyberDB.from_default_config()
    if db is None:
        return Response(
            {"error": "Database not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        # Check if dict flattening is requested
        flatten_dict_param = request.GET.get("flatten_dict", "false").lower() == "true"

        # First, get the main record using the same logic as get_record_detail
        obj = None

        # First try to get by numeric ID
        try:
            numeric_id = int(pretty_id)
            obj = db.first(entity, id=numeric_id)
        except ValueError:
            # record_id is not numeric, treat as pretty_id
            pass

        # If not found by ID, try to find by pretty_id
        if obj is None:
            # URL decode the pretty_id
            decoded_pretty_id = url_decode_pretty_id(pretty_id)

            # Get pretty_id configuration for this entity
            pretty_id_fields, separator = get_entity_pretty_id_config(
                cyberdb_schema, entity
            )

            if pretty_id_fields:
                # Parse the pretty_id into field values with relation resolution
                field_values = parse_pretty_id_with_relations(
                    decoded_pretty_id,
                    entity,
                    cyberdb_schema,
                    db,
                    pretty_id_fields,
                    separator,
                )

                # Build filter kwargs for the database query
                filter_kwargs = {}
                for field_name, field_value in field_values.items():
                    if field_value:  # Only add non-empty values
                        filter_kwargs[field_name] = field_value

                # Query the database with the parsed field values
                if filter_kwargs:
                    obj = db.first(entity, **filter_kwargs)

        if obj is None:
            return Response(
                {
                    "error": f"Record with id/pretty_id '{pretty_id}' not found in entity {entity}"
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # Serialize the main record to get field values
        main_record = serialize_model(cyberdb_schema, obj, entity)

        # Get the entity schema to identify relation fields
        entity_desc = cyberdb_schema[entity]
        related_data = {}
        related_schemas = {}
        related_dict_fields = {}  # Track dict fields for each related entity

        # First, initialize all possible related entities (even with empty arrays)
        for field_desc in entity_desc:
            # Skip if field doesn't have a relationship or doesn't have a referenced entity
            if not field_desc.has_relationship() or not field_desc.referenced_entity:
                continue

            referenced_entity_name = (
                field_desc.referenced_entity.name
                if hasattr(field_desc.referenced_entity, "name")
                else str(field_desc.referenced_entity)
            )

            # Initialize related data and schema for this entity type
            if referenced_entity_name not in related_data:
                related_data[referenced_entity_name] = []
                related_schemas[
                    referenced_entity_name
                ] = referenced_entity_name  # Just store entity name for now

                # If flattening is requested, identify dict fields for this related entity
                if flatten_dict_param:
                    try:
                        related_entity_desc = cyberdb_schema[referenced_entity_name]
                        dict_field_names = []
                        for related_field_desc in related_entity_desc:
                            if (
                                related_field_desc.annotation is dict
                                or related_field_desc.annotation is Dict
                            ):
                                dict_field_names.append(related_field_desc.name)
                        related_dict_fields[referenced_entity_name] = dict_field_names
                    except KeyError:
                        related_dict_fields[referenced_entity_name] = []

        # Now find all relation fields and populate actual data
        for field_desc in entity_desc:
            # Skip if field doesn't have a relationship or doesn't have a referenced entity
            if not field_desc.has_relationship() or not field_desc.referenced_entity:
                continue

            referenced_entity_name = (
                field_desc.referenced_entity.name
                if hasattr(field_desc.referenced_entity, "name")
                else str(field_desc.referenced_entity)
            )
            field_name = field_desc.name
            field_value = main_record.get(field_name)

            # Skip if field value is empty - but keep the empty array in related_data
            if not field_value:
                continue

            # Query related records based on field value
            related_records = []

            if isinstance(field_value, list):
                # Handle array/many-to-many relations
                for item in field_value:
                    if isinstance(item, dict) and "id" in item:
                        # Field value is already serialized with id
                        try:
                            related_obj = db.first(
                                referenced_entity_name, id=item["id"]
                            )
                            if related_obj:
                                related_records.append(related_obj)
                        except:
                            pass
                    elif isinstance(item, (int, str)):
                        # Field value is just an ID
                        try:
                            related_obj = db.first(referenced_entity_name, id=item)
                            if related_obj:
                                related_records.append(related_obj)
                        except:
                            pass
            elif isinstance(field_value, dict) and "id" in field_value:
                # Handle single foreign key relation
                try:
                    related_obj = db.first(referenced_entity_name, id=field_value["id"])
                    if related_obj:
                        related_records.append(related_obj)
                except:
                    pass
            elif isinstance(field_value, (int, str)):
                # Handle single foreign key relation (just ID)
                try:
                    related_obj = db.first(referenced_entity_name, id=field_value)
                    if related_obj:
                        related_records.append(related_obj)
                except:
                    pass

            # Serialize and add unique related records
            for related_obj in related_records:
                serialized_related = serialize_model(
                    cyberdb_schema, related_obj, referenced_entity_name
                )
                # Check if this record is already in the list (avoid duplicates)
                if not any(
                    r.get("id") == serialized_related.get("id")
                    for r in related_data[referenced_entity_name]
                ):
                    related_data[referenced_entity_name].append(serialized_related)

        # Apply dict flattening to related data if requested
        if flatten_dict_param:
            for entity_name, records in related_data.items():
                dict_field_names = related_dict_fields.get(entity_name, [])
                if dict_field_names and records:
                    flattened_records = apply_dict_flattening(records, dict_field_names)
                    related_data[entity_name] = flattened_records

        # Convert schemas to the format expected by frontend
        formatted_schemas = {}
        for entity_name in related_schemas.keys():
            # Get schema for related entity, filtering out reverse relations
            related_entity_desc = cyberdb_schema[entity_name]

            # Convert field descriptions to the format expected by frontend
            formatted_fields = {}
            for field_desc in related_entity_desc:
                # Skip reverse relations pointing back to the main entity
                if (
                    hasattr(field_desc, "referenced_entity")
                    and field_desc.referenced_entity
                ):
                    ref_entity_name = (
                        field_desc.referenced_entity.name
                        if hasattr(field_desc.referenced_entity, "name")
                        else str(field_desc.referenced_entity)
                    )
                    if ref_entity_name == entity:
                        continue

                # Get referenced entity name as string, not object
                referenced_entity_name = None
                if (
                    hasattr(field_desc, "referenced_entity")
                    and field_desc.referenced_entity
                ):
                    referenced_entity_name = (
                        field_desc.referenced_entity.name
                        if hasattr(field_desc.referenced_entity, "name")
                        else str(field_desc.referenced_entity)
                    )

                # Check if this is a dict field and flattening is requested
                is_dict_field = (
                    field_desc.annotation is dict or field_desc.annotation is Dict
                )
                if flatten_dict_param and is_dict_field:
                    # Skip the original dict field and add flattened fields instead
                    dict_field_names = related_dict_fields.get(entity_name, [])
                    if field_desc.name in dict_field_names:
                        # Get flattened columns for this dict field
                        flattened_columns = get_flattened_columns_from_sample_data(
                            related_data[entity_name], [field_desc.name]
                        )

                        # Add flattened fields to schema
                        for flat_column, flat_type in flattened_columns.items():
                            if flat_column.startswith(f"{field_desc.name}."):
                                display_name = flat_column.replace(
                                    f"{field_desc.name}.", ""
                                ).title()

                                # Convert inferred type to proper Python class annotation
                                if flat_type == "dict":
                                    annotation = "typing.Dict"
                                elif flat_type == "list":
                                    annotation = "typing.List"
                                elif flat_type == "boolean":
                                    annotation = "<class 'bool'>"
                                elif flat_type == "integer":
                                    annotation = "<class 'int'>"
                                elif flat_type == "number":
                                    annotation = "<class 'float'>"
                                elif flat_type == "string":
                                    annotation = "<class 'str'>"
                                elif flat_type == "null":
                                    annotation = "<class 'NoneType'>"
                                else:
                                    annotation = "<class 'str'>"  # fallback

                                formatted_fields[flat_column] = {
                                    "name": flat_column,
                                    "annotation": annotation,
                                    "referenced_entity": None,
                                    "is_linked_by_related_name": False,
                                    "choices": None,
                                    "nullable": True,
                                    "not_editable": True,
                                    "hidden_in_list": False,
                                    "pretty_name": None,
                                    "display_name": display_name,
                                    "description": f"Flattened field from {flat_column.split('.')[0]}",
                                }
                        continue  # Skip adding the original dict field

                formatted_fields[field_desc.name] = {
                    "name": field_desc.name,
                    "annotation": str(field_desc.annotation),
                    "referenced_entity": referenced_entity_name,
                    "is_linked_by_related_name": getattr(
                        field_desc, "is_linked_by_related_name", False
                    ),
                    "choices": getattr(field_desc, "choices", None),
                    "nullable": getattr(field_desc, "nullable", False),
                    "hidden_in_list": getattr(field_desc, "hidden_in_list", False),
                    "pretty_name": getattr(field_desc, "pretty_name", None),
                    "display_name": getattr(field_desc, "display_name", None),
                    "description": getattr(field_desc, "description", None),
                    # Add other field properties as needed
                }

            formatted_schemas[entity_name] = {
                "name": entity_name,
                "fields": formatted_fields,
            }

        return Response(
            {"relatedData": related_data, "relatedSchemas": formatted_schemas}
        )

    except Exception as e:
        return Response(
            {"error": f"Error fetching related records: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
