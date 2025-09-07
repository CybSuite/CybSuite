import warnings as warning
from typing import List


class CyberDBProgressMixin:
    def __init__(self):
        self._progress_total_portions: int | None = None
        self._progress_current_portion: int = 0
        self._progress_portion_labels: List[str | None] | None = None
        self._progress_total_steps: int | None = None
        self._progress_current_step: int = 0
        self._progress_steps_labels: List[str | None] | None = None

    def set_progress_total_portions(self, value: (int | List[str | None])) -> None:
        """
        Set the total number of progress portions (principle jobs).

        Args:
            value (int|List[str|None]): Either the total number of progress portions or a list of labels for each portion.
        Raises:
            ValueError: If value is not a non-zero positive integer or a list of (strings|None).
        """
        if isinstance(value, int):
            if value <= 0:
                raise ValueError("Portions number must be a non-zero positive integer.")
            n = value
            labels = [None] * n
        elif isinstance(value, list):
            if not all(isinstance(x, (str, type(None))) for x in value):
                raise ValueError("Labels must be a list of strings|None")
            n = len(value)
            labels = value
        else:
            raise ValueError(
                "Argument must be either an integer or a list of strings|None"
            )

        if self._progress_current_portion > n:
            warning.warn(
                "Current portion is greater than the new total portions. Setting current portion to total portions (100% progress)."
            )
            self._progress_current_portion = n  # avoiding progress greater than 100%

        self._progress_total_portions = n
        self._progress_portion_labels = labels

    def next_progress_portion(self, n: (int | None) = None) -> None:
        """
        Move to the next progress portion.

        Args:
            n (int, optional): The number of portions to move forward. Defaults to 1.
        Raises:
            ValueError: If n is not a non-zero positive integer.
        """
        if n is None:
            n = 1
        elif not isinstance(n, int) or n <= 0:
            raise ValueError("Portion increment must be a non-zero positive integer")

        sum = self._progress_current_portion + n
        if sum > self._progress_total_portions:
            warning.warn(
                "Current portion is greater than the total portions. Setting current portion to total portions (100% progress)."
            )
            self._progress_current_portion = self._progress_total_portions
        else:
            self._progress_current_portion = sum

        # reset steps for new portion
        self._progress_total_steps = None
        self._progress_current_step = 0
        self._progress_steps_labels = None

    def set_progress_current_portion_label(self, label: (str | None)) -> None:
        """
        Set the label for the current portion.

        Args:
            label (str|None): The label for the current portion.
        Raises:
            ValueError: If label is not a string or None.
        """
        if label is not None and not isinstance(label, (str, type(None))):
            raise ValueError("Label must be a string|None")

        if self._progress_portion_labels is not None:
            self._progress_portion_labels[self._progress_current_portion] = label

    def set_progress_total_steps(
        self, value: (int | List[str | None] | None) = None
    ) -> None:
        """
        Set the total number of progress steps (sub-jobs) for the current portion.

        Args:
            value (int|List[str|None]|None): Either the total number of progress steps, a list of labels for each step, or None to reset.
        Raises:
            ValueError: If value is not a positive integer, a list of (strings|None), or None.
        """
        if value is None or value == 0:
            self._progress_total_steps = None
            self._progress_steps_labels = None
            return

        if isinstance(value, int):
            if value <= 0:
                raise ValueError("Steps number must be a non-zero positive integer.")
            n = value
            labels = [None] * n
        elif isinstance(value, list):
            if not all(isinstance(x, (str, type(None))) for x in value):
                raise ValueError("Labels must be a list of strings|None")
            n = len(value)
            labels = value
        else:
            raise ValueError(
                "Argument must be either an integer, a list of strings|None, or None"
            )

        if self._progress_current_step > n:
            warning.warn(
                "Current step is greater than the new total steps. Setting current step to total steps (100% progress)."
            )
            self._progress_current_step = n  # avoiding progress greater than 100%

        self._progress_total_steps = n
        self._progress_steps_labels = labels

    def next_progress_step(self, n: (int | None) = None) -> None:
        """
        Move to the next progress step.

        Args:
            n (int, optional): The number of steps to move forward. Defaults to 1.
        Raises:
            ValueError: If n is not a non-zero positive integer.
        """
        if n is None:
            n = 1
        elif not isinstance(n, int) or n <= 0:
            raise ValueError("Step increment must be a non-zero positive integer")

        sum = self._progress_current_step + n
        if sum > self._progress_total_steps:
            warning.warn(
                "Current step is greater than the total steps. Setting current step to total steps (100% progress)."
            )
            self._progress_current_step = self._progress_total_steps
        else:
            self._progress_current_step = sum

    def set_progress_current_step_label(self, label: (str | None)) -> None:
        """
        Set the label for the current step.

        Args:
            label (str|None): The label for the current step.
        Raises:
            ValueError: If label is not a string or None.
        """
        if label is not None and not isinstance(label, (str, type(None))):
            raise ValueError("Label must be a string|None")

        if self._progress_steps_labels is not None:
            self._progress_steps_labels[self._progress_current_step] = label

    def get_progress(self) -> dict:
        """
        Get the current progress as a dictionary.

        Returns:
            dict: A dictionary containing the current progress information (total_portions, current_portion, portion_label, total_steps, current_step, step_label).
        """
        portion_label = (
            None
            if self._progress_portion_labels is None
            else self._progress_portion_labels[self._progress_current_portion]
            if self._progress_current_portion < self._progress_total_portions
            else None
        )
        step_label = (
            None
            if self._progress_steps_labels is None
            else self._progress_steps_labels[self._progress_current_step]
            if self._progress_current_step < self._progress_total_steps
            else None
        )

        return {
            "total_portions": self._progress_total_portions,
            "current_portion": self._progress_current_portion,
            "portion_label": portion_label,
            "total_steps": self._progress_total_steps,
            "current_step": self._progress_current_step,
            "step_label": step_label,
        }

    def cleanup_progress(self) -> None:
        """
        Check if progress portions/steps are complete.
        """
        if self._progress_total_portions is not None:
            if self._progress_current_portion < self._progress_total_portions:
                warning.warn("Progress portions are not complete.")
            elif self._progress_current_portion > self._progress_total_portions:
                warning.warn("Current portion is greater than total portions.")

        elif self._progress_total_steps is not None:
            if self._progress_current_step < self._progress_total_steps:
                warning.warn("Progress steps are not complete.")
            elif self._progress_current_step > self._progress_total_steps:
                warning.warn("Current step is greater than total steps.")
