#!/bin/bash
set -e

# Function to wait for PostgreSQL to be ready
wait_for_postgres() {
    echo "Waiting for PostgreSQL to be ready..."
    
    DB_HOST=${DB_HOST:-postgres}
    DB_PORT=${DB_PORT:-5432}
    DB_USER=${DB_USER:-postgres}
    
    until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
        echo "PostgreSQL is unavailable - sleeping for 2 seconds..."
        sleep 2
    done
    
    echo "PostgreSQL is ready!"
}

# Wait for PostgreSQL
wait_for_postgres

echo "Running database migrations..."
cybs-workspace conf cyberdb.host postgres
cybs-workspace conf cyberdb.port 5432
cybs-workspace conf cyberdb.password postgres
cybs-db migrate
python manage.py migrate

echo "Starting Django development server..."
exec python manage.py runserver 0.0.0.0:8000
