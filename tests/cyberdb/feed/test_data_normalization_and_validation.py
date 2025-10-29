import pytest


def test_feed_ad_domain_normalization(new_cyberdb):
    new_cyberdb.feed("ad_domain", name="TARGET.LOCAL")

    data = new_cyberdb.first("ad_domain")
    assert data.name == "target.local"  # normalized to lowercase


def test_feed_with_non_existing_arg_fails(new_cyberdb):
    # Ensure IP already working normally
    new_cyberdb.feed("host", ip="1.1.1.1")

    # Check for existing entry it fails
    with pytest.raises(AttributeError):
        new_cyberdb.feed("host", ip="1.1.1.1", non_existing_arg="test")

    # Check for non existing entry it fails
    with pytest.raises(AttributeError):
        new_cyberdb.feed("host", ip="1.1.1.2", non_existing_arg="test")


def test_feed_field_with_choices_fails(new_cyberdb):
    # This should work
    new_cyberdb.feed("service", host="1.1.1.1", protocol="tcp", port=21)

    # This should fail
    with pytest.raises(ValueError):
        new_cyberdb.feed("service", host="1.1.1.1", protocol="some_garbage", port=22)


def test_feed_host_validation(new_cyberdb):
    new_cyberdb.feed("host", ip="1.1.1.1")

    with pytest.raises(ValueError):
        new_cyberdb.feed("host", ip="not_an_ip_but_a_string")

    with pytest.raises(ValueError):
        new_cyberdb.feed("host", ip="1.1.1.555")
