from django.conf import settings


def send_sms(phone, message):
    """Until Africa's Talking is connected, the message prints in the server console."""
    if not settings.AT_API_KEY:
        print(f"\n[SMS to {phone}] {message}\n")
        return
    raise NotImplementedError("Africa's Talking sending is added in a later step")