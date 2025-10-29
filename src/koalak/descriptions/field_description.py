import copy
import datetime
import typing
import warnings
from typing import TYPE_CHECKING, Dict, List

import attrs
import typeguard

if TYPE_CHECKING:
    from .entity_description import EntityDescription

from .base_description import BaseDescription

#
from .known_converters import map_converters
from .known_validators import map_validators

_map_str_to_type = {
    "int": int,
    "str": str,
    "bool": bool,
    "dict": Dict,
    "set[str]": typing.Set[str],
    "list[str]": List[str],
    "datetime": datetime.datetime,
    "date": datetime.date,
    "time": datetime.time,
}


class FieldDescription(BaseDescription):
    """Generic Field class to be used to describe: parameters, attributes, columns, etc."""

    NOTHING = attrs.NOTHING

    JSON_FIELDS = [
        "name",
        "display_name",
        "plural_name",
        "display_name",
        "dest",
        "default",
        "choices",
        "annotation",
        "description",
        "examples",
        "element_examples",
        "indexed",
        "unique",
        "nullable",
        "hidden_in_list",
        "hidden_in_detail",
        "in_filter_query",
        "is_linked_by_related_name",
    ]

    def __init__(
        # Attributes in BaseDescription
        self,
        name: str | None = None,
        *,
        plural_name: str | None = None,
        display_name: str | None = None,
        dest: str | None = None,
        description: str | None = None,
        extra: dict | None = None,
        aliases: list[str] | None = None,
        entity: "EntityDescription" = None,
        # Attributes related to arguments/parameters
        kw_only: bool = None,
        default=attrs.NOTHING,
        annotation=None,
        factory=None,
        # Attributes validation and conversion
        converters: list[callable] | None = None,
        validators: list[callable] | None = None,
        choices: list | None = None,
        min=None,
        max=None,
        max_length: float | None = None,
        min_length: float | None = None,
        length: float | None = None,
        # Attributes related to documentation
        examples: List = None,
        element_examples: List = None,
        # Attributes related to database
        unique: bool = None,
        indexed: bool = None,
        nullable: bool = None,
        in_filter_query: bool = None,
        # additional attributes
        ref=None,
        many=None,
        referenced_entity=None,
        related_name=None,
        is_linked_by_related_name=None,
        repr: bool = None,
        # Doublecheck and aliases
        required: bool = None,
        type=None,
        # Others
        always_show: bool = None,
        hidden: bool = None,  # TODO do some checks with always_show
        hidden_in_list: bool = None,
        hidden_in_detail: bool = None,
    ):
        """
        Args:
            entity: Entity of the field
            kw_only: Whether the field is a keyword-only argument
            default: Default value of the field
            annotation: Annotation of the field
            factory: Factory function of the field
            converters: Converters of the field
        """
        super().__init__(
            name=name,
            plural_name=plural_name,
            display_name=display_name,
            dest=dest,
            description=description,
            extra=extra,
            aliases=aliases,
        )

        # check mutual exclusif arguments
        # -------------------------------
        if default is not attrs.NOTHING and factory is not None:
            raise ValueError(f"'default' and 'factory' are mutually exclusive")

        if type is not None and annotation is not None:
            raise ValueError(f"'type' and 'annotation' are mutually exclusive")

        # check parameters based on others
        # --------------------------------
        if converters is None:
            converters = []
        elif not isinstance(converters, list):
            raise ValueError(f"Converters must be a list, got {type(converters)}")
        else:
            for converter in converters:
                if not callable(converter):
                    raise ValueError(
                        f"Converter {converter} for field {self.name} is not callable"
                    )

        if validators is None:
            validators = []
        elif not isinstance(validators, list):
            raise ValueError(f"Validators must be a list, got {type(validators)}")
        else:
            for validator in validators:
                if not callable(validator):
                    raise ValueError(
                        f"Validator {validator} for field {self.name} is not callable"
                    )

        if type is not None:
            annotation = type

        # Set default arguments
        if kw_only is None:
            kw_only = False

        if indexed is None:
            indexed = False

        if unique is None:
            unique = False

        if in_filter_query is None:
            in_filter_query = False

        if ref is None:
            ref = False

        if many is None:
            many = False

        if always_show is None:
            always_show = False

        if nullable is None:
            if default is None:
                nullable = True
            else:
                nullable = False

        if is_linked_by_related_name is None:
            is_linked_by_related_name = False

        if default is None and nullable is False:
            raise ValueError(f"Cannot have default as None and nullable as False")

        # check hide
        if hidden is not None:
            if hidden_in_list is None:
                hidden_in_list = hidden
            if hidden_in_detail is None:
                hidden_in_detail = hidden

        if hidden_in_list is None:
            hidden_in_list = False
        if hidden_in_detail is None:
            hidden_in_detail = False

        self.entity = entity
        self.kw_only = kw_only
        self.default = default
        self.factory = factory
        self.annotation = annotation

        self.examples = examples
        self.element_examples = element_examples
        self.indexed = indexed
        self.unique = unique
        self.nullable = nullable

        # TODO: put hidden in BaseDescription?
        self.always_show = always_show
        self.hidden_in_list = hidden_in_list
        self.hidden_in_detail = hidden_in_detail
        self.repr = repr
        # Validation and conversion
        self.choices = choices
        self.min = min
        self.max = max
        self.max_length = max_length
        self.min_length = min_length
        self.converters = converters
        self.validators = validators
        # Database related
        self.in_filter_query = in_filter_query
        self.many = many
        self.ref = ref
        self._referenced_entity = referenced_entity
        self._related_name = related_name
        self.is_linked_by_related_name = is_linked_by_related_name

        # Double check only
        if required is not None:
            if required != self.required:
                raise ValueError("This GenericField should not be required")

    def convert_and_validate(self, value, *, validate_type: bool | None = None):
        """Validate and convert the value to the correct type"""
        if validate_type is None:
            validate_type = True
        for converter in self.converters:
            value = converter(value)

        # Check nullability
        if self.nullable and value is None:
            return value

        for validator in self.validators:
            if not validator(value):
                raise ValueError(
                    f"Value {value} is not valid according to validator {validator}"
                )

        if validate_type:
            self.validate_type(value)

        if self.min is not None and value < self.min:
            raise ValueError(f"Value {value} is less than the minimum {self.min}")
        if self.max is not None and value > self.max:
            raise ValueError(f"Value {value} is greater than the maximum {self.max}")
        if self.min_length is not None and len(value) < self.min_length:
            raise ValueError(
                f"Value {value} is less than the minimum length {self.min_length}"
            )
        if self.max_length is not None and len(value) > self.max_length:
            raise ValueError(
                f"Value {value} is greater than the maximum length {self.max_length}"
            )
        if self.choices is not None and value not in self.choices:
            raise ValueError(f"Value {value} is not in the choices {self.choices}")

        return value

    @property
    def related_name(self):
        if not self.has_relationship():
            raise ValueError(f"This is not a related field {self}")
        if not self.entity:
            raise ValueError("Need an entity to get the related name")
        if self._related_name is not None:
            return self._related_name
        return self.entity.plural_name

    def is_set(self) -> bool:
        if isinstance(self.annotation, set):
            return True
        return typing.get_origin(self.annotation) is set

    def is_list(self) -> bool:
        if isinstance(self.annotation, list):
            return True
        return typing.get_origin(self.annotation) is list

    def is_sequence(self) -> bool:
        return self.is_set() or self.is_list()

    def is_atomic(self) -> bool:
        return typing.get_origin(self.annotation) is None

    @property
    def atomic_type(self):
        if typing.get_origin(self.annotation) is None:
            return self.annotation

        args = typing.get_args(self.annotation)
        if len(args) != 1:
            raise ValueError(
                f"Atomic type is not possible for complex annotation {self.annotation}"
            )
        first_arg = args[0]
        if isinstance(first_arg, typing.ForwardRef):
            first_arg = first_arg.__forward_arg__
        return first_arg

    @property
    def referenced_entity(self) -> "EntityDescription":
        if not self.has_relationship():
            return None
            raise ValueError("This field is does not have a relationship")
        return self.atomic_type

    @property
    def hidden(self):
        if self.hidden_in_list != self.hidden_in_detail:
            raise ValueError(
                "Can not use property hide if hide_in_detail and hide_in_list are not the same"
            )
        # return hide_in_list or hide_in_detail
        return self.hidden_in_list

    @hidden.setter
    def hidden(self, value: bool):
        # Set both hidden_in_list and hidden_in_detail to the same value
        self.hidden_in_list = value
        self.hidden_in_detail = value

    @property
    def shown(self):
        return not self.hidden

    @property
    def show_in_list(self):
        return not self.hidden_in_list

    @property
    def show_in_detail(self):
        return not self.hidden_in_detail

    # default = attrs.field(factory=_attr_nothing_factory, kw_only=True)

    # type related
    # ------------
    # raw annotation
    # ref: bool = attrs.field(default=False)
    # many: bool = attrs.field(default=False)
    # in_filter_query: bool = attrs.field(default=False, kw_only=True)

    def get_default(self):
        if self.factory is None:
            return self.default
        return self.factory()

    def build_attrs_field(self):
        return attrs.field(
            default=self.default, factory=self.factory, kw_only=self.kw_only
        )

    def check(self, value):
        warnings.warn(
            "check_type is deprecated, use convert_and_validate instead or validate_type",
            DeprecationWarning,
            stacklevel=2,
        )
        return self.validate_type(value)

    def validate_type(self, value):
        """Verify"""
        try:
            typeguard.check_type(
                value,
                self.annotation,
                collection_check_strategy=typeguard.CollectionCheckStrategy.ALL_ITEMS,
            )
            return True
        except typeguard.TypeCheckError:
            return False

    @property
    def required(self):
        return self.default is attrs.NOTHING and self.factory is None

    @property
    def type(self):
        return self.annotation

    @type.setter
    def type(self, value):
        self.annotation = value

    def is_one_to_many_field(self) -> bool:
        from .entity_description import EntityDescription

        return isinstance(self.type, EntityDescription)

    def is_many_to_many_field(self) -> bool:
        from .entity_description import EntityDescription

        return self.is_sequence() and isinstance(self.atomic_type, EntityDescription)

    def has_relationship(self):
        return self.is_one_to_many_field() or self.is_many_to_many_field()

    def copy(self):
        return copy.deepcopy(self)

    def to_json(self):
        field_dict = {}
        for field in self.JSON_FIELDS:
            field_dict[field] = getattr(self, field)

        field_dict["annotation"] = str(field_dict["annotation"])
        field_dict["entity"] = self.entity.name
        if self.default is attrs.NOTHING:
            field_dict["default"] = "NOTHING"
        if self.has_relationship():
            field_dict["referenced_entity"] = self.referenced_entity.name
        else:
            field_dict["referenced_entity"] = None
        return field_dict

    def __repr__(self):
        if self.entity:
            name = f"{self.entity.name}.{self.name}"
        else:
            name = self.name
        return f"{self.__class__.__name__}({name})"

    def print_str(self):
        print_str = f"{self.name}"
        if self.type is not None:
            try:
                name_type = self.type.__name__
            except AttributeError:
                name_type = self.atomic_type.name

            print_str += f" [yellow]\\[{name_type}][/yellow]"
        return print_str

    def print(self):
        import rich

        rich.print(self.print_str())

    # Class methods
    @classmethod
    def build_attrs_dataclass_from_cls(cls, cls_object):
        attributes = {}
        for attr_name, attr in cls_object.__dict__.items():
            if not isinstance(attr, FieldDescription):
                continue
            attributes[attr_name] = attr.build_attrs_field()

        AttrClass = type(cls_object.__name__, (object,), attributes)
        return attrs.define(AttrClass)

    @classmethod
    def from_dict(cls, dico: dict, type_as_str=None, ignore_type_error=None):
        # If enabled, treat type as str (ex: when loaded from yaml or json)
        if type_as_str is None:
            type_as_str = False

        if ignore_type_error is None:
            ignore_type_error = True

        dico = dict(dico)
        is_set = False
        if type_as_str:
            type = dico.get("type")
            if type:
                type_lower = type.lower()
                if type_lower.startswith("set[") and type_lower.endswith("]"):
                    type_lower = type_lower[4:-1]
                    type = type[4:-1]
                    is_set = True

                if type_lower not in _map_str_to_type and not ignore_type_error:
                    raise KeyError(f"type '{type}' not mapped")
                else:
                    type = _map_str_to_type.get(type_lower, type)
                dico["type"] = type

            dico_converters = dico.get("converters")
            if dico_converters is not None:
                if not isinstance(dico_converters, list):
                    dico_converters = [dico_converters]
                converters = []
                for converter in dico_converters:
                    if converter not in map_converters:
                        raise KeyError(f"converter '{converter}' not mapped")
                    else:
                        converters.append(map_converters[converter])
                dico["converters"] = converters

            dico_validators = dico.get("validators")
            if dico_validators is not None:
                if not isinstance(dico_validators, list):
                    dico_validators = [dico_validators]
                validators = []
                for validator in dico_validators:
                    if validator not in map_validators:
                        raise KeyError(f"validator '{validator}' not mapped")
                    else:
                        validators.append(map_validators[validator])
                dico["validators"] = validators
        if is_set:
            dico["type"] = set[dico["type"]]

        return FieldDescription(**dico)

    def __eq__(self, other):
        if not isinstance(other, FieldDescription):
            raise ValueError("Cannot compare GenericField with a different type.")

        if (
            self.name == other.name
            and self.kw_only == other.kw_only
            and self.default == other.default
            and self.factory == other.factory
            and self.choices == other.choices
            and self.annotation == other.annotation
            and self.description == other.description
            and self.examples == other.examples
            and self.indexed == other.indexed
            and self.unique == other.unique
            and self.min == other.min
            and self.max == other.max
            and self.in_filter_query == other.in_filter_query
            and self.many == other.many
            and self.ref == other.ref
        ):
            return True
        # TODO: add other thing
        return False


# TODO: add a way to have default_as_none
