from cybsuite.cyberdb import BasePassiveScanner, Metadata


class CleanPortsScanner(BasePassiveScanner):
    name = "update_relations"
    metadata = Metadata(
        description="Update relations between hosts and services",
        tags=["default"],
        order=30,
    )

    def do_run(self):
        for windows_user in self.cyberdb.request("windows_user", rid="500"):
            if windows_user.password or windows_user.ntlm:
                self.logger.info(
                    f"User {windows_user.user} on {windows_user.host} is compromised"
                )
                windows_user.host.compromised = True
                windows_user.host.save()
