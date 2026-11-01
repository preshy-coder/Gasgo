from django.conf import settings
from django.db import models

from dealers.models import Dealer, DealerStock


class Order(models.Model):
    class Status(models.TextChoices):
        PLACED = "placed", "Placed"
        AWAITING_DEALER = "awaiting_dealer", "Awaiting dealer"
        ACCEPTED = "accepted", "Accepted by dealer"
        PAID = "paid", "Paid"
        OUT_FOR_DELIVERY = "out_for_delivery", "Out for delivery"
        DELIVERED = "delivered", "Delivered"
        # Side exits
        REJECTED = "rejected", "Rejected by dealer"
        EXPIRED = "expired", "Dealer did not respond"
        CANCELLED = "cancelled", "Cancelled"
        PAYMENT_FAILED = "payment_failed", "Payment failed"
        REFUNDED = "refunded", "Refunded"

    # Allowed moves. Enforce these in one place, never by editing status directly.
    TRANSITIONS = {
        Status.PLACED: {Status.AWAITING_DEALER, Status.CANCELLED},
        Status.AWAITING_DEALER: {Status.ACCEPTED, Status.REJECTED, Status.EXPIRED, Status.CANCELLED},
        Status.ACCEPTED: {Status.PAID, Status.PAYMENT_FAILED, Status.CANCELLED},
        Status.PAYMENT_FAILED: {Status.ACCEPTED, Status.CANCELLED},
        Status.PAID: {Status.OUT_FOR_DELIVERY, Status.REFUNDED},
        Status.OUT_FOR_DELIVERY: {Status.DELIVERED, Status.REFUNDED},
        Status.DELIVERED: set(),
        Status.REJECTED: set(),
        Status.EXPIRED: set(),
        Status.CANCELLED: set(),
        Status.REFUNDED: set(),
    }

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="orders"
    )
    dealer = models.ForeignKey(Dealer, on_delete=models.PROTECT, related_name="orders")
    product = models.ForeignKey(DealerStock, on_delete=models.PROTECT)

    customer_phone = models.CharField(max_length=15, help_text="Format 2547XXXXXXXX")
    latitude = models.FloatField()
    longitude = models.FloatField()
    address_note = models.CharField(
        max_length=255, blank=True, help_text="Estate, gate, house number, landmark"
    )

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLACED)
    gas_price = models.DecimalField(max_digits=8, decimal_places=2)
    delivery_fee = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=8, decimal_places=2)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Order #{self.pk} ({self.status})"

    def can_move_to(self, new_status):
        return new_status in self.TRANSITIONS.get(self.Status(self.status), set())

    def move_to(self, new_status):
        if not self.can_move_to(new_status):
            raise ValueError(f"Cannot move order from {self.status} to {new_status}")
        self.status = new_status
        self.save(update_fields=["status", "updated_at"])


class Payment(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"

    order = models.ForeignKey(Order, on_delete=models.PROTECT, related_name="payments")
    phone = models.CharField(max_length=15)
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    checkout_request_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    mpesa_receipt = models.CharField(max_length=30, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    result_desc = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Payment {self.mpesa_receipt or self.pk} ({self.status})"
