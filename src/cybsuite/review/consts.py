from pathlib import Path

_here_path = Path(__file__).parent
PATH_DATA = _here_path / "data"
PATH_EXTRACT_SCRIPTS = PATH_DATA / "extract_scripts"
PATH_EXTRACT_SCRIPT_WINDOWS = PATH_EXTRACT_SCRIPTS / "windows_extract.ps1"
PATH_EXTRACT_SCRIPT_LINUX = PATH_EXTRACT_SCRIPTS / "linux_extract.sh"

EXTRACT_SCRIPTS = {
    "windows": PATH_EXTRACT_SCRIPT_WINDOWS,
    "linux": PATH_EXTRACT_SCRIPT_LINUX,
}
# Filename inside .zip files that contains all metadata
FILENAME_INFO = "info.json"


REL_PATH_REVIEW_INFO = ".data.json"
