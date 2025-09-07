import pytest
import warnings

from cybsuite.cyberdb.cyberdb_progress_mixin import CyberDBProgressMixin


class TestCyberDBProgress:
    """Test suite for CyberDBProgress class with different warning modes."""

    def setup_method(self):
        """Set up test fixtures."""
        self.progress = CyberDBProgressMixin()

    # ========================
    # ERROR MODE TESTS
    # ========================

    def test_set_total_portions_error_both_none(self):
        """Test error when both n and labels are None."""
        with pytest.raises(ValueError, match="Either n or labels must be provided"):
            self.progress.set_progress_total_portions(n=None, labels=None)

    def test_set_total_portions_error_invalid_n(self):
        """Test error when n is not a positive integer."""
        with pytest.raises(ValueError, match="Portions number must be a non-zero positive integer"):
            self.progress.set_progress_total_portions(n=0)
        
        with pytest.raises(ValueError, match="Portions number must be a non-zero positive integer"):
            self.progress.set_progress_total_portions(n=-1)
        
        with pytest.raises(ValueError, match="Portions number must be a non-zero positive integer"):
            self.progress.set_progress_total_portions(n="invalid")

    def test_set_total_portions_error_invalid_labels(self):
        """Test error when labels is not a valid list."""
        with pytest.raises(ValueError, match="Labels must be a list of strings|None, or None"):
            self.progress.set_progress_total_portions(labels="invalid")
        
        with pytest.raises(ValueError, match="Labels must be a list of strings|None, or None"):
            self.progress.set_progress_total_portions(labels=[1, 2, 3])
        
        with pytest.raises(ValueError, match="Labels must be a list of strings|None, or None"):
            self.progress.set_progress_total_portions(labels=["valid", 123, None])

    def test_next_portion_error_invalid_n(self):
        """Test error when next_portion receives invalid input."""
        self.progress.set_progress_total_portions(5)
        
        with pytest.raises(ValueError, match="Portion increment must be a non-zero positive integer"):
            self.progress.next_progress_portion(n=0)
        
        with pytest.raises(ValueError, match="Portion increment must be a non-zero positive integer"):
            self.progress.next_progress_portion(n=-1)

    def test_set_current_portion_label_error_invalid_type(self):
        """Test error when setting invalid portion label type."""
        self.progress.set_progress_total_portions(3, ["Task 1", None, "Task 3"])
        
        with pytest.raises(ValueError, match="Label must be a string|None"):
            self.progress.set_progress_current_portion_label(123)

    def test_set_total_steps_error_invalid_n(self):
        """Test error when n is not a positive integer."""
        with pytest.raises(ValueError, match="Steps number must be a non-zero positive integer"):
            self.progress.set_progress_total_steps(n=-1)
        
        with pytest.raises(ValueError, match="Steps number must be a non-zero positive integer"):
            self.progress.set_progress_total_steps(n="invalid")

    def test_set_total_steps_error_invalid_labels(self):
        """Test error when labels is not a valid list."""
        with pytest.raises(ValueError, match="Labels must be a list of strings|None, or None"):
            self.progress.set_progress_total_steps(labels="invalid")
        
        with pytest.raises(ValueError, match="Labels must be a list of strings|None, or None"):
            self.progress.set_progress_total_steps(labels=[1, 2, 3])

    def test_next_step_error_invalid_n(self):
        """Test error when next_step receives invalid input."""
        self.progress.set_progress_total_steps(5)
        
        with pytest.raises(ValueError, match="Step increment must be a non-zero positive integer"):
            self.progress.next_progress_step(n=0)
        
        with pytest.raises(ValueError, match="Step increment must be a non-zero positive integer"):
            self.progress.next_progress_step(n=-1)

    def test_set_current_step_label_error_invalid_type(self):
        """Test error when setting invalid step label type."""
        self.progress.set_progress_total_steps(3, ["Step 1", None, "Step 3"])
        
        with pytest.raises(ValueError, match="Label must be a string|None"):
            self.progress.set_progress_current_step_label(123)

    # ========================
    # WARNING MODE TESTS
    # ========================

    def test_set_total_portions_warning_mismatched_lengths(self):
        """Test warning when n and labels lengths don't match."""
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.set_progress_total_portions(n=5, labels=["Task 1", "Task 2", "Task 3"])
            assert len(w) == 1
            assert "n must be equal to the length of labels" in str(w[0].message)
            
        # Verify it takes the bigger one (5) and extends labels
        progress_info = self.progress.get_progress()
        assert progress_info["total_portions"] == 5

    def test_set_total_portions_warning_current_exceeds_new_total(self):
        """Test warning when current portion exceeds new total."""
        self.progress.set_progress_total_portions(10)
        self.progress._progress_current_portion = 8  # Manually set high value
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.set_progress_total_portions(5)
            assert len(w) == 1
            assert "Current portion is greater than the new total portions" in str(w[0].message)
            
        # Verify current portion is capped at total
        progress_info = self.progress.get_progress()
        assert progress_info["current_portion"] == 5

    def test_next_portion_warning_exceeds_total(self):
        """Test warning when next_portion exceeds total."""
        self.progress.set_progress_total_portions(3)
        self.progress.next_progress_portion(2)  # Current becomes 2
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.next_progress_portion(5)  # Trying to go to 7, but total is 3
            assert len(w) == 1
            assert "Current portion is greater than the total portions" in str(w[0].message)
            
        # Verify current portion is capped at total
        progress_info = self.progress.get_progress()
        assert progress_info["current_portion"] == 3

    def test_set_total_steps_warning_mismatched_lengths(self):
        """Test warning when n and labels lengths don't match."""
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.set_progress_total_steps(n=5, labels=["Step 1", "Step 2"])
            assert len(w) == 1
            assert "n must be equal to the length of labels" in str(w[0].message)

    def test_set_total_steps_warning_current_exceeds_new_total(self):
        """Test warning when current step exceeds new total."""
        self.progress.set_progress_total_steps(10)
        self.progress._progress_current_step = 8  # Manually set high value
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.set_progress_total_steps(5)
            assert len(w) == 1
            assert "Current step is greater than the new total steps" in str(w[0].message)
            
        # Verify current step is capped at total
        progress_info = self.progress.get_progress()
        assert progress_info["current_step"] == 5

    def test_next_step_warning_exceeds_total(self):
        """Test warning when next_step exceeds total."""
        self.progress.set_progress_total_steps(3)
        self.progress.next_progress_step(2)  # Current becomes 2
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.next_progress_step(5)  # Trying to go to 7, but total is 3
            assert len(w) == 1
            assert "Current step is greater than the total steps" in str(w[0].message)
            
        # Verify current step is capped at total
        progress_info = self.progress.get_progress()
        assert progress_info["current_step"] == 3

    def test_cleanup_progress_warning_incomplete_portions(self):
        """Test warning when progress portions are incomplete."""
        self.progress.set_progress_total_portions(5)
        self.progress.next_progress_portion(2)  # Only 2 out of 5 complete
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.cleanup_progress()
            assert len(w) == 1
            assert "Progress portions are not complete" in str(w[0].message)

    def test_cleanup_progress_warning_exceeded_portions(self):
        """Test warning when current portion exceeds total."""
        self.progress.set_progress_total_portions(3)
        self.progress._progress_current_portion = 5  # Manually exceed total
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.cleanup_progress()
            assert len(w) == 1
            assert "Current portion is greater than total portions" in str(w[0].message)

    def test_cleanup_progress_warning_incomplete_steps(self):
        """Test warning when progress steps are incomplete."""
        self.progress.set_progress_total_steps(5)
        self.progress.next_progress_step(2)  # Only 2 out of 5 complete
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.cleanup_progress()
            assert len(w) == 1
            assert "Progress steps are not complete" in str(w[0].message)

    def test_cleanup_progress_warning_exceeded_steps(self):
        """Test warning when current step exceeds total."""
        self.progress.set_progress_total_steps(3)
        self.progress._progress_current_step = 5  # Manually exceed total
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.cleanup_progress()
            assert len(w) == 1
            assert "Current step is greater than total steps" in str(w[0].message)

    # ========================
    # SILENCE MODE TESTS (Normal Operations)
    # ========================

    def test_initialization_silent(self):
        """Test that initialization works silently with expected defaults."""
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

    def test_set_total_portions_with_n_only_silent(self):
        """Test setting total portions with n only (silent operation)."""
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.set_progress_total_portions(n=5)
            assert len(w) == 0  # No warnings
            
        progress_info = self.progress.get_progress()
        assert progress_info["total_portions"] == 5
        assert progress_info["current_portion"] == 0

    def test_set_total_portions_with_labels_only_silent(self):
        """Test setting total portions with labels only (silent operation)."""
        labels = ["Task 1", "Task 2", None, "Task 4"]
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.set_progress_total_portions(labels=labels)
            assert len(w) == 0  # No warnings
            
        progress_info = self.progress.get_progress()
        assert progress_info["total_portions"] == 4
        assert progress_info["portion_label"] == "Task 1"  # Current portion 0

    def test_set_total_portions_with_both_matching_silent(self):
        """Test setting total portions with matching n and labels (silent operation)."""
        labels = ["Phase 1", "Phase 2", "Phase 3"]
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.set_progress_total_portions(n=3, labels=labels)
            assert len(w) == 0  # No warnings
            
        progress_info = self.progress.get_progress()
        assert progress_info["total_portions"] == 3
        assert progress_info["portion_label"] == "Phase 1"

    def test_next_portion_normal_operations_silent(self):
        """Test normal next_portion operations (silent)."""
        self.progress.set_progress_total_portions(5, ["Task 1", "Task 2", "Task 3", "Task 4", "Task 5"])
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.next_progress_portion()  # Move to 1
            self.progress.next_progress_portion(2)  # Move to 3
            assert len(w) == 0  # No warnings
            
        progress_info = self.progress.get_progress()
        assert progress_info["current_portion"] == 3
        assert progress_info["portion_label"] == "Task 4"  # 0-indexed

    def test_portion_labels_management_silent(self):
        """Test setting and updating portion labels (silent)."""
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.set_progress_total_portions(3, ["Initial 1", "Initial 2", "Initial 3"])
            self.progress.set_progress_current_portion_label("Updated Task 1")
            assert len(w) == 0  # No warnings
            
        progress_info = self.progress.get_progress()
        assert progress_info["portion_label"] == "Updated Task 1"

    def test_set_total_steps_normal_operations_silent(self):
        """Test normal set_total_steps operations (silent)."""
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.set_progress_total_steps(n=4)
            self.progress.set_progress_total_steps(labels=["Step A", "Step B"])
            self.progress.set_progress_total_steps(n=3, labels=["X", "Y", "Z"])
            assert len(w) == 0  # No warnings

    def test_set_total_steps_zero_becomes_none_silent(self):
        """Test that setting steps to 0 becomes None (silent)."""
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.set_progress_total_steps(n=0)
            assert len(w) == 0  # No warnings
            
        progress_info = self.progress.get_progress()
        assert progress_info["total_steps"] is None

    def test_next_step_normal_operations_silent(self):
        """Test normal next_step operations (silent)."""
        self.progress.set_progress_total_steps(4, ["Step 1", "Step 2", "Step 3", "Step 4"])
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.next_progress_step()  # Move to 1
            self.progress.next_progress_step(2)  # Move to 3
            assert len(w) == 0  # No warnings
            
        progress_info = self.progress.get_progress()
        assert progress_info["current_step"] == 3
        assert progress_info["step_label"] == "Step 4"  # 0-indexed

    def test_step_labels_management_silent(self):
        """Test setting and updating step labels (silent)."""
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.set_progress_total_steps(3, ["Step A", "Step B", "Step C"])
            self.progress.set_progress_current_step_label("Updated Step A")
            assert len(w) == 0  # No warnings
            
        progress_info = self.progress.get_progress()
        assert progress_info["step_label"] == "Updated Step A"

    def test_next_portion_resets_steps_silent(self):
        """Test that next_portion resets step progress (silent)."""
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            # Set up initial state
            self.progress.set_progress_total_portions(3)
            self.progress.set_progress_total_steps(5, ["A", "B", "C", "D", "E"])
            self.progress.next_progress_step(3)  # Move to step 3
            
            # Move to next portion - should reset steps
            self.progress.next_progress_portion()
            assert len(w) == 0  # No warnings
            
        progress_info = self.progress.get_progress()
        assert progress_info["current_portion"] == 1
        assert progress_info["total_steps"] is None
        assert progress_info["current_step"] == 0
        assert progress_info["step_label"] is None

    def test_cleanup_progress_complete_portions_silent(self):
        """Test cleanup when portions are complete (silent)."""
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.set_progress_total_portions(3)
            self.progress.next_progress_portion(3)  # Complete all portions
            self.progress.cleanup_progress()
            assert len(w) == 0  # No warnings

    def test_cleanup_progress_complete_steps_silent(self):
        """Test cleanup when steps are complete (silent)."""
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.set_progress_total_steps(4)
            self.progress.next_progress_step(4)  # Complete all steps
            self.progress.cleanup_progress()
            assert len(w) == 0  # No warnings

    def test_cleanup_progress_no_progress_set_silent(self):
        """Test cleanup when no progress is set (silent)."""
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.cleanup_progress()
            assert len(w) == 0  # No warnings

    # ========================
    # COMPREHENSIVE FUNCTIONALITY TESTS
    # ========================

    def test_complex_progress_workflow(self):
        """Test a complex workflow combining portions and steps."""
        # Phase 1: Setup multi-phase scan
        phase_labels = ["Initialization", "Data Collection", "Analysis", "Reporting"]
        self.progress.set_progress_total_portions(labels=phase_labels)
        
        progress = self.progress.get_progress()
        assert progress["total_portions"] == 4
        assert progress["portion_label"] == "Initialization"
        
        # Phase 2: Initialization steps
        init_steps = ["Loading config", "Connecting to database", "Validating inputs"]
        self.progress.set_progress_total_steps(labels=init_steps)
        
        for i in range(3):
            progress = self.progress.get_progress()
            assert progress["step_label"] == init_steps[i]
            self.progress.next_progress_step()
        
        # Phase 3: Move to Data Collection
        self.progress.next_progress_portion()
        progress = self.progress.get_progress()
        assert progress["current_portion"] == 1
        assert progress["portion_label"] == "Data Collection"
        assert progress["total_steps"] is None  # Reset after next_portion
        
        # Phase 4: Data Collection steps
        collection_steps = ["Scanning networks", "Gathering system info", "Processing logs", "Storing results"]
        self.progress.set_progress_total_steps(labels=collection_steps)
        
        # Simulate partial completion
        self.progress.next_progress_step(2)  # Complete first 2 steps
        progress = self.progress.get_progress()
        assert progress["current_step"] == 2
        assert progress["step_label"] == "Processing logs"

    def test_edge_case_empty_labels_list(self):
        """Test edge case with empty labels list."""
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.set_progress_total_portions(labels=[])
            assert len(w) == 0  # No warnings
            
        progress = self.progress.get_progress()
        assert progress["total_portions"] == 0
        assert progress["portion_label"] is None

    def test_edge_case_all_none_labels(self):
        """Test edge case with all None labels."""
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.progress.set_progress_total_portions(labels=[None, None, None])
            assert len(w) == 0  # No warnings
            
        progress = self.progress.get_progress()
        assert progress["total_portions"] == 3
        assert progress["portion_label"] is None

    def test_labels_out_of_bounds_access(self):
        """Test that accessing labels beyond bounds returns None."""
        self.progress.set_progress_total_portions(2, ["Task 1", "Task 2"])
        self.progress._progress_current_portion = 5  # Manually set beyond bounds
        
        progress = self.progress.get_progress()
        assert progress["portion_label"] is None

    def test_dynamic_label_updates(self):
        """Test dynamic updating of labels during execution."""
        self.progress.set_progress_total_portions(3, ["Phase 1", "Phase 2", "Phase 3"])
        
        # Update current portion label
        self.progress.set_progress_current_portion_label("Updated Phase 1")
        progress = self.progress.get_progress()
        assert progress["portion_label"] == "Updated Phase 1"
        
        # Move to next portion and update its label
        self.progress.next_progress_portion()
        self.progress.set_progress_current_portion_label("Modified Phase 2")
        progress = self.progress.get_progress()
        assert progress["portion_label"] == "Modified Phase 2"

    def test_steps_and_portions_independence(self):
        """Test that steps and portions work independently."""
        # Test steps without portions
        self.progress.set_progress_total_steps(3, ["Step A", "Step B", "Step C"])
        self.progress.next_progress_step(1)
        
        progress = self.progress.get_progress()
        assert progress["total_portions"] is None
        assert progress["current_portion"] == 0
        assert progress["total_steps"] == 3
        assert progress["current_step"] == 1
        assert progress["step_label"] == "Step B"
        
        # Add portions later
        self.progress.set_progress_total_portions(2, ["Task X", "Task Y"])
        progress = self.progress.get_progress()
        assert progress["total_portions"] == 2
        assert progress["portion_label"] == "Task X"
        # Steps should remain unchanged
        assert progress["total_steps"] == 3
        assert progress["current_step"] == 1


class TestCyberDBProgressIntegration:
    """Integration tests simulating real scanner usage patterns."""
    
    def test_single_phase_scanner_simulation(self):
        """Simulate a single-phase scanner with multiple steps."""
        scanner_progress = CyberDBProgressMixin()
        
        # Setup scanner steps
        steps = [
            "Initializing scanner",
            "Discovering targets", 
            "Running vulnerability checks",
            "Generating report",
            "Cleaning up"
        ]
        scanner_progress.set_progress_total_steps(labels=steps)
        
        # Simulate step-by-step execution
        results = []
        for i in range(len(steps)):
            progress = scanner_progress.get_progress()
            results.append({
                'step': progress['current_step'],
                'total': progress['total_steps'], 
                'label': progress['step_label']
            })
            scanner_progress.next_progress_step()
        
        # Verify progression
        assert results[0] == {'step': 0, 'total': 5, 'label': 'Initializing scanner'}
        assert results[2] == {'step': 2, 'total': 5, 'label': 'Running vulnerability checks'}
        assert results[4] == {'step': 4, 'total': 5, 'label': 'Cleaning up'}

    def test_multi_phase_scanner_simulation(self):
        """Simulate a complex multi-phase scanner."""
        scanner_progress = CyberDBProgressMixin()
        
        # Setup main phases
        phases = ["Network Discovery", "Vulnerability Scanning", "Report Generation"]
        scanner_progress.set_progress_total_portions(labels=phases)
        
        execution_log = []
        
        # Phase 1: Network Discovery
        discovery_steps = ["Ping sweep", "Port scanning", "Service detection"]
        scanner_progress.set_progress_total_steps(labels=discovery_steps)
        
        for _ in range(3):
            progress = scanner_progress.get_progress()
            execution_log.append(f"{progress['portion_label']}: {progress['step_label']}")
            scanner_progress.next_progress_step()
        
        # Move to next phase
        scanner_progress.next_progress_portion()
        
        # Phase 2: Vulnerability Scanning  
        vuln_steps = ["Loading CVE database", "Running exploits", "Analyzing results"]
        scanner_progress.set_progress_total_steps(labels=vuln_steps)
        
        for _ in range(3):
            progress = scanner_progress.get_progress()
            execution_log.append(f"{progress['portion_label']}: {progress['step_label']}")
            scanner_progress.next_progress_step()
            
        # Verify execution flow
        assert "Network Discovery: Ping sweep" in execution_log
        assert "Network Discovery: Service detection" in execution_log
        assert "Vulnerability Scanning: Loading CVE database" in execution_log
        assert "Vulnerability Scanning: Analyzing results" in execution_log

    def test_error_recovery_simulation(self):
        """Simulate error recovery scenarios."""
        scanner_progress = CyberDBProgressMixin()
        
        # Setup initial state
        scanner_progress.set_progress_total_portions(3, ["Init", "Scan", "Report"])
        scanner_progress.set_progress_total_steps(5, ["Step 1", "Step 2", "Step 3", "Step 4", "Step 5"])
        
        # Simulate progressing through steps
        scanner_progress.next_progress_step(3)  # Complete 3 steps
        
        # Simulate error requiring restart of current portion by resetting steps
        # When we set_total_steps again, it doesn't reset current_step automatically
        # We need to manually reset or use next_portion() which resets steps
        scanner_progress.next_progress_portion()  # Move to next portion (resets steps)
        scanner_progress.set_progress_total_steps(5, ["Retry 1", "Retry 2", "Retry 3", "Retry 4", "Retry 5"])
        
        progress = scanner_progress.get_progress()
        assert progress["current_step"] == 0  # Reset due to next_portion
        assert progress["step_label"] == "Retry 1"
        assert progress["portion_label"] == "Scan"  # Moved to next portion
