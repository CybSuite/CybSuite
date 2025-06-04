import csv

from cybsuite.cyberdb import BaseIngestor, Metadata


class PingcastleAdExportComputersIngestor(BaseIngestor):
    name = "pingcastle_ad_export_computers"
    extension = "txt"
    extensions = ["txt"]

    metadata = Metadata(
        description="Ingest PingCastle AD computer export data in TSV format"
    )

    def do_run(self, filepath):
        with open(filepath) as f:
            reader = csv.DictReader(f, delimiter="\t")
            for row in reader:
                # Skip if no sAMAccountName
                if not row.get("sAMAccountName"):
                    continue

                # Extract computer name without $ suffix
                computer_name = row["sAMAccountName"].rstrip("$")

                # Build metadata dictionary
                metadata = {
                    "distinguished_name": row.get("DistinguishedName", ""),
                    "operating_system": row.get("OperatingSystem", ""),
                    "operating_system_version": row.get("OperatingSystemVersion", ""),
                    "pc_os_1": row.get("PC OS 1", ""),
                    "pc_os_2": row.get("PC OS 2", ""),
                    "enabled": row.get("Enabled", "").lower() == "true",
                    "disabled": row.get("Disabled", "").lower() == "true",
                    "active": row.get("Active", "").lower() == "true",
                    "inactive": row.get("Inactive", "").lower() == "true",
                    "locked": row.get("Locked", "").lower() == "true",
                    "pwd_never_expires": row.get("PwdNeverExpires", "").lower()
                    == "true",
                    "is_cluster": row.get("IsCluster", "").lower() == "true",
                    "last_logon": row.get("lastLogonTimestamp", ""),
                    "pwd_last_set": row.get("pwdLastSet", ""),
                    "when_created": row.get("whenCreated", ""),
                    "laps_last_update_legacy": row.get(
                        "LAPS last update (legacy LAPS)", ""
                    ),
                    "laps_last_update_ms": row.get("LAPS last update (Ms LAPS)", ""),
                }

                # Feed to cyberdb
                # self.cyberdb.feed("ad_computer", name=computer_name, metadata=metadata)
                debug(metadata)
