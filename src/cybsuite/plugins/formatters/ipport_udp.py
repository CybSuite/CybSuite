from typing import TextIO

from cybsuite.cyberdb import BaseFormatter, Metadata


class IPPortUDPFormatter(BaseFormatter):
    """Format queryset as CSV string."""

    name = "ipport_udp"
    metadata = Metadata(description="Format to ip:port on UDP protocol")

    def format(self, data: list[dict], output: TextIO, fields: list[str]) -> None:
        for row in data:
            if row["protocol"] != "udp":
                continue
            output.write(f"{row['host']}:{row['port']}\n")
