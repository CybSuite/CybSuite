from cybsuite.review.windows import Metadata, WindowsReviewer


class HotFixReviewer(WindowsReviewer):
    name = "hotfix"
    metadata = Metadata(category="windows", description="Review Get-Hotfix")
    files = {
        "get-hotfix.json": "commands/get-hotfix.json",
        "get-computerinfo.json": "commands/get-computerinfo.json",
    }
    controls = ["os.not_updated", "os.updates_are_not_regular"]

    DELTA_DAYS_NOT_UPDATED_MEDIUM = 90
    DELTA_DAYS_NOT_UPDATED_HIGH = 180
    REGULAR_UPDATE_MAX_CHECK_DAYS = 30 * 12 * 2  # 2 years

    def do_run(self, files):
        extract_date = self.context.extract_datetime
        hostname = self.context.hostname

        # Load and display OS install date
        computerinfo_filepath = files["get-computerinfo.json"]
        computerinfo_data = self.load_json(computerinfo_filepath)
        os_install_date_str = computerinfo_data[0].get("OsInstallDate")
        if os_install_date_str:
            os_install_date = self.parse_date_value(os_install_date_str)
            self.feed("hostname", name=hostname, install_date=os_install_date)

        filepath = files["get-hotfix.json"]
        updates = self.load_json(filepath)
        updates.sort(key=lambda x: self.parse_date_value(x["InstalledOn"]["value"]))
        security_updates = [e for e in updates if e["Description"] == "Security Update"]
        self._feed_host_update(updates, hostname)

        self._check_latest_security_update(security_updates, extract_date)
        self._check_updates_are_regular(security_updates, extract_date, os_install_date)

    def _feed_host_update(self, updates, hostname):
        # Feed host_update data for all updates
        for update in updates:
            update_type = (
                "security" if update["Description"] == "Security Update" else "feature"
            )
            installed_on_date = self.parse_date_value(update["InstalledOn"]["value"])

            self.feed(
                "host_update",
                host=hostname,
                update_id=update["HotFixID"],
                type=update_type,
                installed_by=update.get("InstalledBy", None),
                installed_on=installed_on_date,
            )

    def _check_latest_security_update(self, security_updates, extract_date):
        control = self.control("os.not_updated")

        if not security_updates:
            control.ko(
                confidence="firm",
                severity="high",
                justification="No security updates found on the system with Get-Hotfix",
            )
            return

        latest_security_update = security_updates[-1]
        installed_on = latest_security_update["InstalledOn"]["value"]

        installed_on_date = self.parse_date_value(installed_on)
        delta_days = (extract_date - installed_on_date).days
        if delta_days > self.DELTA_DAYS_NOT_UPDATED_HIGH:
            severity = "high"
        elif delta_days > self.DELTA_DAYS_NOT_UPDATED_MEDIUM:
            severity = "medium"
        else:
            severity = None

        control.details["days"] = delta_days
        # FIXME: makeit as a date and not a str
        control.details["latest_update"] = str(installed_on_date)
        control.ko(
            status=delta_days > self.DELTA_DAYS_NOT_UPDATED_MEDIUM,
            severity=severity,
            confidence="firm",
            justification="Checking the latest security update with Get-Hotfix",
        )

    def _check_updates_are_regular(
        self, security_updates, extract_date, os_install_date
    ):
        """
        If we have at least 2 security updates that are more than X days appart, it's KO.
        Otherwise, it's OK.
        """
        control = self.control("os.updates_are_not_regular")

        # Check if OS was installed recently (less than 90 days)
        if os_install_date:
            days_since_install = (extract_date - os_install_date).days
            if days_since_install < self.DELTA_DAYS_NOT_UPDATED_MEDIUM:
                control.ok(
                    confidence="certain",
                    justification=f"OS installed recently ({days_since_install} days ago), regular update check not applicable",
                )
                return

        # Check if security updates are regular
        # Find the maximum gap between consecutive security updates
        max_gap_days = 0
        max_gap_details = {}

        if len(security_updates) < 2:
            # If less than 2 updates, consider it OK (no gaps to check)
            max_gap_days = 0
        else:
            for i in range(len(security_updates) - 1, 0, -1):
                j = i - 1
                security_update_i = security_updates[i]
                security_update_j = security_updates[j]
                date_i = self.parse_date_value(
                    security_update_i["InstalledOn"]["value"]
                )
                date_j = self.parse_date_value(
                    security_update_j["InstalledOn"]["value"]
                )

                # Check only for the 2 last years
                if (extract_date - date_i).days > self.REGULAR_UPDATE_MAX_CHECK_DAYS:
                    continue

                delta_days = (date_i - date_j).days
                if delta_days > max_gap_days:
                    max_gap_days = delta_days
                    max_gap_details = {
                        "update_01": str(security_update_j["HotFixID"]),
                        "update_02": str(security_update_i["HotFixID"]),
                        "dates": f"{date_j} - {date_i}({delta_days} days)",
                        "max_gap_days": delta_days,
                    }

        # Determine severity based on max gap
        if max_gap_days > self.DELTA_DAYS_NOT_UPDATED_HIGH:
            severity = "high"
        elif max_gap_days > self.DELTA_DAYS_NOT_UPDATED_MEDIUM:
            severity = "medium"
        else:
            severity = None

        control.details = max_gap_details
        control.ko(
            status=max_gap_days > self.DELTA_DAYS_NOT_UPDATED_MEDIUM,
            severity=severity,
            confidence="certain",
            justification="Checking the maximum gap between consecutive security updates during last 2 years",
        )
