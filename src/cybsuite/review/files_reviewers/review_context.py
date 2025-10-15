from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any


@dataclass
class ReviewContext:
    """Context data that changes between hosts and plugins. Each plugin have access to it and context can be changed between each run and moment of the review flow."""

    # Hostname of current host being reviewed
    hostname: str
    # Datetime of extraction of the host (or service)
    extract_datetime: datetime
    host_extracts_path: Path
    global_output_path: Path
    host_output_path: Path
    # Global data is shared between all plugins of same type (ex: all windows reviewers)
    #  It is reset between evey type
    global_data: dict[str, Any] = field(default_factory=dict)
    # Plugin data is specific to a plugin, ann wants another plugin to use it
    plugin_data: dict[str, dict[str, Any]] = field(default_factory=dict)

    def get_plugin_data(self, plugin_name: str) -> dict[str, Any]:
        """Get data for a specific plugin, creating it if it doesn't exist."""
        if plugin_name not in self.plugin_data:
            self.plugin_data[plugin_name] = {}
        return self.plugin_data[plugin_name]
