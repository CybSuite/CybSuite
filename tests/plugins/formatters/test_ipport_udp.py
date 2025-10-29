def test_ipport_udp_empty_host(new_cyberdb):
    formatted_data = new_cyberdb.request("host", format="ipport_udp")
    # For empty queryset, should be empty string
    assert formatted_data == ""


def test_ipport_udp_multiple_hosts(new_cyberdb):
    # Feed multiple hosts with UDP services
    new_cyberdb.feed("service", host="1.1.1.1", port=53, protocol="udp")
    new_cyberdb.feed("service", host="1.1.1.1", port=161, protocol="udp")
    new_cyberdb.feed("service", host="2.2.2.2", port=123, protocol="udp")
    # Add a TCP service that should be ignored
    new_cyberdb.feed("service", host="1.1.1.1", port=80, protocol="tcp")

    # Get queryset and format
    formatted_data = new_cyberdb.request("service", format="ipport_udp")

    # Parse lines into set of ip:port combinations
    result = set(formatted_data.strip().splitlines())

    # Check results - each UDP service should be on its own line
    expected = {"1.1.1.1:53", "1.1.1.1:161", "2.2.2.2:123"}
    assert result == expected
