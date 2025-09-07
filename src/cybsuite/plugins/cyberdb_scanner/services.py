from cybsuite.cyberdb import BaseCyberDBScanner, Metadata


class ServicesVersionScanner(BaseCyberDBScanner):
    name = "services"
    metadata = Metadata(
        description="Scan for vulnerable services from version and banner.",
        tags=["default"],
    )

    controls = ["service.weak_service", "ldap.anonymous"]

    def do_run(self):
        self.set_progress_total_portions(labels=[
            "Checking for weak services",
            "Checking LDAP anonymous bind"
        ])

        # Configuration for weak services
        weak_services = {
            514: {
                "service": "rsh",
                "severity": "medium",
                "confidence": "firm",
                "protocol": "tcp",
            },
            21: {
                "service": "ftp",
                "severity": "low",
                "confidence": "firm",
                "protocol": "tcp",
            },
            23: {
                "service": "telnet",
                "severity": "low",
                "confidence": "firm",
                "protocol": "tcp",
            },
        }

        # TODO: later for service also
        # Check for weak services
        self.set_progress_total_steps(len(weak_services))
        for port, config in weak_services.items():
            self.set_progress_current_step_label(f"Checking {config['service']} service on port {port}")

            for service in self.cyberdb.request(
                "service", port=port, protocol=config["protocol"]
            ):
                details = {
                    "service": config["service"],
                    "ip": service.host.ip,
                    "hostname": service.host.hostname,
                    "domain_names": "\n".join(self.cyberdb.resolve(service.host.ip)),
                    "port": service.port,
                    "protocol": service.protocol,
                }
                self.alert(
                    "service.weak_service",
                    details=details,
                    severity=config["severity"],
                    confidence=config["confidence"],
                )
            self.next_progress_step()
        self.next_progress_portion()

        # Check for LDAP anonymous bind
        services = self.cyberdb.request("service", nmap_version="(Anonymous bind OK)")
        self.set_progress_total_steps(len(services))
        for service in services:
            details = {
                "ip": service.host.ip,
                "hostname": service.host.hostname,
                "domain_names": "\n".join(self.cyberdb.resolve(service.host.ip)),
                "port": service.port,
                "protocol": service.protocol,
            }
            self.set_progress_current_step_label(f"Checking LDAP anonymous bind on {service.host.ip}:{service.port}")
            self.alert(
                "ldap.anonymous",
                details=details,
                severity="medium",
                confidence="certain",
            )
            self.next_progress_step()
        self.next_progress_portion()
