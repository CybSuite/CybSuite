from typing import TextIO

from cybsuite.cyberdb import BaseFormatter, Metadata


class IPPortTCPFormatter(BaseFormatter):
    """Format queryset as CSV string."""

    name = "ipport_tcp"
    metadata = Metadata(description="Format to ip:port on TCP protocol")

    def format(self, data: list[dict], output: TextIO, fields: list[str]) -> None:
        for row in data:
            if row["protocol"] != "tcp":
                continue
            output.write(f"{row['host']}:{row['port']}\n")
