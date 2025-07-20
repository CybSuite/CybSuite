from functools import cache
from pathlib import Path
from typing import TYPE_CHECKING

from cybsuite.consts import PATH_CYBSUITE
from koalak.plugin_manager import Plugin, PluginManager, abstract

if TYPE_CHECKING:
    from cybsuite.cyberdb import CyberDB

from cybsuite.cyberdb.cyberdb_plugin_base_mixin import CyberDBPluginBaseMixin

# FIXME: redo path once koalak.framework are ended
pm_home_path = PATH_CYBSUITE / "ingestors"


class BaseIngestor(Plugin, CyberDBPluginBaseMixin):
    """ """

    autodetect_is_file = None
    autodetect_is_dir = None

    def __init__(self, cyberdb: "CyberDB"):
        super().__init__(
            cyberdb,
            # TODO: double check if exceptions_path are working
            exceptions_path=pm_home_path / "exceptions" / f"{self.name}.exceptions.txt",
        )

    def run(self, *args, **kwargs):
        return self.do_run(*args, **kwargs)

    @abstract
    def do_run(self, *args, **kwargs):
        pass

    @classmethod
    def autodetect_from_path(cls, path: Path) -> bool:
        """Method to be implemented to autodetect Ingestor when ingesting recursively"""
        return False

    @cache
    @staticmethod
    def autodetect_get_first_500_chars(path: Path) -> str:
        """
        Return 100 chars if it's banary return empty string
        """
        try:
            with open(path) as f:
                return f.read(500)
        except UnicodeDecodeError:
            return ""

    @property
    def source(self):
        # TODO: implement source in DB
        return self.name

    # UTILS METHODS #
    # ============= #
    @staticmethod
    def iter_lines_from_filepath(filepath: str | Path, strip: bool | None = None):
        filepath = Path(filepath)
        if strip is None:
            strip = True
        with open(filepath) as f:
            for line in f:
                if strip:
                    line = line.strip()
                if not line:
                    continue
                yield line


pm_ingestors = PluginManager(
    "ingestors", base_plugin=BaseIngestor, entry_point="cybsuite.plugins"
)
