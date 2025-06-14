import sqlite3
from pathlib import Path
from typing import Iterator, List, Optional, Union

import devtools
from cybsuite.cyberdb import BaseIngestor, Metadata

# TODO: cached loggon LSA might not be up to date


def sqlite_list_tables(filepath: Path) -> List[str]:
    """
    List all tables in a SQLite database.

    Args:
        filepath: Path to the SQLite database file

    Returns:
        List of table names
    """
    conn = sqlite3.connect(filepath)
    cursor = conn.cursor()

    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]

    conn.close()
    return tables


def sqlite_iter_table(filepath: Path, table: str) -> Iterator[dict]:
    """
    Iterate over rows in a SQLite table, yielding each row as a dictionary.

    Args:
        filepath: Path to the SQLite database file
        table: Name of the table to iterate over

    Returns:
        Iterator yielding each row as a dictionary (column_name -> value)
    """
    conn = sqlite3.connect(filepath)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        cursor.execute(f"SELECT * FROM {table}")
        while True:
            batch = cursor.fetchmany(1000)
            if not batch:
                break
            for row in batch:
                yield dict(row)
    finally:
        conn.close()


class NetexecIngestor(BaseIngestor):
    name = "netexec"
    extension = "nxc"  # Not really used since we handle databases
    metadata = Metadata(
        description="Ingest NetExec databases and logs (.sam, .cached, .secrets, .db). Takes single files or folders in ~/.nxc. Not all tables are parsed yet."
    )
    supported_protocols = [
        "ftp",
        "ldap",
        "mssql",
        "nfs",
        "rdp",
        "smb",
        "ssh",
        "vnc",
        "winrm",
        "wmi",
    ]

    def do_run(
        self, filepath: Optional[str] = None, protocol: Optional[str] = None
    ) -> None:
        """
        Parse NetExec database files or directories.

        Args:
            filepath: Path to either:
                     - A single protocol database file (e.g. smb.db)
                     - A single log file (.sam, .cached, .secrets)
                     - A workspace directory containing multiple protocol databases
                     - A logs directory containing .sam .cached .secrets files
                     - A NetExec root directory containing workspaces
                     If None, defaults to ~/.nxc
            protocol: Override the protocol detection for single files
                     If None, detect from filename
                     If specified, must be one of the supported protocols
        """

        if filepath is None:
            # Default case: parse default workspace in ~/.nxc
            root_path = Path.home() / ".nxc"
            if not root_path.exists():
                devtools.debug(
                    f"Error: FileNotFoundError",
                    f"Default NetExec path does not exist: {root_path}",
                )
                raise FileNotFoundError(
                    f"Default NetExec path does not exist: {root_path}"
                )

            self._parse_root_folder(root_path)

        path = Path(filepath)
        if not path.exists():
            devtools.debug(f"Error: FileNotFoundError", f"Path does not exist: {path}")
            raise FileNotFoundError(f"Path does not exist: {path}")

        elif path.is_dir():
            if any(path.glob("workspaces")):
                self._parse_root_folder(path)
            elif (
                any(path.glob("*.sam"))
                or any(path.glob("*.cached"))
                or any(path.glob("*.secrets"))
            ):
                self._parse_logs_folder(path)
            elif any(path.glob("*.db")):
                self._parse_workspace_folder(path)
            else:
                devtools.debug(
                    f"Error: ValueError",
                    f"Directory contains no parseable files: {path}",
                )
                raise ValueError(f"Directory contains no parseable files: {path}")
        elif path.is_file():
            if path.suffix == ".sam":
                self._parse_sam_file(path)
            elif path.suffix == ".cached":
                self._parse_cached_file(path)
            elif path.suffix == ".secrets":
                self._parse_secrets_file(path)
            elif path.suffix == ".db":
                self._parse_db_file(path, protocol=protocol)
            else:
                devtools.debug(f"Error: ValueError", f"Unsupported file type: {path}")
                raise ValueError(f"Unsupported file type: {path}")

    def _parse_root_folder(self, root_path: Path) -> None:
        """Parse a root directory containing workspaces"""
        self._parse_workspace_folder(root_path / "workspaces" / "default")
        self._parse_logs_folder(root_path / "logs")
        # TODO: parse one or many workspaces?
        devtools.debug("Parsing root folder", root_path)
        # TODO: Implement root folder parsing

    def _parse_workspace_folder(self, workspace_path: Path) -> None:
        """
        Parse all protocol databases in a workspace directory.
        A workspace is a directory containing database files for each protocol:
        ftp.db, ldap.db, mssql.db, nfs.db, rdp.db, smb.db, ssh.db, vnc.db, winrm.db, wmi.db
        """
        devtools.debug("Parsing workspace", workspace_path)

        # Parse each protocol database if it exists
        for protocol in self.supported_protocols:
            db_path = workspace_path / f"{protocol}.db"
            if db_path.exists():
                devtools.debug(f"Found {protocol} database", db_path)
                parse_method = getattr(self, f"_parse_{protocol}")
                parse_method(db_path)
            else:
                devtools.debug(f"No {protocol} database found")

    def _parse_logs_folder(self, logs_path: Path) -> None:
        """Parse a folder containing NetExec log files (.sam, .cached, .secrets)"""
        self.logger.info(f"Parsing logs folder: {logs_path}")
        for file in logs_path.glob("*.sam"):
            self._parse_sam_file(file)
        for file in logs_path.glob("*.cached"):
            self._parse_cached_file(file)
        for file in logs_path.glob("*.secrets"):
            self._parse_secrets_file(file)

    def _parse_sam_file(self, sam_path: Path) -> None:
        self.logger.info(f"Parsing SAM file: {sam_path}")

        # Extract domain and IP from filename
        filename = sam_path.name
        domain_ip = filename.split("_")[0:2]
        domain_name = domain_ip[0].lower()
        ip = domain_ip[1]

        with open(sam_path, "r") as f:
            for line in f:
                if not line.strip():
                    continue

                # Parse hash line
                parts = line.strip().split(":")
                if len(parts) >= 4:
                    username = parts[0].lower()
                    rid = parts[1].lower()
                    lm_hash = parts[2].lower()
                    ntlm_hash = parts[3].lower()
                    self.cyberdb.feed("dns", ip=ip, domain_name=domain_name)
                    # In SAM we have local users
                    self.cyberdb.feed(
                        "windows_user",
                        host=ip,
                        user=username,
                        rid=rid,
                        lm=lm_hash,
                        ntlm=ntlm_hash,
                    )

                else:
                    devtools.debug(
                        f"Error: ValueError", f"Invalid SAM file: {sam_path}"
                    )
                    raise ValueError(f"Invalid SAM file: {sam_path}")

    def _parse_cached_file(self, cached_path: Path) -> None:
        self.logger.info(f"Parsing CACHED file: {cached_path}")
        # TODO: Implement CACHED parsing

    def _parse_secrets_file(self, secrets_path: Path) -> None:
        self.logger.info(f"Parsing SECRETS file: {secrets_path}")
        # TODO: Implement SECRETS parsing

    def _parse_db_file(self, db_path: Path, protocol: Optional[str] = None) -> None:
        self.logger.info(f"Parsing DB file: {db_path}")
        if protocol is None:
            protocol = db_path.stem

        if protocol not in self.supported_protocols:
            devtools.debug(f"Error: ValueError", f"Unsupported protocol: {protocol}")
            raise ValueError(f"Unsupported protocol: {protocol}")

        parser_method = getattr(self, f"_parse_{protocol}")
        parser_method(db_path)

    def _parse_ftp(self, db_path: Path) -> None:
        """Parse FTP database and debug table structures and row contents"""
        self.logger.info(f"Parsing FTP database: {db_path}")
        # TODO more tables
        # List all tables
        for row in sqlite_iter_table(db_path, "hosts"):
            self.cyberdb.feed(
                "service",
                host=row["host"],
                port=row["port"],
                protocol="tcp",
                type="ftp",
                banner=row["banner"],
            )

    def _parse_ldap(self, db_path: Path) -> None:
        devtools.debug("Parsing LDAP database", db_path)
        # TODO: Implement LDAP parsing

    def _parse_mssql(self, db_path: Path) -> None:
        devtools.debug("Parsing MSSQL database", db_path)
        # TODO: Implement MSSQL parsing

    def _parse_nfs(self, db_path: Path) -> None:
        devtools.debug("Parsing NFS database", db_path)
        # TODO: Implement NFS parsing

    def _parse_rdp(self, db_path: Path) -> None:
        devtools.debug("Parsing RDP database", db_path)
        # TODO: Implement RDP parsing

    def _parse_smb(self, db_path: Path) -> None:
        hostnames = [
            row["hostname"].lower() for row in sqlite_iter_table(db_path, "hosts")
        ]
        for row in sqlite_iter_table(db_path, "hosts"):
            # TODO: parse OS
            os = row["os"]
            kwargs = {}
            if "windows" in os.lower():
                kwargs["os_family"] = "windows"
            if row["hostname"]:
                kwargs["hostname"] = row["hostname"].lower()
            if row["domain"] and row["domain"] != "\x00":
                kwargs["domain"] = row["domain"]

            self.cyberdb.feed(
                "host",
                ip=row["ip"],
                **kwargs,
            )
            service = self.cyberdb.feed(
                "service", host=row["ip"], port=445, protocol="tcp", type="smb"
            )[0]
            self.cyberdb.feed(
                "service_smb",
                service=service,
                smbv1=bool(row["smbv1"]),
                signing=bool(row["signing"]),
            )
            # TODO: spooler zerologon petipotam

        # TODO: how to handle passwords, store all passwords
        # TODO: fix users, because domain can be domain or hostname...
        local_users = []
        domain_users = []
        for row in sqlite_iter_table(db_path, "users"):
            domain = row["domain"].lower()
            user = row["username"].lower()

            if domain == "\x00" or not user:
                # Can do nothing with this, when user is empty, domain can be domain name or hostname we can't know
                # TODO: even if domain is empty add password / username for bruteforce later
                row_copy = row.copy()
                row_copy["password"] = "REMOVED"
                # TODO: add debug method that will write in file to be sent to developer
                continue
            elif domain == ".":
                # Local user, but each time we have '.' (in my local tests) we have duplicated row, so might not need it
                # TODO: consider adding username / password / hashes for later
                continue
                local_user = True
            else:
                domain_user = True

            kwargs = {}
            print(row)
            if row["password"]:
                if row["credtype"] == "plaintext":
                    kwargs["password"] = row["password"]
                elif row["credtype"] == "hash":
                    if ":" in row["password"]:
                        kwargs["lm"], kwargs["ntlm"] = row["password"].split(":")
                    else:
                        kwargs["ntlm"] = row[
                            "password"
                        ]  # TODO: not sure if its lm or ntlm

                else:
                    self.logger.warning(
                        f"Unsupported credential type: {row['credtype']}"
                    )

            if row["domain"] and row["domain"] not in ["", "\x00"]:
                domain = row["domain"].lower()
                if domain in hostnames:
                    local_users.append((row["username"], row["domain"]))
                else:
                    domain_users.append((row["username"], row["domain"]))
                kwargs["domain"] = row["domain"]
                self.cyberdb.feed(
                    "ad_user",
                    name=row["username"],
                    **kwargs,
                )
            else:
                # TODO: check how we can add local hosts?
                kwargs["domain"] = None
        devtools.debug(local_users, domain_users)

        # TODO: Parse other tables

    def _parse_ssh(self, db_path: Path) -> None:
        devtools.debug("Parsing SSH database", db_path)
        # TODO: Implement SSH parsing

    def _parse_vnc(self, db_path: Path) -> None:
        devtools.debug("Parsing VNC database", db_path)
        # TODO: Implement VNC parsing

    def _parse_winrm(self, db_path: Path) -> None:
        devtools.debug("Parsing WinRM database", db_path)
        # TODO: Implement WinRM parsing

    def _parse_wmi(self, db_path: Path) -> None:
        devtools.debug("Parsing WMI database", db_path)
        # TODO: Implement WMI parsing
