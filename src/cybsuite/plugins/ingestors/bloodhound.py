from cybsuite.cyberdb import BaseIngestor, Metadata
from devtools import debug

class BloodhoundIngestor(BaseIngestor):
    name = "bloodhound"
    extension = ".txt"

    metadata = Metadata(
        description="Ingestor for Bloodhound JSON files",
    )

    def process_computers(self, filepath):
        self.logger.info(f"Processing computers from {filepath}")
        with open(filepath) as f:
            import json
            data = json.load(f)
            for computer in data["data"]:
                props = computer["Properties"]
                metadata = {
                    "name": props["name"].lower(),
                    "domain": props["domain"].lower(),
                    "sid": computer["ObjectIdentifier"].lower(),
                    "os": props.get("operatingsystem"),
                    "enabled": props.get("enabled"),
                    "pwd_last_set": props.get("pwdlastset"),
                    "distinguished_name": props.get("distinguishedname"),
                    "sam_account_name": props.get("samaccountname"),
                    "when_created": props.get("whencreated"),
                    "last_logon": props.get("lastlogon"),
                    "last_logon_timestamp": props.get("lastlogontimestamp"),
                    "description": props.get("description"),
                    "primary_group_sid": props.get("primarygroupsid"),
                    "dns_hostname": props.get("dnshostname"),
                    "os_version": props.get("operatingsystemversion")
                }
                self.cyberdb.feed('ad_computer', **metadata)

    def process_users(self, filepath):
        self.logger.info(f"Processing users from {filepath}")
        with open(filepath) as f:
            import json
            data = json.load(f)
            for user in data["data"]:
                props = user["Properties"]
                # debug(props)
                metadata = {
                    "name": props["name"].lower(),
                    "domain": props["domain"].lower(),
                    "enabled": props.get("enabled"),
                    "pwd_last_set": props.get("pwdlastset"),
                    "email": props.get("email"),
                    # Additional fields from schema and JSON
                    "sid": user["ObjectIdentifier"].lower(),
                    "full_name": props.get("displayname"),
                    "description": props.get("description"),
                    "distinguished_name": props.get("distinguishedname"),
                    "sam_account_name": props.get("samaccountname"),
                    "when_created": props.get("whencreated"),
                    "last_logon": props.get("lastlogon"),
                    "last_logon_timestamp": props.get("lastlogontimestamp"),
                    "admin_count": props.get("admincount"),
                    "pwd_never_expires": props.get("pwdneverexpires")
                }
                self.cyberdb.feed('ad_user', **metadata)

    def process_groups(self, filepath):
        with open(filepath) as f:
            import json
            data = json.load(f)
            for group in data.get("data", []):
                metadata = {
                    "name": group["Properties"]["name"],
                    "domain": group["Properties"]["domain"],
                    "description": group["Properties"].get("description", "")
                }
                debug(metadata)

    def process_domains(self, filepath):
        with open(filepath) as f:
            import json
            data = json.load(f)
            for domain in data.get("data", []):
                metadata = {
                    "name": domain["Properties"]["name"],
                    "domain": domain["Properties"]["domain"],
                    "functionallevel": domain["Properties"].get("functionallevel", "")
                }
                debug(metadata)

    def process_gpos(self, filepath):
        with open(filepath) as f:
            import json
            data = json.load(f)
            for gpo in data.get("data", []):
                metadata = {
                    "name": gpo["Properties"]["name"],
                    "domain": gpo["Properties"]["domain"],
                    "gpcpath": gpo["Properties"].get("gpcpath", "")
                }
                debug(metadata)

    def process_ous(self, filepath):
        with open(filepath) as f:
            import json
            data = json.load(f)
            for ou in data.get("data", []):
                metadata = {
                    "name": ou["Properties"]["name"],
                    "domain": ou["Properties"]["domain"],
                    "blocksinheritance": ou["Properties"].get("blocksinheritance", False)
                }
                debug(metadata)

    def process_containers(self, filepath):
        with open(filepath) as f:
            import json
            data = json.load(f)
            for container in data.get("data", []):
                metadata = {
                    "name": container["Properties"]["name"],
                    "domain": container["Properties"]["domain"],
                    "description": container["Properties"].get("description", "")
                }
                debug(metadata)

    def do_run(self, folderpath):
        # Map file patterns to their processing functions
        file_processors = {
            "computers.json": self.process_computers,
            "users.json": self.process_users,
            #"groups.json": self.process_groups,
            #"domains.json": self.process_domains,
            #"gpos.json": self.process_gpos,
            #"ous.json": self.process_ous,
            #"containers.json": self.process_containers
        }

        import os
        import glob
        import json

        # Process each JSON file in the folder
        for pattern in file_processors.keys():
            # Find files matching pattern with timestamp prefix
            matches = glob.glob(os.path.join(folderpath, f"*_{pattern}"))

            if not matches:
                self.logger.warning(f"No files found matching *_{pattern}")
                continue
            self.logger.info(f"Found {len(matches)} files matching *_{pattern}")
            # Process the most recent file for each type
            latest_file = max(matches)
            processor = file_processors[pattern]

            self.logger.info(f"Processing {latest_file}")
            try:
                processor(latest_file)
            except Exception as e:
                debug(f"Error processing {latest_file}: {e.__class__.__name__} {str(e)} ")