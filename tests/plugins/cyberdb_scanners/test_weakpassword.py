import pytest
from cybsuite.cyberdb import CyberDB


@pytest.mark.parametrize(
    "table,feed_args,expected_location",
    [
        ("ad_user", {"name": "bob", "domain": "corp.local"}, "bob - corp.local"),
        ("windows_user", {"user": "bob", "host": "192.168.1.1"}, "bob - 192.168.1.1"),
        ("password", {}, None),
    ],
)
def test_auth_weak_password_strong_one(
    new_cyberdb: CyberDB, table, feed_args, expected_location
):
    # Test with a strong password that should not trigger weak password detection
    password = "K9#mP2$vL8@nQ4&jR7"
    new_cyberdb.feed(table, password=password, **feed_args)

    new_cyberdb.scan_for_controls("auth.password.weak")
    controls = new_cyberdb.get_controls("auth.password.weak")

    # The strong password should result in status "ok"
    assert len(controls) == 1
    control = controls[0]

    assert control.status == "ok"
    assert control.details["password"] == password
    assert control.details["location"] == expected_location
    assert control.details["entropy"] > 112
    assert control.details["reasons"] == []


@pytest.mark.parametrize(
    "table,feed_args,expected_location",
    [
        ("ad_user", {"name": "alice", "domain": "corp.local"}, "alice - corp.local"),
        (
            "windows_user",
            {"user": "alice", "host": "192.168.1.1"},
            "alice - 192.168.1.1",
        ),
        ("password", {}, None),
    ],
)
def test_auth_weak_password_weak_one(
    new_cyberdb: CyberDB, table, feed_args, expected_location
):
    # Test with a weak password that should trigger weak password detection
    password = "123"
    new_cyberdb.feed(table, password=password, **feed_args)

    new_cyberdb.scan_for_controls("auth.password.weak")
    controls = new_cyberdb.get_controls("auth.password.weak")

    # The weak password should result in status "ko"
    assert len(controls) == 1
    control = controls[0]

    assert control.status == "ko"
    assert control.details["password"] == password
    assert control.details["location"] == expected_location
    assert control.details["entropy"] < 64
    assert "short" in control.details["reasons"]
    assert "low_entropy" in control.details["reasons"]
    assert "no_lower" in control.details["reasons"]
    assert "no_upper" in control.details["reasons"]
    assert "no_special" in control.details["reasons"]


def test_auth_weak_password_domain_in_password(new_cyberdb: CyberDB):
    # Test with strong password containing domain name
    password = "corpK9#mP2$vL8@nQ4&jR7"
    new_cyberdb.feed("ad_user", name="bob", domain="corp.local", password=password)

    new_cyberdb.scan_for_controls("auth.password.weak")
    controls = new_cyberdb.get_controls("auth.password.weak")

    assert len(controls) == 1
    control = controls[0]

    assert control.details["password"] == password
    assert control.details["location"] == "bob - corp.local"
    assert "known_word" in control.details["reasons"]


def test_auth_weak_password_username_in_password(new_cyberdb: CyberDB):
    # Test with strong password containing username
    password = "bobK9#mP2$vL8@nQ4&jR7"
    new_cyberdb.feed("ad_user", name="bob", domain="corp.local", password=password)

    new_cyberdb.scan_for_controls("auth.password.weak")
    controls = new_cyberdb.get_controls("auth.password.weak")

    assert len(controls) == 1
    control = controls[0]

    assert control.details["password"] == password
    assert control.details["location"] == "bob - corp.local"
    assert "known_word" in control.details["reasons"]
