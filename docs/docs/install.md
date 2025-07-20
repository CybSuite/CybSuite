## Installation

Install CybSuite using pipx and docker for PostgreSQL database

### Install pipx

```bash
sudo apt update && sudo apt install -y git python3 pipx
pipx ensurepath && exec $SHELL
```

### Install CybSuite

```bash
pipx install git+https://github.com/CybSuite/CybSuite
```

### Install Docker

```bash
curl -fsSL "https://get.docker.com/" | sh
```

### Install PostgreSQL

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

# Set password in CybSuite conf
cybs-workspace conf cyberdb.password "$POSTGRES_PASSWORD"
```
