"""Command to feed knowledge base data."""

from pathlib import Path

from cybsuite.core.logger import get_logger
from cybsuite.cyberdb import CyberDB
from koalak.subcommand_parser import SubcommandParser

from .utils_cmd import CMD_GROUP_KNOWLEDGEBASE

logger = get_logger()


def add_cli_kb_feed(cli_main: SubcommandParser):
    """Add the kb-feed command to the cyberdb CLI."""
    subcmd = cli_main.add_subcommand(
        "kb-feed",
        group=CMD_GROUP_KNOWLEDGEBASE,
        description="Feed knowledge base data from a directory structure",
    )
    subcmd.add_argument("path", help="Path to the knowledge base directory to import")
    subcmd.add_argument("--name", help="Name of the knowledge base")
    subcmd.register_function(_run)


def _run(args):
    """Run the kb-feed command."""
    try:
        # Initialize CyberDB from default config
        cyberdb = CyberDB.from_default_config()

        # Get the import path
        import_path = Path(args.path)

        logger.info(f"Feeding knowledge base from '{import_path}'")

        # Call the import_knowledgebase method
        cyberdb.import_knowledgebase(import_path, name=args.name)

        logger.info("Knowledge base feed completed successfully")

    except Exception as e:
        logger.error(f"Error feeding knowledge base: {e}")
