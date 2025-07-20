def test_control_lm_hash_used_ad_user(new_cyberdb):
    new_cyberdb.feed(
        "ad_user",
        name="john",
        domain="target.local",
        lm="aad3b435b51404eeaad3b435b51404ee",
    )  # this one should be ignored since it's the blank LM hash
    new_cyberdb.feed(
        "ad_user",
        name="smith",
        domain="target.local",
        lm="54b53da435e9ebccaad3b435b51404ee",
    )
    new_cyberdb.feed(
        "ad_user",
        name="donald",
        domain="target.local",
        lm="598ddce2660d3193aad3b435b51404ee",
    )

    new_cyberdb.scan_for_controls("windows.lm_hash_used.ad_user")

    observations = new_cyberdb.get_observations("windows.lm_hash_used.ad_user")
    assert len(observations) == 2
    obs = [
        o for o in observations if o.details["lm"] == "54b53da435e9ebccaad3b435b51404ee"
    ][0]
    assert obs.details["lm"] == "54b53da435e9ebccaad3b435b51404ee"
    assert obs.details["username"] == "smith"
    assert obs.details["domain"] == "target.local"

    obs = [
        o for o in observations if o.details["lm"] == "598ddce2660d3193aad3b435b51404ee"
    ][0]
    assert obs.details["lm"] == "598ddce2660d3193aad3b435b51404ee"
    assert obs.details["username"] == "donald"
    assert obs.details["domain"] == "target.local"


def test_control_lm_hash_windows_user(new_cyberdb):
    new_cyberdb.feed(
        "windows_user",
        user="john",
        host="192.168.1.10",
        lm="aad3b435b51404eeaad3b435b51404ee",
    )  # this one should be ignored since it's the blank LM hash
    new_cyberdb.feed(
        "windows_user",
        user="smith",
        host="192.168.1.10",
        lm="54b53da435e9ebccaad3b435b51404ee",
    )
    new_cyberdb.feed(
        "windows_user",
        user="donald",
        host="192.168.1.10",
        lm="598ddce2660d3193aad3b435b51404ee",
    )

    new_cyberdb.scan_for_controls("windows.lm_hash_used.windows_user")

    observations = new_cyberdb.get_observations("windows.lm_hash_used.windows_user")
    assert len(observations) == 2
    obs = [
        o for o in observations if o.details["lm"] == "54b53da435e9ebccaad3b435b51404ee"
    ][0]
    assert obs.details["lm"] == "54b53da435e9ebccaad3b435b51404ee"
    assert obs.details["username"] == "smith"
    assert obs.details["host"] == "192.168.1.10"

    obs = [
        o for o in observations if o.details["lm"] == "598ddce2660d3193aad3b435b51404ee"
    ][0]
    assert obs.details["lm"] == "598ddce2660d3193aad3b435b51404ee"
    assert obs.details["username"] == "donald"
    assert obs.details["host"] == "192.168.1.10"


def test_control_auth_reuse_cross_ad_domains(new_cyberdb):
    # TODO tests LM / NTLM hashes with blank values also
    # John have same password in two different domains
    new_cyberdb.feed(
        "ad_user",
        name="john",
        domain="target.local",
        password="azerty",
    )
    new_cyberdb.feed(
        "ad_user",
        name="john",
        domain="target2.local",
        password="azerty",
    )
    # create other user with same password, that should not be alerted
    new_cyberdb.feed(
        "ad_user",
        name="smith",
        domain="target.local",
        password="azerty",
    )
    # Create 2 users with empty password to not be alerted
    new_cyberdb.feed(
        "ad_user",
        name="user2",
        domain="target.local",
    )
    new_cyberdb.feed(
        "ad_user",
        name="user2",
        domain="target2.local",
    )

    # scan
    new_cyberdb.scan_for_controls("auth.reuse.cross.ad")

    observations = new_cyberdb.get_observations("auth.reuse.cross.ad")
    assert len(observations) == 1
    obs = observations[0]
    assert obs.details["username"] == "john"
    assert obs.details["credential_type"] == "password"
    assert obs.details["credential_value"] == "azerty"
    assert obs.details["domains"] == ["target.local", "target2.local"]


def test_control_auth_reuse_cross_windows_hosts(new_cyberdb):
    # John have same password in two different hosts
    new_cyberdb.feed(
        "windows_user",
        user="john",
        host="10.0.0.1",
        password="azerty",
    )
    new_cyberdb.feed(
        "windows_user",
        user="john",
        host="10.0.0.2",
        password="azerty",
    )
    # create other user with same password, that should not be alerted
    new_cyberdb.feed(
        "windows_user",
        user="smith",
        host="10.0.0.1",
        password="azerty",
    )
    # Create 2 users with empty password to not be alerted
    new_cyberdb.feed(
        "windows_user",
        user="user2",
        host="10.0.0.3",
    )
    new_cyberdb.feed(
        "windows_user",
        user="user2",
        host="10.0.0.4",
    )

    # scan
    new_cyberdb.scan_for_controls("auth.reuse.cross.windows")

    observations = new_cyberdb.get_observations("auth.reuse.cross.windows")
    assert len(observations) == 1
    obs = observations[0]
    assert obs.details["username"] == "john"
    assert obs.details["credential_type"] == "password"
    assert obs.details["credential_value"] == "azerty"
    assert obs.details["hosts"] == ["10.0.0.1", "10.0.0.2"]
