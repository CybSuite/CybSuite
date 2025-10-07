from cybsuite.cyberdb import CyberDB, cyberdb_schema, pm_reporters
from django.db.models import Count, F, Q, Value
from django.db.models.functions import Coalesce
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .app_views.control_views import *  # noqa: F401
from .app_views.data_views import *  # noqa: F401
from .app_views.plugins_views import *  # noqa: F401
from .app_views.schema_views import *  # noqa: F401
from .navbar_application import nav_links
from .pretty_id_utils import generate_pretty_id, get_entity_pretty_id_config
from .utils import SEVERITY_RANKS


# Navigation Bar
@api_view(["GET"])
def get_navbar(request):
    """Get the navigation bar structure"""
    return Response(nav_links(request))


# Homepage Data
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
