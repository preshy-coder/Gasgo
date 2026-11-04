import base64
import logging
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import requests
from django.conf import settings
from rest_framework.exceptions import APIException

logger = logging.getLogger(__name__)

BASES = {"sandbox": "https://sandbox.safaricom.co.ke", "production": "https://api.safaricom.co.ke"}
REQUIRED = [
    "MPESA_CONSUMER_KEY",
    "MPESA_CONSUMER_SECRET",
    "MPESA_SHORTCODE",
    "MPESA_PASSKEY",
    "MPESA_CALLBACK_BASE_URL",
    "MPESA_CALLBACK_SECRET",
]
_token = {"value": None, "expires": 0.0}


class PaymentError(APIException):
    status_code = 502

    def __init__(self, message, code="mpesa_unavailable"):
        super().__init__(detail=message, code=code)


def _base():
    return BASES.get(settings.MPESA_ENV, BASES["sandbox"])


def _check_config():
    missing = [name for name in REQUIRED if not getattr(settings, name, "")]
    if missing:
        logger.error("M-Pesa settings missing: %s", ", ".join(missing))
        raise PaymentError("M-Pesa isn't set up on the server yet.", "mpesa_not_configured")


def _access_token():
    """Safaricom tokens last about an hour, so keep one in memory."""
    if _token["value"] and time.time() < _token["expires"]:
        return _token["value"]
    try:
        response = requests.get(
            f"{_base()}/oauth/v1/generate",
            params={"grant_type": "client_credentials"},
            auth=(settings.MPESA_CONSUMER_KEY, settings.MPESA_CONSUMER_SECRET),
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()
        _token["value"] = data["access_token"]
        _token["expires"] = time.time() + int(data.get("expires_in", 3599)) - 60
    except (requests.RequestException, KeyError, ValueError):
        logger.exception("Could not get an M-Pesa access token")
        raise PaymentError("Could not reach M-Pesa. Please try again.")
    return _token["value"]


def stk_push(phone, amount_kes, reference):
    """Ask Safaricom to show the PIN prompt on the customer's phone. Returns the CheckoutRequestID."""
    _check_config()
    timestamp = datetime.now(ZoneInfo("Africa/Nairobi")).strftime("%Y%m%d%H%M%S")
    password = base64.b64encode(
        f"{settings.MPESA_SHORTCODE}{settings.MPESA_PASSKEY}{timestamp}".encode()
    ).decode()
    callback_url = (
        f"{settings.MPESA_CALLBACK_BASE_URL.rstrip('/')}"
        f"/api/v1/payments/mpesa/callback/{settings.MPESA_CALLBACK_SECRET}/"
    )
    payload = {
        "BusinessShortCode": int(settings.MPESA_SHORTCODE),
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": settings.MPESA_TRANSACTION_TYPE,
        "Amount": int(amount_kes),
        "PartyA": int(phone),
        "PartyB": int(settings.MPESA_SHORTCODE),
        "PhoneNumber": int(phone),
        "CallBackURL": callback_url,
        "AccountReference": reference[:12],
        "TransactionDesc": "Gasgo order",
    }
    try:
        response = requests.post(
            f"{_base()}/mpesa/stkpush/v1/processrequest",
            json=payload,
            headers={"Authorization": f"Bearer {_access_token()}"},
            timeout=30,
        )
        data = response.json()
    except (requests.RequestException, ValueError):
        logger.exception("STK push request failed")
        raise PaymentError("Could not reach M-Pesa. Please try again.")

    if data.get("ResponseCode") != "0":
        logger.warning("STK push refused: %s", data)
        raise PaymentError(
            data.get("errorMessage") or data.get("ResponseDescription") or "M-Pesa refused the request.",
            "mpesa_rejected",
        )
    return data["CheckoutRequestID"]