from rest_framework.exceptions import ValidationError
from rest_framework.views import exception_handler


def _messages(value):
    """Flatten DRF's nested error structures into a plain list of strings."""
    if isinstance(value, (list, tuple)):
        return [m for item in value for m in _messages(item)]
    if isinstance(value, dict):
        return [m for item in value.values() for m in _messages(item)]
    return [str(value)]


def api_exception_handler(exc, context):
    """Return every error as {"error": ..., "code": ..., "field_errors": {...}}."""
    response = exception_handler(exc, context)
    if response is None:
        return None  # a real server bug: let Django show a 500

    if isinstance(exc, ValidationError):
        detail = exc.detail
        if isinstance(detail, dict):
            field_errors = {name: _messages(value) for name, value in detail.items()}
        else:
            field_errors = {"non_field_errors": _messages(detail)}
        general = field_errors.pop("non_field_errors", [])
        first = (general or next(iter(field_errors.values()), ["Invalid request."]))[0]
        response.data = {"error": first, "code": "validation_error", "field_errors": field_errors}
    else:
        detail = getattr(exc, "detail", "Request failed.")
        code = getattr(exc, "default_code", "error")
        if isinstance(detail, dict):  # the JWT library nests its message
            code = detail.get("code", code)
            detail = detail.get("detail", "Request failed.")
        response.data = {"error": str(detail), "code": str(code)}
    return response