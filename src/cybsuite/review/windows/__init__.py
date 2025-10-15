from cybsuite.extension import CybSuiteExtension
from cybsuite.review.files_reviewers import BaseReviewer, pm_reviewers
from koalak.plugin_manager import Metadata

from .windows_reviewer import WindowsReviewer

from . import plugins  # isort: skip  # noqa: F401

CybSuiteExtension.load_plugins("reviewers")

__all__ = [
    "Metadata",
    "WindowsReviewer",
    "BaseReviewer",
    "pm_reviewers",
]
