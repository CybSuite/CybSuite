import json
from functools import cache

from cybsuite.cyberdb import BaseIngestor, Metadata


class SmbthingIngestor(BaseIngestor):
    name = "smbthing"
    extension = ".json"

    metadata = Metadata(
        description="Ingestor for smbthing JSON/JSONL files",
    )

    @cache
    def _get_host(self, ip):
        return self.cyberdb.feed("host", ip=ip)[0]

    def _process_entry(self, data):
        """Process a single SMB entry."""
        host = self._get_host(data["target"])
        metadata = {
            "host": host,
            "share": data["share"],
            "directory": data["directory"],
            "file": data["filename"],
            "size": data["size"],
            "is_directory": bool(data["is_directory"]),
        }
        try:
            self.cyberdb.feed("smb_file", **metadata)
        except Exception as e:
            self.logger.error(
                f"Error feeding smb_file: {e.__class__.__name__} {str(e)}"
            )
            self.logger.debug(f"Problematic metadata: {metadata}")

    def do_run(self, filepath):
        self.logger.info(f"Processing smbthing data from {filepath}")
        with open(filepath) as f:
            if filepath.endswith(".json"):
                # Handle single JSON file
                data_list = json.load(f)
                entries = data_list if isinstance(data_list, list) else [data_list]
                for data in entries:
                    self._process_entry(data)
            else:
                # Handle JSONL file (line by line)
                for line in f:
                    data = json.loads(line)
                    self._process_entry(data)
