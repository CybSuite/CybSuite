import shutil
from pathlib import Path

from cybsuite.review.windows import Metadata, WindowsReviewer


class ConsolidatorReviewer(WindowsReviewer):
    name = "consolidator"
    metadata = Metadata(
        category="windows",
        description="Consolidate extracts by grouping them by file. To do manual review on specific file for all hosts",
    )
    files = {"commands": "commands"}

    # Maximum file size in bytes (10MB)
    MAX_FILE_SIZE = 10 * 1024 * 1024

    def do_run(self, files):
        filepath_commands = files["commands"]
        hostname = self.context.hostname

        # Check if commands directory exists
        if not filepath_commands or not filepath_commands.exists():
            return

        # Get global output path and create consolidator subdirectory
        global_output_path = self.context.global_output_path / "consolidator"

        # Process each file in the commands directory
        for file_path in filepath_commands.iterdir():
            if file_path.is_file():
                self._process_command_file(file_path, hostname, global_output_path)

    def _process_command_file(
        self, source_file: Path, hostname: str, global_output_path: Path
    ):
        """Process a single command file and copy it to the consolidated structure"""
        try:
            # Check file size
            file_size = source_file.stat().st_size
            if file_size > self.MAX_FILE_SIZE:
                return

            # Create directory structure: /output/filename.ext/hostname.ext
            file_extension = source_file.suffix
            file_stem = source_file.stem

            # Create directory named after the file (without extension)
            output_dir = global_output_path / f"{file_stem}{file_extension}"
            output_dir.mkdir(parents=True, exist_ok=True)

            # Create output file path with hostname
            output_file = output_dir / f"{hostname}{file_extension}"

            # Copy file using shutil
            shutil.copy2(source_file, output_file)

            # If it's a .txt file, also append to all.txt
            if file_extension == ".txt":
                self._append_to_all_txt(source_file, hostname, output_dir)

        except Exception as e:
            self.warning(f"Failed to process {source_file.name}: {str(e)}")

    def _append_to_all_txt(self, source_file: Path, hostname: str, output_dir: Path):
        """Append content to all.txt file with hostname separator"""
        all_txt_path = output_dir / "all.txt"

        try:
            with open(all_txt_path, "a", encoding="utf-8", errors="ignore") as all_file:
                # Write hostname separator
                all_file.write(f"------- {hostname} -------\n")

                # Read and write content in chunks to avoid memory issues
                with open(
                    source_file, "r", encoding="utf-8", errors="ignore"
                ) as source:
                    while True:
                        chunk = source.read(8192)  # Read 8KB chunks
                        if not chunk:
                            break
                        all_file.write(chunk)

        except Exception as e:
            self.warning(f"Failed to append {source_file.name} to all.txt: {str(e)}")
