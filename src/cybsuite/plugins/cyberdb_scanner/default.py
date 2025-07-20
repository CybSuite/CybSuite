from cybsuite.cyberdb import BaseCyberDBScanner, Metadata, pm_cyberdb_scanner


class DefaultScanner(BaseCyberDBScanner):
    # TODO: this should not be a plugin
    name = "default"
    metadata = Metadata(
        description="Default scanner",
    )

    def do_run(self):
        for scaner in pm_cyberdb_scanner.iter(tags=["default"]):
            self.logger.info(f"Running {scaner.name} scanner")
            scanner = scaner(self.cyberdb)
            try:
                scanner.do_run()
            except Exception as e:
                self.logger.error(f"Error running {scaner.name} scanner: {e}")
