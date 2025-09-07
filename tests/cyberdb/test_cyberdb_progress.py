import warnings

import pytest
from cybsuite.cyberdb.cyberdb_progress_mixin import CyberDBProgressMixin

# ========================
# ERROR TESTS
# ========================


def test_portions_validation_errors():
    """Test various validation errors for portion operations."""
    progress = CyberDBProgressMixin()

    # Test invalid integer values
    with pytest.raises(
        ValueError, match="Portions number must be a non-zero positive integer"
    ):
        progress.set_progress_total_portions(0)
    with pytest.raises(
        ValueError, match="Portions number must be a non-zero positive integer"
    ):
        progress.set_progress_total_portions(-1)

    # Test invalid type
    with pytest.raises(
        ValueError, match="Argument must be either an integer or a list of strings|None"
    ):
        progress.set_progress_total_portions("invalid")
    with pytest.raises(
        ValueError, match="Argument must be either an integer or a list of strings|None"
    ):
        progress.set_progress_total_portions(None)

    # Test invalid labels in list
    with pytest.raises(ValueError, match="Labels must be a list of strings|None"):
        progress.set_progress_total_portions([1, 2, 3])
    with pytest.raises(ValueError, match="Labels must be a list of strings|None"):
        progress.set_progress_total_portions(["valid", 123, None])


def test_steps_validation_errors():
    """Test various validation errors for step operations."""
    progress = CyberDBProgressMixin()

    # Test invalid integer values
    with pytest.raises(
        ValueError, match="Steps number must be a non-zero positive integer"
    ):
        progress.set_progress_total_steps(-1)

    # Test invalid type
    with pytest.raises(
        ValueError,
        match="Argument must be either an integer, a list of strings|None, or None",
    ):
        progress.set_progress_total_steps("invalid")

    # Test invalid labels in list
    with pytest.raises(ValueError, match="Labels must be a list of strings|None"):
        progress.set_progress_total_steps([1, 2, 3])


def test_increment_validation_errors():
    """Test validation errors for increment operations."""
    progress = CyberDBProgressMixin()

    # Setup for testing increments
    progress.set_progress_total_portions(5)
    progress.set_progress_total_steps(5)

    # Test invalid portion increments
    with pytest.raises(
        ValueError, match="Portion increment must be a non-zero positive integer"
    ):
        progress.next_progress_portion(n=0)
    with pytest.raises(
        ValueError, match="Portion increment must be a non-zero positive integer"
    ):
        progress.next_progress_portion(n=-1)

    # Test invalid step increments
    with pytest.raises(
        ValueError, match="Step increment must be a non-zero positive integer"
    ):
        progress.next_progress_step(n=0)
    with pytest.raises(
        ValueError, match="Step increment must be a non-zero positive integer"
    ):
        progress.next_progress_step(n=-1)


def test_label_type_validation_errors():
    """Test validation errors for label type operations."""
    progress = CyberDBProgressMixin()

    # Setup for testing labels
    progress.set_progress_total_portions(["Task 1", None, "Task 3"])
    progress.set_progress_total_steps(["Step 1", None, "Step 3"])

    # Test invalid portion label types
    with pytest.raises(ValueError, match="Label must be a string|None"):
        progress.set_progress_current_portion_label(123)

    # Test invalid step label types
    with pytest.raises(ValueError, match="Label must be a string|None"):
        progress.set_progress_current_step_label(123)


# ========================
# WARNING TESTS
# ========================


def test_portions_length_mismatch_warnings():
    """Test warnings when n and labels lengths don't match."""
    progress = CyberDBProgressMixin()

    # Note: The new API doesn't have separate n and labels parameters,
    # so this type of mismatch warning no longer applies.
    # This test now focuses on boundary warnings instead.

    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        # Test normal operation without warnings
        progress.set_progress_total_portions(5)
        progress.set_progress_total_portions(["Task 1", "Task 2", "Task 3"])
        assert len(w) == 0  # No warnings expected


def test_steps_length_mismatch_warnings():
    """Test warnings when n and labels lengths don't match for steps."""
    progress = CyberDBProgressMixin()

    # Note: The new API doesn't have separate n and labels parameters,
    # so this type of mismatch warning no longer applies.
    # This test now focuses on boundary warnings instead.

    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        # Test normal operation without warnings
        progress.set_progress_total_steps(5)
        progress.set_progress_total_steps(["Step 1", "Step 2"])
        assert len(w) == 0  # No warnings expected


def test_exceed_boundaries_warnings():
    """Test warnings when operations exceed set boundaries."""
    progress = CyberDBProgressMixin()

    # Test portion exceeding total
    progress.set_progress_total_portions(3)
    progress.next_progress_portion(2)  # Current becomes 2

    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        progress.next_progress_portion(5)  # Trying to go to 7, but total is 3
        assert len(w) == 1
        assert "Current portion is greater than the total portions" in str(w[0].message)

    # Verify current portion is capped at total
    progress_info = progress.get_progress()
    assert progress_info["current_portion"] == 3

    # Test step exceeding total
    progress.set_progress_total_steps(3)
    progress.next_progress_step(2)  # Current becomes 2

    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        progress.next_progress_step(5)  # Trying to go to 7, but total is 3
        assert len(w) == 1
        assert "Current step is greater than the total steps" in str(w[0].message)


def test_cleanup_warnings():
    """Test warnings during cleanup operations."""
    progress = CyberDBProgressMixin()

    # Test incomplete portions warning
    progress.set_progress_total_portions(5)
    progress.next_progress_portion(2)  # Only 2 out of 5 complete

    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        progress.cleanup_progress()
        assert len(w) == 1
        assert "Progress portions are not complete" in str(w[0].message)

    # Test incomplete steps warning
    progress_steps = CyberDBProgressMixin()
    progress_steps.set_progress_total_steps(5)
    progress_steps.next_progress_step(2)  # Only 2 out of 5 complete

    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        progress_steps.cleanup_progress()
        assert len(w) == 1
        assert "Progress steps are not complete" in str(w[0].message)


# ========================
# NORMAL OPERATION TESTS
# ========================


def test_initialization():
    """Test that initialization works with expected defaults."""
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        progress = CyberDBProgressMixin()
        assert len(w) == 0  # No warnings

    progress_info = progress.get_progress()
    assert progress_info == {
        "total_portions": None,
        "current_portion": 0,
        "portion_label": None,
        "total_steps": None,
        "current_step": 0,
        "step_label": None,
    }


def test_portions_setup_and_navigation():
    """Test normal portion setup and navigation operations."""
    progress = CyberDBProgressMixin()

    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")

        # Test integer only
        progress.set_progress_total_portions(5)
        assert len(w) == 0
        progress_info = progress.get_progress()
        assert progress_info["total_portions"] == 5
        assert progress_info["current_portion"] == 0

        # Test labels only
        labels = ["Task 1", "Task 2", None, "Task 4"]
        progress.set_progress_total_portions(labels)
        assert len(w) == 0
        progress_info = progress.get_progress()
        assert progress_info["total_portions"] == 4
        assert progress_info["portion_label"] == "Task 1"

        # Test with different labels
        labels = ["Phase 1", "Phase 2", "Phase 3"]
        progress.set_progress_total_portions(labels)
        assert len(w) == 0
        progress_info = progress.get_progress()
        assert progress_info["total_portions"] == 3
        assert progress_info["portion_label"] == "Phase 1"

        # Test navigation
        progress.next_progress_portion()  # Move to 1 (index 1 = "Phase 2")
        progress.next_progress_portion(1)  # Move to 2 (index 2 = "Phase 3")
        assert len(w) == 0

    progress_info = progress.get_progress()
    assert progress_info["current_portion"] == 2
    assert progress_info["portion_label"] == "Phase 3"


def test_steps_setup_and_navigation():
    """Test normal step setup and navigation operations."""
    progress = CyberDBProgressMixin()

    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")

        # Test various setup scenarios
        progress.set_progress_total_steps(4)
        progress.set_progress_total_steps(["Step A", "Step B"])
        progress.set_progress_total_steps(["X", "Y", "Z"])

        # Test zero becomes None
        progress.set_progress_total_steps(0)
        progress_info = progress.get_progress()
        assert progress_info["total_steps"] is None

        # Test None becomes None
        progress.set_progress_total_steps(None)
        progress_info = progress.get_progress()
        assert progress_info["total_steps"] is None

        # Test normal navigation
        progress.set_progress_total_steps(["Step 1", "Step 2", "Step 3", "Step 4"])
        progress.next_progress_step()  # Move to 1
        progress.next_progress_step(2)  # Move to 3
        assert len(w) == 0

    progress_info = progress.get_progress()
    assert progress_info["current_step"] == 3
    assert progress_info["step_label"] == "Step 4"


def test_label_management():
    """Test dynamic label management operations."""
    progress = CyberDBProgressMixin()

    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")

        # Test portion label updates
        progress.set_progress_total_portions(["Initial 1", "Initial 2", "Initial 3"])
        progress.set_progress_current_portion_label("Updated Task 1")
        progress_info = progress.get_progress()
        assert progress_info["portion_label"] == "Updated Task 1"

        # Test step label updates
        progress.set_progress_total_steps(["Step A", "Step B", "Step C"])
        progress.set_progress_current_step_label("Updated Step A")
        progress_info = progress.get_progress()
        assert progress_info["step_label"] == "Updated Step A"

        assert len(w) == 0  # No warnings


def test_portion_step_interaction():
    """Test interaction between portions and steps."""
    progress = CyberDBProgressMixin()

    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")

        # Test that next_portion resets steps
        progress.set_progress_total_portions(3)
        progress.set_progress_total_steps(["A", "B", "C", "D", "E"])
        progress.next_progress_step(3)  # Move to step 3

        # Move to next portion - should reset steps
        progress.next_progress_portion()
        assert len(w) == 0

    progress_info = progress.get_progress()
    assert progress_info["current_portion"] == 1
    assert progress_info["total_steps"] is None
    assert progress_info["current_step"] == 0
    assert progress_info["step_label"] is None


def test_cleanup_complete_operations():
    """Test cleanup when operations are complete."""
    progress = CyberDBProgressMixin()

    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")

        # Test complete portions
        progress.set_progress_total_portions(3)
        progress.next_progress_portion(3)  # Complete all portions
        progress.cleanup_progress()

        # Test complete steps
        progress_steps = CyberDBProgressMixin()
        progress_steps.set_progress_total_steps(4)
        progress_steps.next_progress_step(4)  # Complete all steps
        progress_steps.cleanup_progress()

        # Test no progress set
        progress_empty = CyberDBProgressMixin()
        progress_empty.cleanup_progress()

        assert len(w) == 0  # No warnings


def test_edge_cases():
    """Test various edge cases and boundary conditions."""
    progress = CyberDBProgressMixin()

    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")

        # Empty labels list
        progress.set_progress_total_portions([])
        progress_info = progress.get_progress()
        assert progress_info["total_portions"] == 0
        assert progress_info["portion_label"] is None

        # All None labels
        progress.set_progress_total_portions([None, None, None])
        progress_info = progress.get_progress()
        assert progress_info["total_portions"] == 3
        assert progress_info["portion_label"] is None

        assert len(w) == 0


# ========================
# COMPLEX WORKFLOW TESTS
# ========================


def test_complex_scanner_workflow():
    """Test a complex multi-phase scanner workflow."""
    progress = CyberDBProgressMixin()

    # Setup multi-phase scan
    phase_labels = ["Initialization", "Data Collection", "Analysis", "Reporting"]
    progress.set_progress_total_portions(phase_labels)

    progress_info = progress.get_progress()
    assert progress_info["total_portions"] == 4
    assert progress_info["portion_label"] == "Initialization"

    # Initialization steps
    init_steps = ["Loading config", "Connecting to database", "Validating inputs"]
    progress.set_progress_total_steps(init_steps)

    for i in range(3):
        progress_info = progress.get_progress()
        assert progress_info["step_label"] == init_steps[i]
        progress.next_progress_step()

    # Move to Data Collection
    progress.next_progress_portion()
    progress_info = progress.get_progress()
    assert progress_info["current_portion"] == 1
    assert progress_info["portion_label"] == "Data Collection"
    assert progress_info["total_steps"] is None  # Reset after next_portion

    # Data Collection steps
    collection_steps = [
        "Scanning networks",
        "Gathering system info",
        "Processing logs",
        "Storing results",
    ]
    progress.set_progress_total_steps(collection_steps)

    # Simulate partial completion
    progress.next_progress_step(2)  # Complete first 2 steps
    progress_info = progress.get_progress()
    assert progress_info["current_step"] == 2
    assert progress_info["step_label"] == "Processing logs"


def test_independent_steps_and_portions():
    """Test that steps and portions work independently."""
    progress = CyberDBProgressMixin()

    # Test steps without portions
    progress.set_progress_total_steps(["Step A", "Step B", "Step C"])
    progress.next_progress_step(1)

    progress_info = progress.get_progress()
    assert progress_info["total_portions"] is None
    assert progress_info["current_portion"] == 0
    assert progress_info["total_steps"] == 3
    assert progress_info["current_step"] == 1
    assert progress_info["step_label"] == "Step B"

    # Add portions later
    progress.set_progress_total_portions(["Task X", "Task Y"])
    progress_info = progress.get_progress()
    assert progress_info["total_portions"] == 2
    assert progress_info["portion_label"] == "Task X"
    # Steps should remain unchanged
    assert progress_info["total_steps"] == 3
    assert progress_info["current_step"] == 1
