# Extension Developer Guide

CybSuite is designed with extensibility in mind through its plugin architecture. You can easily extend its functionality by developing plugins (ingestors, scanners, reporters, etc.) without needing to understand the internal workings of the core system.

## What You Can Extend

**Adding Plugins**
- Create custom ingestors, scanners, reporters, and formatters - see [Plugins Guide](plugins.md)

**Database Schema Extensions (Coming soon)**
- Extend CybSuite's database schema

**Knowledge Base (Coming Soon)**
- Add custom data like controls definitions, tags, or other table content

**Package an Extensions**
- Package all your customizations into a Python package and distribute it through PyPI - see [Extension Development Guide](extension.md)

## Getting Started

**Development Environment**
- See [Development Environment Guide](dev_environment.md) for setup instructions

**Testing**
- See [Tests Guide](tests.md) for running tests

## Getting further

If you want to go further and contribute to core features or modify the core functionality, check out the [Core Developer Guide](../dev_core/introduction.md) guide.
