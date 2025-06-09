import json
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from typing import Dict, List

from cybsuite.cyberdb.bases import BaseReporter
from koalak.plugin_manager import Metadata
from koalak.utils import humanbytes
from rich.console import Console
from rich.table import Table


@dataclass
class ExtensionStats:
    """Statistics for a file extension."""

    count: int = 0
    total_size: int = 0
    index: int = 0  # Position in sorted list by count
    highlighted: bool = False


@dataclass
class ReportData:
    """Complete report data structure."""

    extension_stats: Dict[str, ExtensionStats] = field(default_factory=dict)
    highlighted_extensions: List[str] = field(default_factory=lambda: ["bat", "ps1"])


class SmbFileReporter(BaseReporter):
    name = "smb_file"
    metadata = Metadata(
        category="reporters",
        description="Generate statistics about SMB file extensions",
    )
    extension = ".json"

    @staticmethod
    def colorize_size(size_str: str) -> str:
        """Apply color to size based on unit."""
        if "GB" in size_str:
            return f"[red]{size_str}[/red]"
        elif "MB" in size_str:
            return f"[yellow]{size_str}[/yellow]"
        elif "KB" in size_str:
            return f"[green]{size_str}[/green]"
        return f"[blue]{size_str}[/blue]"  # For bytes

    def do_processing(self) -> ReportData:
        report_data = ReportData()
        ext_stats = defaultdict(lambda: ExtensionStats())

        # Collect statistics
        for row in self.cyberdb.request("smb_file"):
            name = row.file
            size = row.size

            if not name or "." not in name:
                continue

            ext = name.rsplit(".", 1)[-1].lower()
            ext_stats[ext].count += 1
            ext_stats[ext].total_size += size

        # Mark highlighted extensions
        for ext in report_data.highlighted_extensions:
            if ext in ext_stats:
                ext_stats[ext].highlighted = True

        # Sort and assign indices
        sorted_extensions = sorted(ext_stats.items(), key=lambda x: -x[1].count)
        for idx, (ext, stats) in enumerate(sorted_extensions, 1):
            stats.index = idx

        report_data.extension_stats = dict(ext_stats)
        return report_data

    def run(self, output):
        report_data = self.do_processing()

        # Get highlighted extensions and top 50 non-highlighted ones
        all_extensions = sorted(
            [(ext, stats) for ext, stats in report_data.extension_stats.items()],
            key=lambda x: x[1].index,
        )

        # Split into highlighted and non-highlighted
        highlighted = [
            (ext, stats) for ext, stats in all_extensions if stats.highlighted
        ]
        non_highlighted = [
            (ext, stats) for ext, stats in all_extensions if not stats.highlighted
        ][:50]

        # Combine them: highlighted first, then top non-highlighted
        extensions = highlighted + non_highlighted

        # Save JSON output
        output_data = {
            "extensions": [
                {
                    "extension": ext,
                    "count": stats.count,
                    "total_size": stats.total_size,
                    "total_size_human": humanbytes(stats.total_size),
                    "index": stats.index,
                    "highlighted": stats.highlighted,
                }
                for ext, stats in extensions
            ]
        }
        with open(output, "w") as f:
            json.dump(output_data, f, indent=2)

        # Print table
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("Real Pos", style="dim", justify="right")
        table.add_column("Extension", style="dim")
        table.add_column("Count", justify="right")
        table.add_column("Total Size", justify="right")

        for ext, stats in extensions:
            ext_display = f"[green]{ext}[/green]" if stats.highlighted else ext
            table.add_row(
                str(stats.index),
                ext_display,
                str(stats.count),
                self.colorize_size(humanbytes(stats.total_size)),
            )

        console = Console()
        console.print("\nSMB File Extension Statistics:")
        console.print(table)
