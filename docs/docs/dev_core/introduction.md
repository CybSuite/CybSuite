# Core Developer Guide

This section is the developer guide for those who want to contribute to and develop the core CybSuite project. Here you'll learn how to:

- Understand the internal architecture and design
- Modify core functionality and components

If you're only interested in developing plugins or extensions, please see the [Extension Developer Guide](../dev_extension/introduction.md) instead.


## Technologies and Libraries

This project uses the Python library `koalak` (maintained by the CybSuite team) for core utilities:

- `koalak.plugin_manager`: Handles the plugin architecture and extensibility
- `koalak.subcommand_parser`: Light wrapper around argparse for CLI functionality
- `koalak.description`: Provides dataclasses (`FieldDescription`, `EntityDescription`, `SchemaDescription`) for database schema and documentation

Key components:

- CLI: Built with koalak.subcommand_parser (argparse wrapper)
- Database: PostgreSQL
- ORM: Django ORM in standalone mode and REST API backend
- Backend API: Django REST framework (coming soon)
- Frontend: React/Next.js (coming soon)
