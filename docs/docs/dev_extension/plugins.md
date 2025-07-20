# Developing Plugins


## Plugin Development Overview


CybSuite plugins (ingestors, reporters, etc.) share a common design pattern and philosophy. To create a plugin:

- Inherit from the appropriate base class (e.g., `BaseIngestor`, `BaseReporter`) - your plugin will be automatically registered through the `__init_subclass__` mechanism
- Set a unique `name` for your plugin
- Optionally add `metadata` with plugin details like description, version, authors, and dependencies
- Implement the required methods defined by the base plugin class
- Add any required fields specified by the base plugin class
- Ensure your plugin file is imported so it can be discovered and registered

For specific implementation details, see the documentation for each plugin type.


## Interacting with the Database

All base plugins (`BaseIngestor`, `BaseReporter`, etc.) inherit from a common base class that provides database interaction capabilities. The following methods are available to all plugins:

- `self.alert(control_definition_name: str, details: dict, **kwargs)`: Creates a new control entry with `status="ko"` when identifying a vulnerability or issue. Example:
  ```python
  self.alert("passwords:weak", details={"password": "azerty", "username": "john"})
  ```

- `self.control(control_definition_name: str, details: dict, **kwargs) -> Control`: Similar to `alert()`, but returns a `Control` object allowing you to set custom status values (`"ok"`, `"ko"`, etc.). Useful for compliance testing or tracking successful controls. Example:
  ```python
  control = self.control("tls:version", details={"version": "1.2"})
  control.ok()
  ```

- `self.feed(table_name: str, **kwargs)`: Upserts (updates or inserts) records into any table besides controls. Handles relations and unique keys automatically. Examples:
  ```python
  # Create/update a service
  self.feed("service", host="1.1.1.1", port=21, protocol="tcp")

  # Feed will automatically handle relations using unique keys
  # e.g. host.ip is the unique key when creating services
  ```


## Examples

While detailed documentation for each plugin type is still in progress, you can find many example implementations in the main CybSuite repository:

- Ingestors: `cybsuite.plugins.ingestors`
- Reporters: `cybsuite.plugins.reporters`
- Scanners: `cybsuite.plugins.scanners`
- Formatters: `cybsuite.plugins.formatters`
