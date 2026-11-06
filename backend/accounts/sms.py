import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

LIVE_URL = "https://api.africastalking.com/version1/messaging"
SANDBOX_URL = "https://api.sandbox.africastalking.com/version1/messaging"


def send_sms(phone, message):
    """Send an SMS through Africa's Talking.

    With no AT_API_KEY set, the message prints in the server console instead.
    Returns True when Africa's Talking accepted the message.
    """
    if not settings.AT_API_KEY:
        print(f"\n[SMS to {phone}] {message}\n")
        return True

    username = settings.AT_USERNAME
    url = SANDBOX_URL if username == "sandbox" else LIVE_URL

    data = {
        "username": username,
        "to": f"+{phone}",  # we store 2547XXXXXXXX, Africa's Talking wants +2547XXXXXXXX
        "message": message,
    }
    sender = getattr(settings, "AT_SENDER_ID", "")
    if sender:
        data["from"] = sender

    try:
        resp = requests.post(
            url,
            data=data,
            headers={"apiKey": settings.AT_API_KEY, "Accept": "application/json"},
            timeout=10,
        )
        resp.raise_for_status()
        recipients = resp.json()["SMSMessageData"]["Recipients"]
    except (requests.RequestException, KeyError, ValueError):
        logger.exception("SMS to %s failed", phone)
        return False

    # statusCode 101 means "sent"
    if not recipients or recipients[0].get("statusCode") != 101:
        logger.error("SMS to %s rejected: %s", phone, recipients)
        return False
    return True