from pathlib import Path

_here_path = Path(__file__).parent
PATH_DATA = _here_path / "data"

__all__ = [
    "PATH_DATA",
]
