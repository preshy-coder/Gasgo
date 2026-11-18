import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone
from rest_framework import generics
from rest_framework.exceptions import APIException, PermissionDenied, Throttled
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import OTPCode, User
from .phone import normalize_phone
from .serializers import OTPRequestSerializer, OTPVerifySerializer, UserSerializer
from .sms import send_sms

CODE_LIFETIME = timedelta(minutes=5)
RESEND_SECONDS = 60
MAX_CODES_PER_HOUR = 5
MAX_WRONG_ATTEMPTS = 5


def _tester_numbers():
    """Phone numbers from OTP_TEST_NUMBERS, in the 2547XXXXXXXX form."""
    return {n for n in (normalize_phone(x) for x in settings.OTP_TEST_NUMBERS) if n}


class InvalidOTP(APIException):
    status_code = 400
    default_code = "invalid_otp"
    default_detail = "That code is incorrect or has expired."


class OTPRequestView(APIView):
    # No authentication here: a stale token in the header must not block login.
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = OTPRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone = serializer.validated_data["phone"]

        now = timezone.now()
        recent = OTPCode.objects.filter(phone=phone, created_at__gte=now - timedelta(hours=1))
        last = recent.order_by("-created_at").first()
        if last:
            waited = int((now - last.created_at).total_seconds())
            if waited < RESEND_SECONDS:
                wait = RESEND_SECONDS - waited
                raise Throttled(wait=wait, detail=f"Please wait {wait} seconds before asking for another code.")
        if recent.count() >= MAX_CODES_PER_HOUR:
            raise Throttled(detail="Too many codes requested. Try again in an hour.")

        is_tester = bool(settings.OTP_TEST_CODE) and (
            settings.OTP_TEST_ALL or phone in _tester_numbers()
        )
        if settings.DEBUG and settings.OTP_DEV_CODE:
            code = settings.OTP_DEV_CODE  # local development only
        elif is_tester:
            code = settings.OTP_TEST_CODE  # demo mode or a listed tester number: fixed code, no SMS sent
        else:
            code = f"{secrets.randbelow(1_000_000):06d}"

        OTPCode.objects.create(phone=phone, code_hash=make_password(code), expires_at=now + CODE_LIFETIME)
        if not is_tester:
            send_sms(phone, f"Your Gasgo code is {code}. It expires in 5 minutes.")
        return Response(status=204)


class OTPVerifyView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone = serializer.validated_data["phone"]
        code = serializer.validated_data["code"]

        otp = (
            OTPCode.objects.filter(phone=phone, used=False, expires_at__gt=timezone.now())
            .order_by("-created_at")
            .first()
        )
        if otp is None or otp.attempts >= MAX_WRONG_ATTEMPTS:
            raise InvalidOTP()
        if not check_password(code, otp.code_hash):
            otp.attempts += 1
            otp.save(update_fields=["attempts"])
            raise InvalidOTP()

        otp.used = True
        otp.save(update_fields=["used"])

        try:
            user = User.objects.get(phone=phone)
            is_new_user = False
        except User.DoesNotExist:
            user = User.objects.create_user(phone=phone)
            is_new_user = True
        if not user.is_active:
            raise PermissionDenied("This account has been disabled.")

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data,
                "is_new_user": is_new_user,
            }
        )


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.user