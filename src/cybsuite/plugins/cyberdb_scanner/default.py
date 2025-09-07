from cybsuite.cyberdb import BaseCyberDBScanner, Metadata, pm_cyberdb_scanner
from itertools import tee


class DefaultScanner(BaseCyberDBScanner):
    # TODO: this should not be a plugin
    name = "default"
    metadata = Metadata(
        description="Default scanner",
    )

    def do_run(self):
        scanners = pm_cyberdb_scanner.iter(tags=["default"])
        scanners, copy = tee(scanners)
        self.set_progress_total_portions(len(list(copy)))
        for scaner in scanners:
            self.set_progress_current_portion_label(f"Running {scaner.name} scanner")
            self.logger.info(f"Running {scaner.name} scanner")
            scanner = scaner(self.cyberdb)
            try:
                scanner.do_run()
            except Exception as e:
                self.logger.error(f"Error running {scaner.name} scanner: {e}")

            self.next_progress_portion()
