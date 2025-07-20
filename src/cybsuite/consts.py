import os
import tempfile
from pathlib import Path

# Update it also in pyproject.toml
VERSION = "0.1.2"
LOGGER_NAME = "cybsuite"


if "CYBSUITE_HOME" in os.environ:
    PATH_CYBSUITE = Path(os.environ["CYBSUITE_HOME"])
else:
    if "HOME" in os.environ:
        PATH_CYBSUITE = Path(os.environ["HOME"]) / "cybsuite"
    else:
        PATH_CYBSUITE = Path(tempfile.gettempdir()) / "cybsuite"


PATH_CYBSUITE = PATH_CYBSUITE.expanduser()
CONF_FILE_NAME = "conf.toml"
PATH_CONF_FILE = PATH_CYBSUITE / CONF_FILE_NAME

# Workspace paths
PATH_WORKSPACES = PATH_CYBSUITE / "workspaces"

# Relative paths for workspace structure
FOLDER_NAME_REVIEW = Path("review")
FOLDER_NAME_EXTRACTS = "extracts"
FOLDER_NAME_REPORTS = "reports"
FOLDER_NAME_LOGS = "logs"
FOLDER_NAME_UNARCHIVED = "unarchived"
FILE_NAME_DATA = ".data.json"
