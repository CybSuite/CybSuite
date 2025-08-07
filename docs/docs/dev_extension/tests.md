# Running Tests

## Test Execution Overview

CybSuite uses `tox` for comprehensive testing, including linting, documentation generation, and unit tests.

## Prerequisites

Install tox if not already available:
```bash
pipx install tox
```

## Running All Tests

Execute the complete test suite:
```bash
tox
```

## Running Specific Tests

To run only specific tests, filter by environment and test function:
```bash
tox -e py313 -- -s -v -k <test_function_name>
```

Replace `py313` with your Python version and `<test_function_name>` with the specific test you want to run.