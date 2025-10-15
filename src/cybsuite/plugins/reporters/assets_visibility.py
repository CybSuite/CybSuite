from cybsuite.cyberdb import BaseReporter, Metadata
from koalak.utils import data_to_excel


class AssetsVisibilityReporter(BaseReporter):
    name = "assets_visibility"
    metadata = Metadata(
        description="Generate Excel report for all hosts/services and Networks where they are visible",
    )

    def configure(self, latest_run=None):
        self.latest_run = latest_run

    def run(self, filepath_output, remove_info=True, remove_ok=True):
        # Update relation to know which hosts is visible from which network (by copying service info)
        self.cyberdb.scan("update_relations")
        # Clean useless ports to have accurate results
        self.cyberdb.scan("clean_ports")

        networks = (
            self.cyberdb.request("network")
            .filter(visible_services__isnull=False)
            .distinct()
        )

        # Generate XLSX with 2 tabs 'host' and 'service'
        workbook = None
        for obj_type in ["host", "service"]:
            data = []
            for obj in self.cyberdb.request(obj_type):
                row = {obj_type: str(obj)}
                for network in networks:
                    row[str(network)] = str(network in obj.visible_from.all())

                data.append(row)
            workbook = data_to_excel(data, sheet_name=obj_type, workbook=workbook)
        workbook.save(filepath_output)
