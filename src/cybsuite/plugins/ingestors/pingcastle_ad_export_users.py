import csv
from datetime import datetime

from cybsuite.cyberdb import BaseIngestor, Metadata


class PingcastleAdExportUsersIngestor(BaseIngestor):
    name = "pingcastle_ad_export_users"
    extension = "txt"
    extensions = ["txt"]

    metadata = Metadata(
        description="Ingest PingCastle AD user export data in TSV format"
    )

    def _parse_timestamp(self, timestamp_str):
        if not timestamp_str or timestamp_str == "0001-01-01 00:00:00Z":
            return None
        try:
            return datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%SZ")
        except ValueError:
            return None

    def do_run(self, filepath):
        with open(filepath) as f:
            reader = csv.DictReader(f, delimiter="\t")
            for row in reader:
                # Skip if no sAMAccountName
                if not row.get("sAMAccountName"):
                    continue

                # Extract user metadata
                metadata = {
                    "distinguished_name": row.get("DistinguishedName"),
                    "primary_group_id": row.get("primaryGroupID"),
                    "script_path": row.get("scriptPath"),
                    "last_logon": self._parse_timestamp(row.get("lastLogonTimestamp")),
                    "password_last_set": self._parse_timestamp(row.get("pwdLastSet")),
                    "created_date": self._parse_timestamp(row.get("whenCreated")),
                    "modified_date": self._parse_timestamp(row.get("whenChanged")),
                    "object_class": row.get("objectClass"),
                    "user_account_control": row.get("userAccountControl"),
                    "account_status": {
                        "enabled": row.get("Enabled") == "True",
                        "disabled": row.get("Disabled") == "True",
                        "active": row.get("Active") == "True",
                        "inactive": row.get("Inactive") == "True",
                        "locked": row.get("Locked") == "True",
                    },
                    "password_flags": {
                        "never_expires": row.get("PwdNeverExpires") == "True",
                        "not_required": row.get("PwdNotRequired") == "True",
                    },
                    "security_flags": {
                        "sid_history": row.get("SidHistory") == "True",
                        "bad_primary_group": row.get("BadPrimaryGroup") == "True",
                        "des_enabled": row.get("DesEnabled") == "True",
                        "not_aes_enabled": row.get("NotAesEnabled") == "True",
                        "trusted_for_delegation": row.get(
                            "TrustedToAuthenticateForDelegation"
                        )
                        == "True",
                        "reversible_encryption": row.get("ReversibleEncryption")
                        == "True",
                        "duplicate": row.get("Duplicate") == "True",
                        "no_preauth": row.get("NoPreAuth") == "True",
                    },
                }

                # Feed to cyberdb
                # self.cyberdb.feed("ad_user", name=row['sAMAccountName'], metadata=metadata)
                debug(metadata)
