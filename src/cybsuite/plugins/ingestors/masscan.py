import re
from pathlib import Path

from cybsuite.cyberdb import BaseIngestor, Metadata


class MasscanIngestor(BaseIngestor):
    name = "masscan"
    metadata = Metadata(
        description="Ingest masscan output file. In auto-ingest files ending with 'masscan.txt' will be ingested. Feed host and service."
    )

    autodetect_is_file = True
    _autodetect_re = re.compile(r"Discovered open port \d+")

    @classmethod
    def autodetect_from_path(cls, path: Path) -> bool:
        if path.name.endswith("masscan.txt"):
            return True
        elif cls._autodetect_re.match(cls.autodetect_get_first_500_chars(path)):
            return True
        return False

    def do_run(self, filepath):
        for line in self.iter_lines_from_filepath(filepath):
            _, _, _, port_service, _, ip = line.split()
            port, protocol = port_service.split("/")
            port = int(port)
            if protocol == "icmp":
                # ping
                # TODO: unitest ICMP
                self.cyberdb.feed("host", ip=ip)
            else:
                self.cyberdb.feed("service", host=ip, port=port, protocol=protocol)
