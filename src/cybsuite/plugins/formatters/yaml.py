from typing import TextIO

import yaml
from cybsuite.cyberdb import BaseFormatter, Metadata


class YAMLFormat(BaseFormatter):
    """Format queryset as YAML."""

    name = "yaml"
    metadata = Metadata(description="Format to YAML")

    def format(self, data: list[dict], output: TextIO, fields: list[str]) -> None:
        # TODO: find solution without lists that wont crash, and handle millions of rows
        if not isinstance(data, list):
            data = list(data)
        yaml.safe_dump(data, output)
