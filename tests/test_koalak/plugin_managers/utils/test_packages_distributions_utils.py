import pytest
from koalak.plugin_manager.packages_distributions_utils import (
    module_to_package_distribution_name,
)


# TODO: FIx me
@pytest.mark.skip(reason="TODO: Fix me")
def test_module_to_package_distribution_name():
    # Koalak is a package with only one distribution so test here is straitforward
    assert (
        module_to_package_distribution_name("koalak.plugin_manager.consts")
        == "cybsuite"
    )
    assert module_to_package_distribution_name("koalak.plugin_manager") == "cybsuite"
    assert module_to_package_distribution_name("yaml") == "PyYAML"
