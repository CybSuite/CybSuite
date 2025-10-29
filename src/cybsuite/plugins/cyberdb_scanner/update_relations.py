import ipaddress

from cybsuite.cyberdb import BaseCyberDBScanner, Metadata


class UpdateRelationsScanner(BaseCyberDBScanner):
    name = "update_relations"
    metadata = Metadata(
        description="Update relations between in database, exemple add all hosts to the network they are in",
        tags=["default"],
    )

    def do_run(self):
        self._update_hosts_networks()
        self._update_networks_visible_from_service_to_hosts()

    def _update_hosts_networks(self):
        for network in self.cyberdb.request("network"):
            network_cidr = network.network
            try:
                network_cidr = ipaddress.ip_network(network_cidr)
            except ValueError:
                self.logger.error(f"Invalid network CIDR: {network_cidr}")
                continue

            # Get appropriate prefix based on network size
            prefix_length = network_cidr.prefixlen
            network_addr = str(network_cidr.network_address)
            if prefix_length >= 24:  # /24 or smaller - search first 3 octets
                prefix = ".".join(network_addr.split(".")[:3])
            elif prefix_length >= 16:  # /16 to /23 - search first 2 octets
                prefix = ".".join(network_addr.split(".")[:2])
            elif prefix_length >= 8:  # /8 to /15 - search first octet
                prefix = network_addr.split(".")[0]
            else:  # Larger than /8 - have to search everything
                prefix = ""

            # Query hosts that could be in this network based on optimized prefix
            if prefix:
                potential_hosts = self.cyberdb.request("host", ip__startswith=prefix)
            else:
                potential_hosts = self.cyberdb.request("host")

            # Check each host if it's actually in the network
            for host in potential_hosts:
                try:
                    host_ip = ipaddress.ip_address(host.ip)
                    if host_ip in network_cidr:
                        # Add host to network relation
                        host.networks.add(network)
                except ValueError:
                    self.logger.error(f"Invalid host IP: {host.ip}")
                    continue
            self.logger.info(f"Updating hosts for network {network}")

    def _update_networks_visible_from_service_to_hosts(self):
        for host in self.cyberdb.request("host"):
            all_visible_from_networks = set()
            for service in host.services.all():
                all_visible_from_networks.update(service.visible_from_networks.all())
            host.visible_from_networks.set(all_visible_from_networks)
