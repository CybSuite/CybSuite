strip_lower = lambda x: x.strip().lower()
strip_upper = lambda x: x.strip().upper()
strip_capitalize = lambda x: x.strip().capitalize()
strip_title = lambda x: x.strip().title()


map_converters = {
    "lower": str.lower,
    "upper": str.upper,
    "strip": str.strip,
    "lstrip": str.lstrip,
    "rstrip": str.rstrip,
    "capitalize": str.capitalize,
    "title": str.title,
    "strip_lower": strip_lower,
    "strip_upper": strip_upper,
    "strip_capitalize": strip_capitalize,
    "strip_title": strip_title,
}
