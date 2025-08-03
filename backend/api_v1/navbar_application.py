"""
USAGE GUIDE:
-----------
1. Create lists of NavSideMenuItem objects.
2. Create NavSideMenu objects and add NavSideMenuItem objects to them.
3. Create lists of NavMenuDropListItem objects and add NavSideMenu objects to them.
4. Create NavMenuItem objects and add NavMenuDropListItem objects to them.
5. Create NavApplication objects and add NavMenuItem objects to them.
6. Create NavApplicationSet object and add NavApplication objects to it.

METHODS:
--------
1. add(): adds item depends on the class type.
2. NavApplicationSet.select(): selects the NavApplication object.
3. NavApplicationSet.set_selected_view(): sets the selected view (in NavMenuDropListItem and NavSideMenuItem) and returns list of NavMenuDropListItem.
4. NavMenuDropListItem.set_side_menu(): sets the side menu for the NavMenuDropListItem.

SIDE_MENU USAGE:
------
To create a sidemenu in the page, you need to create a namespace in the urlpatterns, which includes all the views that
you want to show in the side-menu. Then when creating NavSideMenu you need to make sure you set the correct namespace,
and its NavSideMenuItems view values should be included in that same namespace. Example:

# in urls.py:
app_name = "myapp"

page4_urlpatterens = [
    path("", views.page_view3, name="index"),
    path("1/", views.page_view4_1, name="page4-1"),
    path("2/", views.page_view4_2, name="page4-2"),
    path("3/", views.page_view4_3, name="page4-3"),
]

urlpatterns = [
    ...,
    path("4/", include((page4_urlpatterens, "page4"))),     # the namespace is "page4"
    ...
]

# in navigation definition file (context_processors.py):
page_4_side_menu = NavSideMenu(namespace="page4", side_menu_items=[
    NavSideMenuItem(name="Page 4-1", view="myapp:page4:page4-1"),
    NavSideMenuItem(name="Page 4-2", view="myapp:page4:page4-2"),
    NavSideMenuItem(name="Page 4-3", view="myapp:page4:page4-3"),
])
"""


from typing import Dict, List, Optional


class NavApplicationSet:
    def __init__(
        self,
        nav_applications: Optional[Dict[str, "NavApplication"]] = None,
        settings_item: Optional["NavMenuDropListItem"] = None,
    ):
        self.nav_applications = nav_applications if nav_applications is not None else {}
        self.settings_item = (
            NavMenuDropListItem("settings", settings_item.view, settings_item.side_menu)
            if settings_item is not None
            else NavMenuDropListItem("settings", "securitysuiteui:dummy")
        )

    def add(
        self,
        nav_application: Optional["NavApplication"] = None,
        name: Optional[str] = None,
        color: Optional[str] = None,
        menu: Optional["NavMenu"] = None,
    ) -> "NavApplication":

        if (nav_application is None and (name is None or color is None)) or (
            nav_application is not None
            and (name is not None or color is not None or menu is not None)
        ):
            raise ValueError(
                "Invalid arguments: Either pass a NavApplication or a name and color with/without menu."
            )

        if nav_application is None:
            nav_application = NavApplication(name, color, menu)

        self.nav_applications[nav_application.name] = nav_application
        return self.nav_applications[nav_application.name]

    def select(self, nav_application_name: str):
        for nav_app_name, nav_app in self.nav_applications.items():
            if nav_app_name == nav_application_name:
                nav_app.is_selected = True
            else:
                nav_app.is_selected = False

    def set_selected_view(self, current_view: str) -> List["NavSideMenuItem"]:
        side_menu_list = []
        for drop_item in [self.settings_item]:
            if (
                drop_item.namespace == current_view.split(":")[-2]
                and drop_item.side_menu is not None
            ):
                for side_menu_item in drop_item.side_menu:
                    if side_menu_item.view == current_view:
                        drop_item.is_selected = True
                        side_menu_item.is_selected = True
                        if len(side_menu_list) == 0:
                            side_menu_list = drop_item.side_menu.side_menu_items

            if drop_item.view == current_view:
                drop_item.is_selected = True

                if len(side_menu_list) == 0:
                    side_menu_list = (
                        drop_item.side_menu.side_menu_items
                        if drop_item.side_menu
                        else []
                    )

        for nav_app in self.nav_applications.values():
            # ignore unselected nav_apps
            if not nav_app.is_selected:
                continue

            # do selection and return the side menu
            for menu_item in nav_app.menu:
                for drop_item in menu_item.droplist_items:
                    if (
                        drop_item.namespace == current_view.split(":")[-2]
                        and drop_item.side_menu is not None
                    ):
                        for side_menu_item in drop_item.side_menu:
                            if side_menu_item.view == current_view:
                                drop_item.is_selected = True
                                side_menu_item.is_selected = True
                                if len(side_menu_list) == 0:
                                    side_menu_list = drop_item.side_menu.side_menu_items

                    if drop_item.view == current_view:
                        drop_item.is_selected = True

                        if len(side_menu_list) == 0:
                            side_menu_list = (
                                drop_item.side_menu.side_menu_items
                                if drop_item.side_menu
                                else []
                            )

        return side_menu_list

    def to_dict(self):
        return {
            "nav_applications": {
                name: app.to_dict() for name, app in self.nav_applications.items()
            },
            "settings_item": self.settings_item.to_dict(),
        }

    def __iter__(self):
        return iter(self.nav_applications.values())

    def __getitem__(self, key: str) -> "NavApplication":
        return self.nav_applications[key]


class NavApplication:
    def __init__(
        self,
        name: str,
        color: str,
        menu: Optional["NavMenu"] = None,
        is_selected: Optional[bool] = None,
    ):
        self.name = name
        self.color = color
        self.menu = menu if menu is not None else NavMenu()
        self.is_selected = is_selected if is_selected is not None else False

    def add(
        self,
        nav_menu_item: Optional["NavMenuItem"] = None,
        name: Optional[str] = None,
        droplist_items: Optional[List["NavMenuDropListItem"]] = None,
    ) -> "NavMenuItem":
        if (nav_menu_item is None and name is None) or (
            nav_menu_item is not None
            and (name is not None or droplist_items is not None)
        ):
            raise ValueError(
                "Invalid arguments: Either pass a NavMenuItem or a name with/without droplist_items."
            )

        if nav_menu_item is not None:
            self.menu.add(nav_menu_item)
            return self.menu[nav_menu_item.name]

        self.menu.add(NavMenuItem(name, droplist_items))
        return self.menu[name]

    def to_dict(self):
        return {
            "name": self.name,
            "color": self.color,
            "menu": self.menu.to_dict(),
            "is_selected": self.is_selected,
        }

    def __iter__(self):
        return iter(self.menu)

    def __getitem__(self, key: str) -> "NavMenu":
        return self.menu[key]


class NavMenu:
    def __init__(
        self,
        nav_menu_items: Optional[Dict[str, "NavMenuItem"]] = None,
    ):
        self.nav_menu_items = nav_menu_items if nav_menu_items is not None else {}

    def add(
        self,
        nav_menue_item: Optional["NavMenuItem"],
        name: Optional[str] = None,
        droplist: Optional[List["NavMenuDropListItem"]] = None,
    ):
        if (nav_menue_item is None and (name is None)) or (
            nav_menue_item is not None and name is not None
        ):
            raise ValueError(
                "Invalid arguments: Either pass a NavMenuItem or a name with/without droplist."
            )

        if nav_menue_item is None:
            nav_menue_item = NavMenuItem(name, droplist)

        self.nav_menu_items[nav_menue_item.name] = nav_menue_item

    def to_dict(self):
        return {
            "nav_menu_items": {
                name: item.to_dict() for name, item in self.nav_menu_items.items()
            }
        }

    def __iter__(self):
        return iter(self.nav_menu_items.values())

    def __getitem__(self, key: str) -> "NavMenuItem":
        return self.nav_menu_items[key]


class NavMenuItem:
    def __init__(
        self,
        name: str,
        droplist_items: Optional[List["NavMenuDropListItem"]] = None,
    ):
        self.name = name
        self.droplist_items = droplist_items if droplist_items is not None else []

    def add(
        self,
        droplist_item: Optional["NavMenuDropListItem"] = None,
        name: Optional[str] = None,
        view: Optional[str] = None,
    ):
        if (droplist_item is None and (name is None or view is None)) or (
            droplist_item is not None and (name is not None or view is not None)
        ):
            raise ValueError(
                "Invalid arguments: Either pass a NavMenuDropListItem or a name and view."
            )

        self.droplist_items.append(droplist_item)

    def to_dict(self):
        return {
            "name": self.name,
            "droplist_items": [item.to_dict() for item in self.droplist_items],
        }

    def __iter__(self):
        return iter(self.droplist_items)

    def __getitem__(self, index: int) -> "NavMenuDropListItem":
        return self.droplist_items[index]


class NavMenuDropListItem:
    def __init__(
        self,
        name: str,
        view: str,
        side_menu: Optional["NavSideMenu"] = None,
        is_selected: Optional[bool] = None,
    ):
        self.namespace = view.split(":")[-2]
        if side_menu is not None and self.namespace != side_menu.namespace:
            raise ValueError(
                f"Invalid arguments: The side menu namespace '{side_menu.namespace}' does not match the drop list item namespace '{self.namespace}'."
            )

        self.name = name
        self.view = view
        self.side_menu = side_menu if side_menu is not None else None
        self.is_selected = is_selected if is_selected is not None else False

    def set_side_menu(
        self,
        side_menu: Optional["NavSideMenu"] = None,
        namespace: Optional[str] = None,
        side_menu_items: Optional[List["NavSideMenuItem"]] = None,
    ):
        if (
            side_menu is None
            and (namespace is None)
            or side_menu is not None
            and (namespace is not None or side_menu_items is not None)
        ):
            raise ValueError(
                "Invalid arguments: Either pass a NavSideMenu or a namespace with/without side_menu_items."
            )

        if side_menu is None:
            side_menu = NavSideMenu(namespace, side_menu_items)

        if self.namespace != side_menu.namespace:
            raise ValueError(
                f"Invalid arguments: The side menu namespace '{side_menu.namespace}' does not match the drop list item namespace '{self.namespace}'."
            )

        self.side_menu = side_menu

    def add(
        self,
        side_menu_item: Optional["NavSideMenuItem"] = None,
        name: Optional[str] = None,
        view: Optional[str] = None,
    ) -> "NavSideMenuItem":

        return self.side_menu.add(side_menu_item, name, view)

    def get_view_name(self):
        view_parts = self.view.split("/")
        return view_parts[0]

    def to_dict(self):
        return {
            "name": self.name,
            "view": self.view,
            "namespace": self.namespace,
            "side_menu": self.side_menu.to_dict() if self.side_menu else None,
            "is_selected": self.is_selected,
        }

    def __iter__(self):
        return iter(self.side_menu.side_menu_items)

    def __getitem__(self, index: int) -> "NavSideMenuItem":
        return self.side_menu.side_menu_items[index]


class NavSideMenu:
    def __init__(
        self,
        namespace: str,
        side_menu_items: Optional[List["NavSideMenuItem"]] = None,
    ):
        self.namespace = namespace
        self.side_menu_items = side_menu_items if side_menu_items is not None else []

    def compare_namespace(self, namespace: str) -> bool:
        return self.namespace == namespace.split(":")[-1]

    def add(
        self,
        side_menu_item: Optional["NavSideMenuItem"] = None,
        name: Optional[str] = None,
        view: Optional[str] = None,
    ) -> "NavSideMenuItem":
        if (side_menu_item is None and (name is None or view is None)) or (
            side_menu_item is not None and (name is not None or view is not None)
        ):
            raise ValueError(
                "Invalid arguments: Either pass a NavSideMenuItem or a name and view."
            )

        if (
            side_menu_item is not None
            and not self.compare_namespace(side_menu_item.get_view_name())
            or view is not None
            and not self.compare_namespace(view)
        ):
            raise ValueError(
                "Invalid arguments: The view namespace does not match the side menu namespace."
            )

        if side_menu_item is None:
            side_menu_item = NavSideMenuItem(name, view)

        self.side_menu_items.append(side_menu_item)
        return self.side_menu_items[-1]

    def to_dict(self):
        return {
            "namespace": self.namespace,
            "side_menu_items": [item.to_dict() for item in self.side_menu_items],
        }

    def __iter__(self):
        return iter(self.side_menu_items)

    def __getitem__(self, index: int) -> "NavSideMenuItem":
        return self.side_menu_items[index]


class NavSideMenuItem:
    def __init__(self, name: str, view: str, is_selected: Optional[bool] = None):
        self.name = name
        self.view = view
        self.is_selected = is_selected if is_selected is not None else False

    def get_view_name(self):
        view_parts = self.view.split("/")
        return view_parts[0]

    def to_dict(self):
        return {"name": self.name, "view": self.view, "is_selected": self.is_selected}


# NAVIGATION DEFINITION #
# ===================== #
import copy

from cybsuite.cyberdb import cyberdb_schema
from django.http import HttpRequest
from django.urls import resolve, reverse


def convert_django_url_to_nextjs_path(django_url: str) -> str:
    """
    Convert Django URL names to Next.js compatible paths
    """
    try:
        # Try to reverse the URL to get the actual path
        path = reverse(django_url)
        return path
    except Exception:
        # If reverse fails, create a Next.js compatible path from the URL name
        if ":" in django_url:
            parts = django_url.split(":")
            if len(parts) == 2:
                app, view = parts
                if view == "dummy":
                    return "/placeholder"
                # Handle specific cases for better routing
                if app == "data" and view.startswith("list/"):
                    model_name = view.replace("list/", "")
                    return f"/data/{model_name}"
                elif app == "features":
                    return f"/features/{view}"
                elif app == "settings":
                    return f"/settings/{view}"
                else:
                    return f"/{app}/{view}"
            elif len(parts) == 3:
                app, namespace, view = parts
                if app == "settings" and namespace == "settings":
                    return f"/settings/{view}"
                else:
                    return f"/{app}/{namespace}/{view}"

        # Handle specific URL patterns
        if django_url.startswith("data:list/"):
            model_name = django_url.replace("data:list/", "")
            return f"/data/{model_name}"

        # Fallback for simple URLs
        if django_url == "securitysuiteui:dummy":
            return "/placeholder"

        return f"/{django_url.replace(':', '/')}"


def build_menu_knowledgebase():
    items = [
        NavMenuDropListItem(
            "Observations & Controls",
            view=f"data:list/observation_template_translation",
        )
    ]
    for entity in cyberdb_schema.filter(tags="knowledgebase"):
        items.append(
            NavMenuDropListItem(
                entity.pretty_name.title(), view=f"data:list/{entity.name}"
            )
        )

    return NavMenuItem(
        "KnowledgeBase",
        droplist_items=items,
    )


def build_menu_reporting():
    return NavMenuItem(
        "Reporting",
        droplist_items=[
            NavMenuDropListItem("Observations", view="data:list/observation"),
            NavMenuDropListItem("Controls", view="securitysuiteui:dummy"),
            NavMenuDropListItem("Reporting", view="securitysuiteui:dummy"),
        ],
    )


def build_menu_missions():
    return NavMenuItem(
        "Missions",
        droplist_items=[
            NavMenuDropListItem("Clients", view="data:list/client"),
            NavMenuDropListItem("Missions", view="data:list/mission"),
        ],
    )


def build_menu_linux_review():
    items = []
    for entity in cyberdb_schema.filter(tags="linux_review"):
        items.append(
            NavMenuDropListItem(
                entity.pretty_name.title(), view=f"data:list/{entity.name}"
            )
        )

    return NavMenuItem(
        "Linux Review",
        droplist_items=items,
    )


def build_menu_ms365():
    items = []
    for entity in cyberdb_schema.filter(tags="ms365"):
        items.append(
            NavMenuDropListItem(
                entity.pretty_name.title(), view=f"data:list/{entity.name}"
            )
        )

    return NavMenuItem(
        "Microsoft 365",
        droplist_items=items,
    )


def build_menu_pentest_web():
    items = []
    for entity in cyberdb_schema.filter(tags="web"):
        items.append(
            NavMenuDropListItem(
                entity.pretty_name.title(), view=f"data:list/{entity.name}"
            )
        )

    return NavMenuItem(
        "Pentest Web",
        droplist_items=items,
    )


# Building Applications #
# ===================== #
nav_app_basic = NavApplication("Base UI", color="gray")
nav_app_pentest_internal = NavApplication("Pentest Internal", color="orange")
nav_app_pentest_web = NavApplication("Pentest Web", color="blue")
nav_app_pentest_extern = NavApplication("Pentest Extern", color="green")
nav_app_configuration_review = NavApplication("Configuration review", color="black")
all_applications = [
    nav_app_basic,
    nav_app_pentest_internal,
    nav_app_pentest_web,
    nav_app_pentest_extern,
    nav_app_configuration_review,
]
# Basic UI #


# Pentest UI #
nav_app_pentest_internal.add(
    nav_menu_item=NavMenuItem(
        "Schema",
        droplist_items=[
            NavMenuDropListItem("Schema", view="schema:"),
        ],
    ),
)

nav_app_pentest_internal.add(
    name="Explore",
    droplist_items=[
        NavMenuDropListItem("Hosts", view="data:list/host"),
        NavMenuDropListItem("Services", view="data:list/service"),
        NavMenuDropListItem("DNS", view="data:list/dns"),
        NavMenuDropListItem("Passwords", view="data:list/password"),
        NavMenuDropListItem("Hash", view="data:list/hash"),
    ],
)

nav_app_pentest_internal.add(
    name="Active Directory",
    droplist_items=[
        NavMenuDropListItem("Domains", view="data:list/ad_domain"),
        NavMenuDropListItem("AD Users", view="data:list/ad_user"),
        NavMenuDropListItem("Computers", view="data:list/ad_computer"),
        NavMenuDropListItem("Windows User", view="data:list/windows_user"),
    ],
)

nav_app_pentest_internal.add(
    name="Services",
    droplist_items=[
        NavMenuDropListItem("HTTP", view="securitysuiteui:dummy"),
        NavMenuDropListItem("FTP", view="securitysuiteui:dummy"),
        NavMenuDropListItem("SMB", view="securitysuiteui:dummy"),
    ],
)

nav_app_pentest_internal.add(
    name="Features",
    droplist_items=[
        NavMenuDropListItem("Ingestors", view="features:ingestors"),
        NavMenuDropListItem("Scanners", view="features:scanners"),
        NavMenuDropListItem("Wordlist Generator", view="features:wordlist_generator"),
    ],
)


nav_app_pentest_web.add(build_menu_pentest_web())

# Configuration review app
nav_app_configuration_review.add(build_menu_linux_review())

for nav_app in all_applications:
    nav_app.add(build_menu_missions())
    nav_app.add(build_menu_reporting())
    nav_app.add(build_menu_knowledgebase())

# SETTINGS PAGE MENU ITEM SETUP #
settings_item = NavMenuDropListItem(
    name="settings",
    view="settings:index",
    side_menu=NavSideMenu(
        "settings", [NavSideMenuItem("Databases", "settings:settings:databases")]
    ),
)

# BUILDING THE NAVIGATION APPLICATION SET #
# ======================================= #
nav_applications = NavApplicationSet(settings_item=settings_item)
nav_applications.add(nav_app_basic)
nav_applications.add(nav_app_pentest_internal)
nav_applications.add(nav_app_pentest_web)
nav_applications.add(nav_app_pentest_extern)
nav_applications.add(nav_app_configuration_review)


def nav_links(request: HttpRequest):
    """
    Context processor to add the navigation links to the context
    Optimized for Next.js frontend consumption
    """

    # Get the current view name
    resolver_match = resolve(request.path_info)
    current_url_name = resolver_match.url_name
    kwargs = resolver_match.kwargs
    namespace = resolver_match.namespace
    if namespace:
        current_view = f"{namespace}:{current_url_name}"
    else:
        current_view = current_url_name

    if kwargs:
        current_view = f"{current_view}/" + "/".join(
            [str(value) for value in kwargs.values()]
        )

    # Set the selected app from the request cookie
    nav_apps = copy.deepcopy(nav_applications)
    first_app = list(nav_apps.nav_applications.keys())[0]
    selected_nav_app = request.COOKIES.get("nav_app", first_app)

    # URL decode the cookie value in case it's encoded
    try:
        from urllib.parse import unquote

        decoded_nav_app = (
            unquote(selected_nav_app) if selected_nav_app else selected_nav_app
        )
        selected_nav_app = decoded_nav_app
    except Exception:
        # If decoding fails, use the original value
        pass

    # Validate that the selected app exists, fall back to first app if not
    if selected_nav_app not in nav_apps.nav_applications:
        selected_nav_app = first_app

    nav_apps.select(selected_nav_app)

    # Set the selected drop list item and the side list item - and get the side menu list
    side_menu_list = nav_apps.set_selected_view(current_view)

    # Build simplified structure for Next.js
    current_app = nav_apps[selected_nav_app]

    # Create simplified navigation structure
    navigation = {
        # Current application info
        "current_app": {
            "name": current_app.name,
            "color": current_app.color,
            "is_selected": current_app.is_selected,
        },
        # Available applications for app switcher
        "available_apps": [
            {"name": app.name, "color": app.color, "is_selected": app.is_selected}
            for app in nav_apps
        ],
        # Current app's navigation items
        "navbar_items": [
            {
                "name": menu_item.name,
                "items": [
                    {
                        "name": item.name,
                        "url": convert_django_url_to_nextjs_path(item.view),
                        "is_selected": item.is_selected,
                        "has_sidebar": item.side_menu is not None,
                    }
                    for item in menu_item.droplist_items
                ],
            }
            for menu_item in current_app.menu
        ],
        # Sidebar items (if current page has sidebar)
        "sidebar": {
            "has_sidebar": len(side_menu_list) > 0,
            "items": [
                {
                    "name": item.name,
                    "url": convert_django_url_to_nextjs_path(item.view),
                    "is_selected": item.is_selected,
                }
                for item in side_menu_list
            ]
            if side_menu_list
            else [],
        },
        # User menu items
        "user_menu": {
            "settings": {
                "name": "Settings",
                "url": convert_django_url_to_nextjs_path(nav_apps.settings_item.view),
                "is_selected": nav_apps.settings_item.is_selected,
            }
        },
        # Meta information
        "meta": {
            "current_view": current_view,
            "current_url_name": current_url_name,
            "namespace": namespace,
        },
    }

    return navigation
