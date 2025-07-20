# CybSuite

> **Warning**
> This project is currently in Alpha stage and under active development. While core functionality is implemented and tested, the API and features may change significantly between versions.

Official documentation: https://cybsuite.github.io/CybSuite/

**CybSuite** is a collection of security tools and scripts for penetration testing, configuration review, and reconnaissance. The following tools are available:

- **[cybs-db]**: A centralized database for penetration testing, configuration review, and security assessments. Features built-in ingestors for common security tools (Nmap, Masscan, Netexec, Bloodhound, etc.), passive vulnerability scanning capabilities, reporting capabilities, and a planned web interface.
- **[cybs-review]**: A framework for configuration review that performs post-analysis of extracted configurations. Currently working for Windows systems, with Linux support coming soon.

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

## Installation

Install CybSuite using pipx:

```bash
pipx install git+https://github.com/CybSuite/CybSuite
```

PostgreSQL is required for CybSuite. If you have PostgreSQL installed, configure connection settings in `~/cybsuite/conf.toml` or via CLI:

```bash
cybs-workspace conf cyberdb.host <ip>
cybs-workspace conf cyberdb.port <port>
cybs-workspace conf cyberdb.user <user>
cybs-workspace conf cyberdb.password <password>
```

Or using docker:

```bash
# Generate random password
POSTGRES_PASSWORD=$(openssl rand -base64 30)
echo "Generated PostgreSQL password: $POSTGRES_PASSWORD"

# Pull and run PostgreSQL container
sudo docker run \
    --name cybsuite-db \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    --restart unless-stopped \
    -v cybsuite_data:/var/lib/postgresql/data \
    -p 127.0.0.1:13372:5432 \
    -d \
    postgres

cybs-workspace conf cyberdb.password "$POSTGRES_PASSWORD"
```

## Cybs-db Quick Demo

Cybs-db can ingest various types of security scans, including Nmap and Masscan results:

```bash
# Ingest scan results
cybs-db ingest nmap scans/nmap/*.xml
cybs-db ingest masscan scans/masscan/*

# Ingest recursively all folder using auto-detect
cybs-db ingest all scans

# Request data in different formats
cybs-db request host --format json > hosts.json
cybs-db request service --format ipport --protocol tcp > ipport_tcp.txt
cybs-db request service --port 445 --format ip > smb.txt

# Report identified vulnerabilities
cybs-db report html controls.html
```

## Cybs-review Quick Demo

Quick demonstration to review Windows hosts:

1. Generate the extraction script:
```bash
cybs-review script windows > windows.ps1
```

2. Run the script on your target Windows host (with root privileges for full extraction)

3. For demonstration, download sample extracts:
```bash
mkdir /tmp/cybsuite_extracts && cd /tmp/cybsuite_extracts
wget https://github.com/Nazime/CybSuite/releases/download/v0.1/extracts_WIN-ALPHA.zip
wget https://github.com/Nazime/CybSuite/releases/download/v0.1/extracts_WIN-BETA.zip
```

4. Run the review and open the report:
```bash
cybs-review review extracts_WIN-ALPHA.zip extracts_WIN-BETA.zip --open-report
```

![Report Summary](https://raw.githubusercontent.com/CybSuite/CybSuite/main/images/cybs-review_report_summary.png)

![Report Controls](https://raw.githubusercontent.com/CybSuite/CybSuite/main/images/cybs-review_report_controls.png)

Query the database from your previous review run:

```bash
cybs-db request windows_user --format json
```
