from cybsuite.cyberdb import BaseCyberDBScanner, Metadata


class CleanPortsScanner(BaseCyberDBScanner):
    name = "clean_ports"
    metadata = Metadata(
        description="Delete ports 2000 and 5060 which are commonly false positives, and remove hosts that only have these ports",
        tags=["default"],
        order=30,
    )

    def do_run(self):
        self.set_progress_total_portions(labels=[
            "Removing hosts with only ports 2000 or 5060",
            "Removing services with port 2000",
            "Removing services with port 5060",
        ])
        i_removed_hosts = 0

        hosts = self.cyberdb.request("host")
        self.set_progress_total_steps(len(hosts))
        for host in hosts:
            self.set_progress_current_step_label(f"Checking for {str(host)}")

            services = host.services.all()
            service_ports = {service.port for service in services}

            false_positive_ports = {2000, 5060}
            if service_ports.issubset(false_positive_ports):
                i_removed_hosts += 1
                # TODO: must also check if this host is not added by other source or ping or ...
                #  but for now it's ok
                host.delete()
            self.next_progress_step()
        self.next_progress_portion()
        # TODO: fixme do not print like this ...

        self.logger.info(
            f"Removed {i_removed_hosts} hosts having only ports 2000 or 5060"
        )

        nb_removed_services = (
            self.cyberdb.request("service").filter(port=2000).delete()[0]
        )
        self.logger.info(f"Removed {nb_removed_services} services with port 2000")
        self.next_progress_portion()

        nb_removed_services = (
            self.cyberdb.request("service").filter(port=5060).delete()[0]
        )
        self.logger.info(f"Removed {nb_removed_services} services with port 5060")
        self.next_progress_portion()
