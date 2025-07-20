"""Command to manage workspace configuration."""

from cybsuite.core.logger import get_logger
from cybsuite.cyberdb.config import root_config
from koalak.subcommand_parser import SubcommandParser

logger = get_logger()


def add_cmd_conf(cmd_workspace: SubcommandParser):
    """Add the conf command to the workspace subcommand."""
    subcmd = cmd_workspace.add_subcommand(
        "conf", description="Manage workspace configuration"
    )
    subcmd.add_argument("key", help="Configuration key (e.g., cyberdb.password)")
    subcmd.add_argument("value", help="Configuration value")
    subcmd.register_function(_run)


def _run(args):
    key = args.key
    value = args.value

    # Parse the key to determine the target config section
    key_parts = args.key.split(".", 1)
    if len(key_parts) != 2:
        logger.error("Invalid key format. Use 'section.key' (e.g., 'cyberdb.password')")
        return

    section_name, section_key = key_parts
    section = root_config[section_name]
    if section_key not in section:
        logger.error(f"Invalid section key: {section_key}")
        return
    old_value = section[section_key]
    type_value = type(old_value)
    value = type_value(value)

    root_config[section_name][section_key] = value

    logger.info(f"Set configuration: {args.key} = {value}")
