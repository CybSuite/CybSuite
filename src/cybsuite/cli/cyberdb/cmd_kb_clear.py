"""Command to clear knowledge base data."""

from cybsuite.core.logger import get_logger
from cybsuite.cyberdb import CyberDB
from koalak.subcommand_parser import SubcommandParser

from .utils_cmd import CMD_GROUP_KNOWLEDGEBASE

logger = get_logger()


def add_cli_kb_clear(cli_main: SubcommandParser):
    """Add the kb-clear command to the cyberdb CLI."""
    subcmd = cli_main.add_subcommand(
        "kb-clear",
        group=CMD_GROUP_KNOWLEDGEBASE,
        description="Clear all knowledge base data (WARNING: will also delete related controls/observations)",
    )
    subcmd.add_argument(
        "--accept-cascade-clear",
        action="store_true",
        help="Force clearing of all knowledge base data including related controls/observations (required for safety)",
    )
    subcmd.register_function(_run)


def _run(args):
    """Run the kb-clear command."""
    try:
        # Check if accept flag is provided
        if not args.accept_cascade_clear:
            logger.error(
                "Knowledge base clearing requires --accept-cascade-clear flag for safety"
            )
            logger.error(
                "This will clear ALL data from tables with 'knowledgebase' tag"
            )
            logger.error(
                "WARNING: This includes control_definition which will also delete related controls and observations"
            )
            logger.error(
                "This command is intended for knowledge base development, NOT for production databases"
            )
            # TODO: add in koalak.EntityDescription all inked entities or all entities depending on cascade with this
            return

        # Initialize CyberDB from default config
        cyberdb = CyberDB.from_default_config()

        logger.warning("Clearing all knowledge base data...")

        # Call the clear_knowledgebase method
        cyberdb.clear_knowledgebase()

        logger.info("Knowledge base data cleared successfully")

    except Exception as e:
        logger.error(f"Error clearing knowledge base data: {e}")
