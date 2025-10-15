import argparse

from cybsuite.review.consts import EXTRACT_SCRIPTS
from koalak.subcommand_parser import SubcommandParser


class ListAndExit(argparse.Action):
    def __call__(self, parser, namespace, values, option_string=None):
        for e in EXTRACT_SCRIPTS:
            print(e)
        parser.exit()


def add_cmd_get_extract_script(cmd_main: SubcommandParser):
    subcmd = cmd_main.add_subcommand(
        "script",
        description="Get platform-specific extraction scripts for configuration gathering",
    )

    subcmd.add_argument(
        "type",
        choices=list(EXTRACT_SCRIPTS.keys()),
        help="Type of extraction script to retrieve (e.g., windows, linux)",
    )
    subcmd.add_argument(
        "--list",
        action=ListAndExit,
        help="List all scripts and exit",
        nargs=0,
    )
    subcmd.register_function(_run)


def _run(args):
    script_path = EXTRACT_SCRIPTS[args.type]
    with open(script_path) as f:
        data = f.read()
    print(data)
