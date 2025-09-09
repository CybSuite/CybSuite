import json
from pathlib import Path

from cybsuite.cyberdb import BaseIngestor, Metadata


class CyberDBIngestor(BaseIngestor):
    name = "cyberdb"

    metadata = Metadata(
        description="Ingest CyberDB export directory containing JSONL files. Feed all tables from exported data."
    )

    def do_run(self, folderpath):
        """Import all JSONL files from the CyberDB export directory"""
        folderpath = Path(folderpath)

        if not folderpath.exists():
            raise FileNotFoundError(f"Directory '{folderpath}' does not exist")

        if not folderpath.is_dir():
            raise ValueError(f"'{folderpath}' is not a directory")

        # Get all .jsonl files in the directory
        jsonl_files = list(folderpath.glob("*.jsonl"))

        if not jsonl_files:
            raise ValueError(f"No .jsonl files found in directory '{folderpath}'")

        imported_count = 0
        error_count = 0

        for jsonl_file in jsonl_files:
            table_name = jsonl_file.stem  # Remove .jsonl extension

            try:
                self.logger.info(f"Importing {table_name} from {jsonl_file}")

                # Read and parse JSONL file
                with open(jsonl_file, "r", encoding="utf-8") as f:
                    for line_num, line in enumerate(f, 1):
                        line = line.strip()
                        if not line:
                            continue

                        try:
                            # Parse JSON line
                            data = json.loads(line)

                            # Feed the data to the database
                            self.cyberdb.feed(table_name, **data)
                            imported_count += 1

                        except json.JSONDecodeError as e:
                            self.logger.error(
                                f"Invalid JSON in {jsonl_file}:{line_num}: {e}"
                            )
                            error_count += 1
                        except Exception as e:
                            self.logger.error(
                                f"Error importing line {line_num} from {jsonl_file}: {e}"
                            )
                            error_count += 1

                self.logger.info(f"Successfully imported {table_name}")

            except Exception as e:
                self.logger.error(
                    f"Error importing {table_name} from {jsonl_file}: {e}"
                )
                error_count += 1

        self.logger.info(
            f"Import completed: {imported_count} records imported, {error_count} errors"
        )
        return {
            "imported_count": imported_count,
            "error_count": error_count,
            "files_processed": len(jsonl_files),
        }
