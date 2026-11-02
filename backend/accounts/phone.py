import re


def normalize_phone(raw):
    """07xx, +2547xx, 2547xx and 7xx all become 2547XXXXXXXX. Returns None if invalid."""
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("254"):
        local = digits[3:]
    elif digits.startswith("0"):
        local = digits[1:]
    else:
        local = digits
    return f"254{local}" if re.fullmatch(r"[17]\d{8}", local) else None