## Available Plugins

### Ingestors

Ingest output of known tools to feed the centralized database.

- **nmap**: Ingest Nmap XML output file. Feed host, service and DNS.
- **masscan**: Ingest Masscan output file. Feed host and service.
- **ipport**: Ingest simple text files containing IP, IP:port (default protocol TCP) or IP:port:protocol. Feed host and service.
- **netexec**: Ingest NetExec databases and logs (.sam, .cached, .secrets, .db). Takes single files or folders in ~/.nxc. Not all tables are parsed yet. Feed host, service, password, ad_user, windows_user, etc.
- **bloodhound**: Ingest BloodHound JSON files / folder. Feed ad_domain, ad_user, ad_computer.
- **impacket_ntds**: Ingest NTDS dump from Impacket. Feed password, hash, ad_user.
- **hashcat**: Ingest Hashcat potfile. Feed password, hash.

### CyberDB Scanners

Passively scan the database to identify vulnerabilities and update the database.

- **clean_ports**: Delete ports 2000 and 5060 which are commonly false positives, and remove hosts that only have these ports.
- **smb**: Scan for SMB services. Alert for SMB v1 and no-signing.
- **services**: Scan for vulnerable services from version and banner.
- **auth**: Scan passwords and hashes, weak password, reuse, etc.
