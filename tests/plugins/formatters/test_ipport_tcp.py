def test_ipport_tcp_empty_host(new_cyberdb):
    formatted_data = new_cyberdb.request("host", format="ipport_tcp")
    # For empty queryset, should be empty string
    assert formatted_data == ""


def test_ipport_tcp_multiple_hosts(new_cyberdb):
    # Feed multiple hosts with TCP services
    new_cyberdb.feed("service", host="1.1.1.1", port=80, protocol="tcp")
    new_cyberdb.feed("service", host="1.1.1.1", port=443, protocol="tcp")
    new_cyberdb.feed("service", host="2.2.2.2", port=22, protocol="tcp")
    # Add a UDP service that should be ignored
    new_cyberdb.feed("service", host="1.1.1.1", port=53, protocol="udp")

    # Get queryset and format
    formatted_data = new_cyberdb.request("service", format="ipport_tcp")

    # Parse lines into set of ip:port combinations
    result = set(formatted_data.strip().splitlines())

    # Check results - each TCP service should be on its own line
    expected = {"1.1.1.1:80", "1.1.1.1:443", "2.2.2.2:22"}
    assert result == expected
