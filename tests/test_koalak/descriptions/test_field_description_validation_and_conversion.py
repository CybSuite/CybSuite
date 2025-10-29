import pytest
from koalak.descriptions.field_description import FieldDescription


def test_min():
    field = FieldDescription(min=10)
    field.convert_and_validate(12)

    with pytest.raises(ValueError):
        field.convert_and_validate(9)


def test_max():
    field = FieldDescription(max=10)
    field.convert_and_validate(8)

    with pytest.raises(ValueError):
        field.convert_and_validate(11)


def test_min_length():
    field = FieldDescription(min_length=3)
    field.convert_and_validate("test")

    with pytest.raises(ValueError):
        field.convert_and_validate("ab")


def test_max_length():
    field = FieldDescription(max_length=5)
    field.convert_and_validate("test")
    field.convert_and_validate("abc")
    field.convert_and_validate("abcde")

    with pytest.raises(ValueError):
        field.convert_and_validate("toolong")


def test_choices():
    field = FieldDescription(choices=["a", "b", "c"])
    field.convert_and_validate("a")
    field.convert_and_validate("b")
    field.convert_and_validate("c")

    with pytest.raises(ValueError):
        field.convert_and_validate("d")


def test_choices_nullable():
    field = FieldDescription(choices=["a", "b", "c"], nullable=True)
    field.convert_and_validate(None)
    field.convert_and_validate("a")
    field.convert_and_validate("b")
    field.convert_and_validate("c")

    with pytest.raises(ValueError):
        field.convert_and_validate("d")


def test_validators():
    field = FieldDescription(validators=[lambda x: x > 0])
    field.convert_and_validate(1)

    with pytest.raises(ValueError):
        field.convert_and_validate(0)


def test_converters():
    field = FieldDescription(converters=[lambda x: x + 1])
    assert field.convert_and_validate(1) == 2
