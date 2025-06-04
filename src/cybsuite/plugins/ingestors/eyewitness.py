import csv
import os
from pathlib import Path

from cybsuite.cyberdb import BaseIngestor, Metadata


class EyewitnessIngestor(BaseIngestor):
    name = "eyewitness"
    extension = ".txt"

    metadata = Metadata(
        description="Ingest Eyewitness scan results folder containing screenshots and metadata"
    )

    def do_run(self, folderpath):
        # Read the Requests.csv file
        requests_file = os.path.join(folderpath, "Requests.csv")
        if not os.path.exists(requests_file):
            raise ValueError(f"Could not find Requests.csv in {folderpath}")

        with open(requests_file) as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Extract metadata with direct dictionary access
                metadata = {
                    "protocol": row["Protocol"],
                    "port": row["Port"],
                    "domain": row["Domain"],
                    "resolved": row["Resolved"],
                    "status": row["Request Status"],
                    "title": row["Title"],
                    "category": row["Category"],
                    "default_creds": row["Default Creds"],
                    "screenshot": row["Screenshot Path"],
                    "source": row[
                        " Source Path"
                    ].strip(),  # Note the space in column name
                }

                # Clean up paths to be relative to the folder
                if metadata["screenshot"]:
                    try:
                        metadata["screenshot"] = os.path.relpath(
                            metadata["screenshot"], "/workspace/scans/eyewitness"
                        )
                    except ValueError:
                        metadata["screenshot"] = ""

                if metadata["source"]:
                    try:
                        metadata["source"] = os.path.relpath(
                            metadata["source"], "/workspace/scans/eyewitness"
                        )
                    except ValueError:
                        metadata["source"] = ""

                # Create a unique identifier for this entry
                name = f"{metadata['protocol']}_{metadata['domain']}_{metadata['port']}"

                debug(metadata)
