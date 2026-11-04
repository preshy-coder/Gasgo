import hmac
import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.phone import normalize_phone

from .models import Order, Payment
from .mpesa import stk_push
from .services import OrderError

logger = logging.getLogger(__name__)
S = Order.Status
ACK = {"ResultCode": 0, "ResultDesc": "Accepted"}


class PayRequestSerializer(serializers.Serializer):
    phone = serializers.CharField()

    def validate_phone(self, value):
        phone = normalize_phone(value)
        if not phone:
            raise serializers.ValidationError("Enter a valid M-Pesa number, e.g. 0712 345 678.")
        return phone


class OrderPayView(APIView):
    """The customer taps Pay: send the M-Pesa PIN prompt. The order only becomes paid via the callback."""

    def post(self, request, pk):
        serializer = PayRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone = serializer.validated_data["phone"]

        order = Order.objects.filter(pk=pk, customer=request.user).first()
        if order is None:
            raise NotFound("Order not found.")
        if order.status not in (S.PLACED, S.PAYMENT_FAILED):
            raise OrderError("This order is already paid or closed.", "already_paid")
        just_sent = order.payments.filter(
            status=Payment.Status.PENDING, created_at__gte=timezone.now() - timedelta(seconds=30)
        ).exists()
        if just_sent:
            raise OrderError("A payment prompt was just sent. Check your phone.", "payment_in_progress")

        with transaction.atomic():
            if order.status == S.PAYMENT_FAILED:
                order.move_to(S.PLACED)  # customer is retrying
            payment = Payment.objects.create(order=order, phone=phone, amount_kes=order.total_kes)

        try:
            checkout_id = stk_push(phone, order.total_kes, order.order_number)
        except Exception as exc:
            payment.status = Payment.Status.FAILED
            payment.result_desc = str(getattr(exc, "detail", exc))[:255]
            payment.save(update_fields=["status", "result_desc"])
            raise

        payment.checkout_request_id = checkout_id
        payment.save(update_fields=["checkout_request_id"])
        return Response({"checkout_request_id": checkout_id})


class MpesaCallbackView(APIView):
    """Safaricom calls this with the result. Never trust the app's word that a payment happened, only this."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, token):
        secret = settings.MPESA_CALLBACK_SECRET
        if not secret or not hmac.compare_digest(token.encode(), secret.encode()):
            raise NotFound()

        try:
            callback = request.data["Body"]["stkCallback"]
            checkout_id = callback["CheckoutRequestID"]
            result_code = int(callback["ResultCode"])
        except (KeyError, TypeError, ValueError):
            return Response(ACK)  # not a payment result: acknowledge and ignore
        description = str(callback.get("ResultDesc", ""))[:255]
        items = {
            item.get("Name"): item.get("Value")
            for item in (callback.get("CallbackMetadata") or {}).get("Item", [])
        }

        with transaction.atomic():
            payment = Payment.objects.select_for_update().filter(checkout_request_id=checkout_id).first()
            if payment is None or payment.status != Payment.Status.PENDING:
                return Response(ACK)  # unknown or already handled (Safaricom can repeat itself)
            order = Order.objects.select_for_update().get(pk=payment.order_id)

            if result_code == 0:
                try:
                    paid_amount = int(float(items.get("Amount") or 0))
                except (TypeError, ValueError):
                    paid_amount = -1
                if paid_amount != payment.amount_kes:
                    payment.status = Payment.Status.FAILED
                    payment.result_desc = f"Amount mismatch: expected {payment.amount_kes}, got {paid_amount}"
                    payment.save(update_fields=["status", "result_desc"])
                    logger.error("M-Pesa amount mismatch on %s: check by hand", order.order_number)
                    return Response(ACK)

                payment.status = Payment.Status.SUCCESS
                payment.mpesa_receipt = str(items.get("MpesaReceiptNumber", ""))[:30]
                payment.result_desc = description
                payment.save(update_fields=["status", "mpesa_receipt", "result_desc"])
                if order.can_move_to(S.PAID):
                    order.move_to(S.PAID)
                else:
                    logger.error(
                        "Payment %s succeeded but %s is '%s': REFUND NEEDED",
                        payment.mpesa_receipt, order.order_number, order.status,
                    )
            else:
                payment.status = Payment.Status.FAILED
                payment.result_desc = description
                payment.save(update_fields=["status", "result_desc"])
                if order.status == S.PLACED:
                    order.move_to(S.PAYMENT_FAILED)

        return Response(ACK)