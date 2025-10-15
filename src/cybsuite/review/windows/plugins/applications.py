from cybsuite.review.windows import Metadata, WindowsReviewer


class ApplicationsReviewer(WindowsReviewer):
    name = "applications"
    metadata = Metadata(category="windows", description="Review installed applications")
    files = {"applications_wmic.json": "commands/applications_wmic.json"}
    controls = ["applications.useless", "windows.laps", "applications.vuln"]

    def do_run(self, files):
        hostname = self.context.hostname

        # load installed softwares in memory
        filepath = files["applications_wmic.json"]
        applications_data = self.load_json(filepath)
        # Remove entries with None names
        applications_data = [
            app for app in applications_data if app.get("name") is not None
        ]
        # debug(applications_data)

        application_names = [
            application["name"].strip().lower() for application in applications_data
        ]

        # Check laps
        control_laps = self.control("windows.laps")
        control_laps.ok(
            "Local Administrator Password Solution".lower() in application_names,
            justification="Checked if 'Local Administrator Password Solution' is in installed apps",
        )

        for application in applications_data:
            self.feed(
                "installed_application",
                host=hostname,
                name=application["name"],
                version=application["version"],
            )

            if False:
                for db_application in self.db["applications"]:
                    if (
                        db_application["check"] == "useless"
                        and db_application["type"] == "match"
                        and db_application["name"] in application_lower
                    ):
                        self.alert(
                            "software:useless",
                            details={
                                "software": db_application["name"],
                                "version": application,
                            },
                            confidence="tentative",
                        )

                    if (
                        db_application["check"] == "vuln"
                        and db_application["type"] == "match"
                        and db_application["name"].lower() in application_lower
                    ):
                        self.alert(
                            "software:vuln",
                            details={"software": application},
                            confidence="certain",
                        )
