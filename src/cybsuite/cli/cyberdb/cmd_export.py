import os
from pathlib import Path

from cybsuite.cyberdb import CyberDB
from koalak.subcommand_parser import SubcommandParser
from .utils_cmd import CMD_GROUP_UTILS


def add_cli_export(main_cli: SubcommandParser):
    """Add export command to the CLI"""

    cmd_export = main_cli.add_subcommand(
        "export",
        description="Export all tables data to cybs-db format (JSONL files)",
        group=CMD_GROUP_UTILS,
    )

    cmd_export.add_argument(
        "output_dir",
        help="Output directory where to save the JSONL files",
        type=str,
    )

    cmd_export.add_argument(
        "--force",
        help="Force export by removing existing directory if it exists",
        action="store_true",
    )

    cmd_export.register_function(run_export)


def run_export(args):
    """Run the export command"""
    output_dir = Path(args.output_dir)
    force = args.force

    cyberdb = CyberDB.from_default_config()

    # Export all tables
    cyberdb.export_all_tables(output_dir, force=force)

    print(f"Export completed to: {output_dir}")