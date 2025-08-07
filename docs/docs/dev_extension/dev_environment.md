# Development Environment

## Setup

**Clone the repository**
```bash
git clone https://github.com/CybSuite/CybSuite
cd cybsuite
```

**Install the CLI in development mode**
```bash
pipx install -e .
```
This installs the CybSuite CLI in development mode, allowing you to test it from anywhere in your system.

**Install development environment**
```bash
poetry install
```
This sets up the development environment for web backend, docs, tests and also CLI if not using pipx.

## Database

CybSuite requires PostgreSQL. You can set it up using Docker:

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

Or configure an existing PostgreSQL instance in `~/cybsuite/conf.toml` or via CLI:

```bash
cybs-workspace conf cyberdb.host <ip>
cybs-workspace conf cyberdb.port <port>
cybs-workspace conf cyberdb.user <user>
cybs-workspace conf cyberdb.password <password>
```

## Backend

**Run database migrations (once)**
```bash
cd backend
poetry run ./manage.py migrate
```

**Start the backend webserver**
```bash
cd backend
poetry run ./manage.py runserver
```

## Frontend

**Install dependencies**
```bash
cd frontend
npm install
```

**Configure environment variables**
Create `.env.local` in the frontend directory and adapt it:
```bash
DJANGO_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_API_URL=http://localhost:13371
```

**Start the frontend development server**
```bash
cd frontend
npm run dev
```
