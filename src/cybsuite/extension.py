import importlib.util
import inspect
from functools import lru_cache
from importlib import import_module
from importlib.metadata import entry_points
from typing import Union


def load_from_string(path: str):
    if ":" in path:
        module_path, attr = path.split(":")
        module = import_module(module_path)
        return getattr(module, attr)
    else:
        return import_module(path)


def module_exists(module_path: str) -> bool:
    return importlib.util.find_spec(module_path) is not None


class CybSuiteExtension:
    """Class used to extend CybSuite in other Python libraries
    Library declare"""

    ENTRY_POINT_GROUP_NAME = "cybsuite.extensions"
    ALLOWED_PLUGIN_TYPES = {
        "ingestors",
        "cyberdb_scanners",
        "formaters",
        "reporters",
        "reviewers",
        "active_scanners",
    }

    def __init__(
        self,
        name: str = None,
        cyberdb_django_app_name: str = None,
        cyberdb_schema: str = None,
        cyberdb_knowledgebase: str = None,
        cyberdb_cli=None,
        extend_cli_review_function: str = None,
        plugins_module: dict[str, str] = None,
    ):

        self.name = name
        self.cyberdb_django_app_name = cyberdb_django_app_name
        self.cyberdb_schema = cyberdb_schema
        self.cyberdb_knowledgebase = cyberdb_knowledgebase
        self.extend_cli_review_function = extend_cli_review_function
        self.cyberdb_cli = cyberdb_cli

        # Validate plugins_module if provided
        if plugins_module is not None:
            if not isinstance(plugins_module, dict):
                raise TypeError(
                    f"plugins_module must be a dict, got {type(plugins_module)}"
                )

            # Validate that all keys are in the allowed types
            invalid_keys = set(plugins_module.keys()) - self.ALLOWED_PLUGIN_TYPES
            if invalid_keys:
                raise ValueError(
                    f"Invalid plugin types in plugins_module: {invalid_keys}. Allowed types: {self.ALLOWED_PLUGIN_TYPES}"
                )

        self.plugins_module = plugins_module

    @property
    def cyberdb_django_app_label(self):
        if self.cyberdb_django_app_name is None:
            return None
        return self.cyberdb_django_app_name.split(".")[-1]

    @classmethod
    @lru_cache
    def load_extend_cli_review_functions(cls):
        functions = []
        for extension in cls.load_extensions():
            if extension.extend_cli_review_function is None:
                continue
            func = load_from_string(extension.extend_cli_review_function)
            cls._validate_cli_function(func, "extend_cli_review_function")
            functions.append(func)
        return functions

    @classmethod
    @lru_cache
    def load_extensions(cls) -> list["CybSuiteExtension"]:
        extensions = []
        for cybsuite_extension in entry_points(group=cls.ENTRY_POINT_GROUP_NAME):
            extension_config = cybsuite_extension.load()
            if not isinstance(extension_config, CybSuiteExtension):
                # TODO: improve error (name of distribution + exacte key)
                raise ValueError(
                    f"EntryPoint 'cybsuite.extensions' must return {CybSuiteExtension}'"
                )
            extensions.append(extension_config)
        return extensions

    @classmethod
    def load_plugins(cls, plugin_types: Union[str, list[str]]):
        """Load plugins from extensions.

        Args:
            plugin_types: String or list of strings specifying which plugin types to load.
                         Must be one of: 'reviewers', 'ingestors', 'cyberdb_scanner', 'reporters', 'formaters'
        """
        # Normalize plugin_types to a list
        if isinstance(plugin_types, str):
            plugin_types = [plugin_types]
        elif isinstance(plugin_types, list):
            pass
        else:
            raise TypeError("plugin_types must be a string or list of strings")

        # Validate that all requested types are in the whitelist
        invalid_types = set(plugin_types) - cls.ALLOWED_PLUGIN_TYPES
        if invalid_types:
            raise ValueError(
                f"Invalid plugin types: {invalid_types}. Allowed types: {cls.ALLOWED_PLUGIN_TYPES}"
            )

        for extension in cls.load_extensions():
            if extension.plugins_module is None:
                continue

            # Load only the requested plugin types
            for plugin_type in plugin_types:
                if plugin_type in extension.plugins_module:
                    import_module(extension.plugins_module[plugin_type])

    @classmethod
    def _validate_cli_function(cls, func, name):
        """Checks if func is a function with exactly one positional argument."""
        if func is None:
            return

        if not callable(func):
            raise TypeError(f"{name} must be a function")

        sig = inspect.signature(func)
        params = list(sig.parameters.values())

        if not (
            len(params) == 1
            and params[0].kind
            in (
                inspect.Parameter.POSITIONAL_ONLY,
                inspect.Parameter.POSITIONAL_OR_KEYWORD,
            )
        ):
            raise TypeError(f"{name} must have exactly one positional argument")

    def __str__(self):
        return f"{self.__class__.__name__}({self.name})"

    def __repr__(self):
        return self.__str__()
