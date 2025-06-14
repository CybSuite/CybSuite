import argparse
import hashlib
import os
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import DefaultDict, List

from cybsuite.scanners.base_plugin import BasicScanner, Metadata
from rich.console import Console
from rich.progress import (
    BarColumn,
    Progress,
    SpinnerColumn,
    TaskProgressColumn,
    TextColumn,
)

console = Console()


@dataclass
class SizeRange:
    name: str
    size: int

    def contains(self, file_size: int, next_range_size: int | None) -> bool:
        if next_range_size is None:  # Last range
            return file_size >= self.size
        return self.size <= file_size < next_range_size


# Define size ranges relevant for LLM processing
SIZE_RANGES = [
    SizeRange("< 200B", 0),
    SizeRange("< 500B", 200),
    SizeRange("< 1KB", 500),
    SizeRange("< 5KB", 1024),
    SizeRange("< 10KB", 5 * 1024),
    SizeRange("< 50KB", 10 * 1024),
    SizeRange("< 100KB", 50 * 1024),
    SizeRange("< 500KB", 100 * 1024),
    SizeRange("< 1MB", 500 * 1024),
    SizeRange("< 5MB", 1024 * 1024),
    SizeRange("< 10MB", 5 * 1024 * 1024),
    SizeRange("≥ 10MB", 10 * 1024 * 1024),
]


def human_readable_size(size_in_bytes: int) -> str:
    """Convert bytes to human readable string."""
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size_in_bytes < 1024.0:
            return f"{size_in_bytes:.1f} {unit}"
        size_in_bytes /= 1024.0
    return f"{size_in_bytes:.1f} PB"


def calculate_file_hash(filepath: Path, chunk_size: int = 8192) -> str:
    """Calculate SHA-256 hash of a file in chunks to handle large files efficiently."""
    sha256_hash = hashlib.sha256()
    try:
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(chunk_size), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()
    except (PermissionError, FileNotFoundError) as e:
        console.print(f"[red]Error processing {filepath}: {str(e)}[/red]")
        return None


def find_files(directory: Path) -> List[Path]:
    """Recursively find all files in a directory."""
    files = []
    try:
        for entry in os.scandir(directory):
            if entry.is_file():
                files.append(Path(entry.path))
            elif entry.is_dir():
                files.extend(find_files(Path(entry.path)))
    except PermissionError as e:
        console.print(f"[red]Error accessing {directory}: {str(e)}[/red]")
    return files


def get_size_category(size: int) -> str:
    """Get the category name for a given file size."""
    for i, range_def in enumerate(SIZE_RANGES):
        next_range = SIZE_RANGES[i + 1] if i < len(SIZE_RANGES) - 1 else None
        next_size = next_range.size if next_range else None
        if range_def.contains(size, next_size):
            return range_def.name
    return "Unknown"


class FileAnalysis:
    def __init__(self):
        self.size_counts = defaultdict(int)
        self.hash_groups: DefaultDict[str, List[Path]] = defaultdict(list)
        self.extension_counts = Counter()
        self.extension_sizes = defaultdict(int)
        self.total_files = 0
        self.total_size = 0
        self.duplicate_files = 0
        self.duplicate_groups = 0
        self.space_wasted = 0

        # Stats for unique files only
        self.unique_size_counts = defaultdict(int)
        self.unique_extension_counts = Counter()
        self.unique_extension_sizes = defaultdict(int)
        self.unique_total_files = 0
        self.unique_total_size = 0

    def analyze_directory(self, directory: Path) -> None:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            console=console,
        ) as progress:
            # Find all files
            count_task = progress.add_task("Finding files...", total=None)
            files = find_files(directory)
            self.total_files = len(files)
            progress.update(count_task, total=self.total_files)

            # Analyze files
            analyze_task = progress.add_task(
                "Analyzing files...", total=self.total_files
            )

            for file_path in files:
                try:
                    # Get file size and update size statistics
                    size = file_path.stat().st_size
                    self.total_size += size
                    self.size_counts[get_size_category(size)] += 1

                    # Get file extension and update extension statistics
                    ext = file_path.suffix.lower()
                    if ext:  # Only count files with extensions
                        self.extension_counts[ext] += 1
                        self.extension_sizes[ext] += size

                    # Calculate hash for duplication check
                    file_hash = calculate_file_hash(file_path)
                    if file_hash:
                        self.hash_groups[file_hash].append(file_path)

                except (PermissionError, FileNotFoundError) as e:
                    console.print(f"[red]Error processing {file_path}: {str(e)}[/red]")

                progress.update(analyze_task, advance=1)

        # Calculate statistics for unique files
        seen_hashes = set()
        for hash_value, files in self.hash_groups.items():
            # Take only the first file from each hash group (it's the unique one)
            unique_file = files[0]
            size = unique_file.stat().st_size
            ext = unique_file.suffix.lower()

            self.unique_total_files += 1
            self.unique_total_size += size
            self.unique_size_counts[get_size_category(size)] += 1

            if ext:  # Only count files with extensions
                self.unique_extension_counts[ext] += 1
                self.unique_extension_sizes[ext] += size

        # Calculate duplication statistics
        for hash_value, files in self.hash_groups.items():
            if len(files) > 1:
                self.duplicate_groups += 1
                self.duplicate_files += len(files) - 1
                self.space_wasted += files[0].stat().st_size * (len(files) - 1)

    def display_results(self, top_extensions: int = 10) -> None:
        console.print(
            "\n[bold green]File Analysis Results (Including Duplicates)[/bold green]"
        )

        # Basic statistics
        console.print(f"\n[bold cyan]General Statistics:[/bold cyan]")
        console.print(f"Total files analyzed: {self.total_files:,}")
        console.print(
            f"Total size: {human_readable_size(self.total_size)} ({self.total_size:,} bytes)"
        )

        # Size distribution with cumulative counts and percentages
        console.print(f"\n[bold cyan]Size Distribution:[/bold cyan]")
        cumulative_count = 0
        for range_def in SIZE_RANGES:
            count = self.size_counts.get(range_def.name, 0)
            if count == 0:
                continue
            cumulative_count += count
            percentage = (count / self.total_files) * 100
            cumulative_percentage = (cumulative_count / self.total_files) * 100
            console.print(
                f"[cyan]{range_def.name}:[/cyan] {count:,} files "
                f"({percentage:.1f}% | cumulative: {cumulative_count:,} files, {cumulative_percentage:.1f}%)"
            )

        # Duplication statistics
        console.print(f"\n[bold cyan]Duplication Statistics:[/bold cyan]")
        console.print(f"Duplicate files: {self.duplicate_files:,}")
        console.print(f"Duplicate groups: {self.duplicate_groups:,}")
        console.print(
            f"Space wasted by duplicates: {human_readable_size(self.space_wasted)}"
        )

        # Extension statistics with sizes
        console.print(
            f"\n[bold cyan]Top {top_extensions} Extensions (Including Duplicates):[/bold cyan]"
        )
        for ext, count in self.extension_counts.most_common(top_extensions):
            size = self.extension_sizes[ext]
            percentage = (count / self.total_files) * 100
            size_percentage = (
                (size / self.total_size) * 100 if self.total_size > 0 else 0
            )
            console.print(
                f"[cyan]{ext}:[/cyan] {count:,} files ({percentage:.1f}%) | "
                f"Total size: {human_readable_size(size)} ({size_percentage:.1f}% of total size)"
            )

        # Statistics for unique files only
        console.print(
            "\n[bold green]Unique Files Analysis (Excluding Duplicates)[/bold green]"
        )
        console.print(f"\n[bold cyan]Unique File Statistics:[/bold cyan]")
        console.print(f"Total unique files: {self.unique_total_files:,}")
        console.print(
            f"Total unique size: {human_readable_size(self.unique_total_size)} ({self.unique_total_size:,} bytes)"
        )

        # Size distribution for unique files
        console.print(
            f"\n[bold cyan]Size Distribution (Unique Files Only):[/bold cyan]"
        )
        unique_cumulative_count = 0
        for range_def in SIZE_RANGES:
            count = self.unique_size_counts.get(range_def.name, 0)
            if count == 0:
                continue
            unique_cumulative_count += count
            percentage = (count / self.unique_total_files) * 100
            cumulative_percentage = (
                unique_cumulative_count / self.unique_total_files
            ) * 100
            console.print(
                f"[cyan]{range_def.name}:[/cyan] {count:,} files "
                f"({percentage:.1f}% | cumulative: {unique_cumulative_count:,} files, {cumulative_percentage:.1f}%)"
            )

        # Extension statistics for unique files
        console.print(
            f"\n[bold cyan]Top {top_extensions} Extensions (Unique Files Only):[/bold cyan]"
        )
        for ext, count in self.unique_extension_counts.most_common(top_extensions):
            size = self.unique_extension_sizes[ext]
            percentage = (count / self.unique_total_files) * 100
            size_percentage = (
                (size / self.unique_total_size) * 100
                if self.unique_total_size > 0
                else 0
            )
            console.print(
                f"[cyan]{ext}:[/cyan] {count:,} unique files ({percentage:.1f}%) | "
                f"Total size: {human_readable_size(size)} ({size_percentage:.1f}% of unique size)"
            )


def main():
    parser = argparse.ArgumentParser(
        description="Comprehensive file analysis: size distribution, duplicates, and extensions"
    )
    parser.add_argument("directory", type=str, help="Directory to analyze")
    parser.add_argument(
        "--top-extensions",
        type=int,
        default=10,
        help="Number of top extensions to show (default: 10)",
    )
    args = parser.parse_args()

    directory = Path(args.directory)
    if not directory.is_dir():
        console.print(f"[red]Error: {directory} is not a valid directory[/red]")
        return 1

    try:
        analyzer = FileAnalysis()
        analyzer.analyze_directory(directory)
        analyzer.display_results(args.top_extensions)
        return 0
    except KeyboardInterrupt:
        console.print("\n[yellow]Process interrupted by user[/yellow]")
        return 130
    except Exception as e:
        console.print(f"[red]An error occurred: {str(e)}[/red]")
        return 1


class FilesStatsPlugin(BasicScanner):
    name = "files_stats"
    metadata = Metadata(
        description="Scan for files in the system",
        version="0.0.1",
    )

    def do_run(self, rootpath: str = None):
        """Run the file analysis on the target directory.

        Args:
            rootpath: Optional path to analyze. If not provided, uses self.target
        """
        try:
            analyzer = FileAnalysis()
            target_dir = Path(rootpath if rootpath is not None else self.target)

            if not target_dir.is_dir():
                console.print(
                    f"[red]Error: {target_dir} is not a valid directory[/red]"
                )
                return

            # Display the path being analyzed
            console.print(
                f"\n[bold blue]Analyzing directory:[/bold blue] {target_dir.absolute()}"
            )

            analyzer.analyze_directory(target_dir)

            # Display results using rich console
            console.print(
                "\n[bold green]File Analysis Results (Including Duplicates)[/bold green]"
            )

            # Basic statistics
            console.print(f"\n[bold cyan]General Statistics:[/bold cyan]")
            console.print(f"Total files analyzed: {analyzer.total_files:,}")
            console.print(
                f"Total size: {human_readable_size(analyzer.total_size)} ({analyzer.total_size:,} bytes)"
            )

            # Size distribution with cumulative counts and percentages
            console.print(f"\n[bold cyan]Size Distribution:[/bold cyan]")
            cumulative_count = 0
            for range_def in SIZE_RANGES:
                count = analyzer.size_counts.get(range_def.name, 0)
                if count == 0:
                    continue
                cumulative_count += count
                percentage = (count / analyzer.total_files) * 100
                cumulative_percentage = (cumulative_count / analyzer.total_files) * 100
                console.print(
                    f"[cyan]{range_def.name}:[/cyan] {count:,} files "
                    f"({percentage:.1f}% | cumulative: {cumulative_count:,} files, {cumulative_percentage:.1f}%)"
                )

            # Duplication statistics
            console.print(f"\n[bold cyan]Duplication Statistics:[/bold cyan]")
            console.print(f"Duplicate files: {analyzer.duplicate_files:,}")
            console.print(f"Duplicate groups: {analyzer.duplicate_groups:,}")
            console.print(
                f"Space wasted by duplicates: {human_readable_size(analyzer.space_wasted)}"
            )

            # Extension statistics with sizes (top 10)
            console.print(
                f"\n[bold cyan]Top 10 Extensions (Including Duplicates):[/bold cyan]"
            )
            for ext, count in analyzer.extension_counts.most_common(10):
                size = analyzer.extension_sizes[ext]
                percentage = (count / analyzer.total_files) * 100
                size_percentage = (
                    (size / analyzer.total_size) * 100 if analyzer.total_size > 0 else 0
                )
                console.print(
                    f"[cyan]{ext}:[/cyan] {count:,} files ({percentage:.1f}%) | "
                    f"Total size: {human_readable_size(size)} ({size_percentage:.1f}% of total size)"
                )

            # Statistics for unique files only
            console.print(
                "\n[bold green]Unique Files Analysis (Excluding Duplicates)[/bold green]"
            )
            console.print(f"\n[bold cyan]Unique File Statistics:[/bold cyan]")
            console.print(f"Total unique files: {analyzer.unique_total_files:,}")
            console.print(
                f"Total unique size: {human_readable_size(analyzer.unique_total_size)} ({analyzer.unique_total_size:,} bytes)"
            )

            # Size distribution for unique files
            console.print(
                f"\n[bold cyan]Size Distribution (Unique Files Only):[/bold cyan]"
            )
            unique_cumulative_count = 0
            for range_def in SIZE_RANGES:
                count = analyzer.unique_size_counts.get(range_def.name, 0)
                if count == 0:
                    continue
                unique_cumulative_count += count
                percentage = (count / analyzer.unique_total_files) * 100
                cumulative_percentage = (
                    unique_cumulative_count / analyzer.unique_total_files
                ) * 100
                console.print(
                    f"[cyan]{range_def.name}:[/cyan] {count:,} files "
                    f"({percentage:.1f}% | cumulative: {unique_cumulative_count:,} files, {cumulative_percentage:.1f}%)"
                )

            # Extension statistics for unique files (top 10)
            console.print(
                f"\n[bold cyan]Top 10 Extensions (Unique Files Only):[/bold cyan]"
            )
            for ext, count in analyzer.unique_extension_counts.most_common(10):
                size = analyzer.unique_extension_sizes[ext]
                percentage = (count / analyzer.unique_total_files) * 100
                size_percentage = (
                    (size / analyzer.unique_total_size) * 100
                    if analyzer.unique_total_size > 0
                    else 0
                )
                console.print(
                    f"[cyan]{ext}:[/cyan] {count:,} unique files ({percentage:.1f}%) | "
                    f"Total size: {human_readable_size(size)} ({size_percentage:.1f}% of unique size)"
                )

        except Exception as e:
            console.print(
                f"[red]An error occurred during file analysis: {str(e)}[/red]"
            )
