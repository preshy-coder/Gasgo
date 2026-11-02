from django.conf import settings
from django.db import models, transaction

from accounts.models import phone_validator
from dealers.models import Dealer, Product


class Address(models.Model):
    """A customer's saved delivery location."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="addresses")
    label = models.CharField(max_length=60)
    lat = models.FloatField()
    lng = models.FloatField()
    formatted_address = models.CharField(max_length=255, blank=True)
    landmark_notes = models.CharField(max_length=255, blank=True)
    
    is_deleted = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.label} ({self.user})"


class Order(models.Model):
    class Type(models.TextChoices):
        DELIVERY = "delivery", "Delivery"
        PICKUP = "pickup", "Pickup"

    class Status(models.TextChoices):
        PLACED = "placed", "Awaiting payment"
        PAID = "paid", "Paid"
        ACCEPTED = "accepted", "Accepted by dealer"
        OUT_FOR_DELIVERY = "out_for_delivery", "Out for delivery"
        DELIVERED = "delivered", "Delivered"
        READY_FOR_PICKUP = "ready_for_pickup", "Ready for pickup"
        COLLECTED = "collected", "Collected"
        PAYMENT_FAILED = "payment_failed", "Payment failed"
        REJECTED_BY_DEALER = "rejected_by_dealer", "Rejected by dealer"
        CANCELLED = "cancelled", "Cancelled"
        REFUNDED = "refunded", "Refunded"

    TRANSITIONS = {
        Status.PLACED: {Status.PAID, Status.PAYMENT_FAILED, Status.CANCELLED},
        Status.PAYMENT_FAILED: {Status.PLACED, Status.CANCELLED},  
        Status.PAID: {Status.ACCEPTED, Status.REJECTED_BY_DEALER, Status.CANCELLED},
        Status.ACCEPTED: {Status.OUT_FOR_DELIVERY, Status.READY_FOR_PICKUP},
        Status.OUT_FOR_DELIVERY: {Status.DELIVERED},
        Status.READY_FOR_PICKUP: {Status.COLLECTED},
        Status.REJECTED_BY_DEALER: {Status.REFUNDED},
        Status.CANCELLED: {Status.REFUNDED},  
        Status.DELIVERED: set(),
        Status.COLLECTED: set(),
        Status.REFUNDED: set(),
    }

    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="orders")
    dealer = models.ForeignKey(Dealer, on_delete=models.PROTECT, related_name="orders")
    type = models.CharField(max_length=10, choices=Type.choices)
    address = models.ForeignKey(Address, on_delete=models.PROTECT, null=True, blank=True)  # empty for pickup
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLACED)
    reject_reason = models.CharField(max_length=255, blank=True)

    subtotal_kes = models.PositiveIntegerField()
    delivery_fee_kes = models.PositiveIntegerField(default=0)
    total_kes = models.PositiveIntegerField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.order_number} ({self.status})"

    @property
    def order_number(self):
        return f"GG-{self.pk:05d}"

    @property
    def mpesa_receipt(self):
        payment = self.payments.filter(status=Payment.Status.SUCCESS).order_by("-created_at").first()
        return payment.mpesa_receipt if payment else None

    def can_move_to(self, new_status):
        return new_status in self.TRANSITIONS.get(self.Status(self.status), set())

    @transaction.atomic
    def move_to(self, new_status):
        if not self.can_move_to(new_status):
            raise ValueError(f"Cannot move order from {self.status} to {new_status}")
        self.status = new_status
        self.save(update_fields=["status", "updated_at"])
        StatusChange.objects.create(order=self, status=new_status)


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.PositiveSmallIntegerField()
    unit_price_kes = models.PositiveIntegerField()  

    def __str__(self):
        return f"{self.quantity} x {self.product}"


class StatusChange(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="history")
    status = models.CharField(max_length=20, choices=Order.Status.choices)
    at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["at", "id"]


class Payment(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"

    order = models.ForeignKey(Order, on_delete=models.PROTECT, related_name="payments")
    phone = models.CharField(max_length=12, validators=[phone_validator])
    amount_kes = models.PositiveIntegerField()
    checkout_request_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    mpesa_receipt = models.CharField(max_length=30, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    result_desc = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Payment {self.mpesa_receipt or self.pk} ({self.status})"