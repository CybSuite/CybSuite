from pathlib import Path

from cybsuite.cyberdb import BaseIngestor, Metadata


class HashcatIngestor(BaseIngestor):
    name = "hashcat"
    metadata = Metadata(description="Ingest hashcat potfile. Feed password, hash.")
    autodetect_is_file = True

    DEFAULT_PATH = Path("~/.local/share/hashcat/hashcat.potfile").expanduser()

    @classmethod
    def autodetect_from_path(cls, path: Path) -> bool:
        if str(path).endswith(".potfile"):
            return True
        return False

    def do_run(self, filepath: Path = None):
        if filepath is None:
            filepath = self.DEFAULT_PATH

        with open(filepath) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                hash, password = line.split(":")
