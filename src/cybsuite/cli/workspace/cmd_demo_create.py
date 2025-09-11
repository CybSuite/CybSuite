"""Command to create a demo workspace with sample data."""

from cybsuite.core.logger import get_logger
from cybsuite.cyberdb import CyberDB
from cybsuite.workspace.consts import PATH_DATA
from cybsuite.workspace.workspaces import create_workspace
from koalak.subcommand_parser import SubcommandParser

logger = get_logger()


def add_cmd_demo_create(cmd_workspace: SubcommandParser):
    """Add the demo-create command to the workspace subcommand."""
    subcmd = cmd_workspace.add_subcommand(
        "demo-create", description="Create a demo workspace with sample data"
    )
    subcmd.add_argument(
        "--sample",
        default="corp.local",
        help="Name of the sample to load (default: corp.local)",
    )
    subcmd.add_argument(
        "--workspace",
        default=None,
        help="Name of the workspace to create (default: derived from sample name)",
    )
    subcmd.add_argument(
        "--force", action="store_true", help="Overwrite existing workspace if it exists"
    )
    subcmd.register_function(_run)


def _run(args):
    """Create a demo workspace and load sample data."""
    try:
        # Check if the sample exists
        sample_demo_path = PATH_DATA / "demo" / args.sample
        if not sample_demo_path.exists():
            logger.error(f"Sample '{args.sample}' not found in demo data")
            logger.info(
                f"Available samples: {[d.name for d in (PATH_DATA / 'demo').iterdir() if d.is_dir()]}"
            )
            return

        # Check if the sample has a db directory
        sample_db_path = sample_demo_path / "db"
        if not sample_db_path.exists():
            logger.error(f"Sample '{args.sample}' does not have a 'db' directory")
            return

        # Derive workspace name from sample name if not provided
        workspace_name = (
            args.workspace
            if args.workspace is not None
            else f"demo_{args.sample.replace('.', '_')}"
        )

        # Create the workspace
        workspace_path = create_workspace(
            workspace_name, force=args.force, set_as_default=True
        )
        logger.info(f"Created demo workspace at: '{workspace_path}'")
        logger.info(f"Sample: {args.sample}")

        # Initialize CyberDB and ingest sample data
        cyberdb = CyberDB.from_default_config()

        # Ingest the db data from the sample
        logger.info(f"Ingesting sample data from: {sample_db_path}")
        cyberdb.ingest("cyberdb", str(sample_db_path))
        logger.info("Sample data ingestion completed")

        # Load knowledgebase data
        logger.info("Loading knowledgebase data...")
        cyberdb.load_knowledgebase()
        logger.info("Knowledgebase data loaded")

    except FileExistsError as e:
        logger.error(f"{e}")
        logger.error("Use '--force' to overwrite existing workspace")
    except Exception as e:
        logger.error(f"Error creating demo workspace: {e}")
