import re

from django.conf import settings
from django.db import models

from accounts.models import phone_validator


def brand_key(name):
    """'K-Gas', 'kgas' and 'K Gas' all become 'kgas', so vendors can't create duplicates."""
    return re.sub(r"[\s\-_]+", "", name).lower()


class Brand(models.Model):
    name = models.CharField(max_length=60)
    key = models.CharField(max_length=60, unique=True, editable=False)

    def save(self, *args, **kwargs):
        self.name = self.name.strip()
        self.key = brand_key(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Product(models.Model):
    """A gas type in the catalogue: brand + size + refill or new cylinder."""

    class Type(models.TextChoices):
        REFILL = "refill", "Refill"
        NEW_CYLINDER = "new_cylinder", "New cylinder + gas"

    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name="products")
    size_kg = models.PositiveSmallIntegerField()
    type = models.CharField(max_length=20, choices=Type.choices)
    image_url = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("brand", "size_kg", "type")

    def __str__(self):
        return f"{self.brand} {self.size_kg}kg ({self.get_type_display()})"


class Dealer(models.Model):
    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="dealer"
    )
    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=12, validators=[phone_validator])
    address = models.CharField(max_length=255)
    landmark_notes = models.CharField(max_length=255, blank=True)
    lat = models.FloatField()
    lng = models.FloatField()
    opening_hours = models.CharField(max_length=120, blank=True)
    delivery_radius_km = models.PositiveSmallIntegerField(default=3)
    is_open = models.BooleanField(default=True, help_text="The vendor's own open/closed switch")
    is_active = models.BooleanField(default=True, help_text="Untick to hide a shop, e.g. unlicensed or suspended")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class DealerStock(models.Model):
    """One gas type a shop sells, with that shop's own price and quantity."""

    dealer = models.ForeignKey(Dealer, on_delete=models.CASCADE, related_name="stock")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="dealer_stock")
    quantity = models.PositiveIntegerField(default=0)
    price_kes = models.PositiveIntegerField()

    class Meta:
        unique_together = ("dealer", "product")

    def __str__(self):
        return f"{self.dealer} - {self.product}"