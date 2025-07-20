import os

import psycopg2
import pytest
from cybsuite.cyberdb import CyberDB
from cybsuite.cyberdb.config import cyberdb_config
from psycopg2 import sql

_cyberdb = None


def get_db_config():
    """Get the database configuration from by priority: environment, config file, default."""
    temp_db_name = "_cybsuite_cyberdb_"
    user = os.environ.get("CYBSUITE_DB_USER", cyberdb_config["user"])
    password = os.environ.get("CYBSUITE_DB_PASSWORD", cyberdb_config["password"])
    host = os.environ.get("CYBSUITE_DB_HOST", cyberdb_config["host"])
    port = os.environ.get("CYBSUITE_DB_PORT", cyberdb_config["port"])
    return temp_db_name, user, password, host, port


@pytest.fixture
def new_cyberdb() -> CyberDB:
    """Return a new CyberDB instance and clean the DB after tests."""
    global _cyberdb
    if _cyberdb is None:
        temp_db_name, user, password, host, port = get_db_config()
        _cyberdb = CyberDB(
            temp_db_name, user=user, password=password, host=host, port=port
        )
        _cyberdb.migrate()
    yield _cyberdb
    _cyberdb.cleardb()


def pytest_sessionfinish(session, exitstatus):
    """Remove the PostgreSQL database after all tests have been run."""
    try:
        # Connect to the PostgreSQL server
        conn = psycopg2.connect(
            dbname="postgres", user=user, password=password, host=host
        )
        conn.autocommit = True
        cursor = conn.cursor()

        # Drop the test database
        cursor.execute(
            sql.SQL("DROP DATABASE {} WITH (FORCE)").format(
                sql.Identifier(temp_db_name)
            )
        )

        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Warning: Failed to drop the database: {e}")
