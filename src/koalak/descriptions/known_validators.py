import ipaddress

import validators


def validate_ip(ip: str) -> bool:
    """Validate if the ip is a valid ip address"""
    try:
        ipaddress.ip_address(ip)
        return True
    except ValueError:
        return False


def validate_network(network: str) -> bool:
    """Validate if the network is a valid network address"""
    try:
        ipaddress.ip_network(network)
        return True
    except ValueError:
        return False


map_validators = {
    "ip": validate_ip,
    "domain": validators.domain,
    "network": validate_network,
}
