"""Command to load builtin knowledge base."""

from cybsuite.core.logger import get_logger
from cybsuite.cyberdb import CyberDB
from koalak.subcommand_parser import SubcommandParser

from .utils_cmd import CMD_GROUP_KNOWLEDGEBASE

logger = get_logger()


def add_cli_kb_load(cli_main: SubcommandParser):
    """Add the kb-load command to the cyberdb CLI."""
    subcmd = cli_main.add_subcommand(
        "kb-load",
        group=CMD_GROUP_KNOWLEDGEBASE,
        description="Load the builtin knowledge base",
    )
    subcmd.register_function(_run)


def _run(args):
    """Run the kb-load command."""
    try:
        # Initialize CyberDB from default config
        cyberdb = CyberDB.from_default_config()

        logger.info("Loading builtin knowledge base...")

        # Call the load_knowledgebase method
        cyberdb.load_knowledgebase()

        logger.info("Builtin knowledge base loaded successfully")

    except Exception as e:
        logger.error(f"Error loading builtin knowledge base: {e}")
