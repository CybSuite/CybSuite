from pathlib import Path

from cybsuite.core.logger import get_logger
from cybsuite.cyberdb import CyberDB
from koalak.subcommand_parser import SubcommandParser

from .utils_cmd import CMD_GROUP_KNOWLEDGEBASE

logger = get_logger()


def add_cli_kb_export(main_cli: SubcommandParser):
    """Add kb-export command to the CLI"""

    cmd_kb_export = main_cli.add_subcommand(
        "kb-export",
        description="Export a specific knowledge base to a folder",
        group=CMD_GROUP_KNOWLEDGEBASE,
    )

    cmd_kb_export.add_argument(
        "kb_name",
        help="Name of the knowledge base to export",
        type=str,
    )

    cmd_kb_export.add_argument(
        "path",
        help="Output directory where to save the knowledge base",
        type=str,
    )

    cmd_kb_export.add_argument(
        "--force",
        help="Force export by removing existing directory if it exists",
        action="store_true",
    )

    cmd_kb_export.register_function(run_kb_export)


def run_kb_export(args):
    """Run the kb-export command"""
    kb_name = args.kb_name
    output_dir = Path(args.path)
    force = args.force

    # Get database from default config
    cyberdb = CyberDB.from_default_config()

    # Export the knowledge base
    cyberdb.export_knowledgebase(kb_name, output_dir, force=force)

    logger.info(
        f"Knowledge base '{kb_name}' export completed to directory: {output_dir}"
    )
