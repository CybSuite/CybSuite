from typing import Any


class BaseDescription:
    """Base class for all descriptions (FieldDescription, EntityDescription, SchemaDescription)"""

    def __init__(
        self,
        name: str | None = None,
        *,
        plural_name: str | None = None,
        display_name: str | None = None,
        dest: str | None = None,
        description: str | None = None,
        extra: dict[str, Any] | None = None,
        aliases: list[str] | None = None,
    ):
        """
        Args:
            name: Acts as the primary identifier - this should be used to retrieve the object.
            plural_name: Used when this field appears in a list, such as when referenced by a related field as list. By default, adds "s" to the name.
            display_name: To use when displaying the field, exemple column name or title page.
            dest: Technical name used behind the scenes (e.g. database table name, argparse dest, etc)
            description:
            extra: Other attributes to be stored by 3rd party libraries if needed.
            aliases: Other names.
        """

        # TODO: continue implement aliases
        if aliases is None:
            aliases = []
        if extra is None:
            extra = {}

        self.name = name
        self._plural_name = plural_name
        self._display_name = display_name
        self._dest = dest
        self.description = description
        self.extra = extra
        self.aliases = aliases
        # Internal at
        self._locked: bool = False

    @property
    def plural_name(self) -> str:
        if self._plural_name is None and self.name:
            return self.name + "s"
        return self._plural_name

    @property
    def display_name(self) -> str:
        if self._display_name is None and self.name:
            return self.name.replace("_", " ").title()
        return self._display_name

    @property
    def dest(self):
        if self._dest is None:
            return self.name
        return self._dest

    def lock(self):
        """Lock the field to make it read only"""
        # Works with __setattr__
        # TODO: if we modify list we wont notice it
        self._locked = True
        self.warm_up()

    def unlock(self):
        """Unlock the field to make it writable"""
        # Works with __setattr__
        self._locked = False

    def warm_up(self):
        """Warm attributes to speed up the access"""
        pass

    def __setattr__(self, name, value):
        if getattr(self, "_locked", False) and name != "_locked":
            raise AttributeError(f"Cannot modify '{name}': object is locked")
        super().__setattr__(name, value)
