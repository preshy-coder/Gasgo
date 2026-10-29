from django.conf import settings
from django.db import models


class Brand(models.Model):
    """Gas brand, e.g. Total, K-Gas, Afrigas. Cylinders are brand-owned, so swaps are brand-for-brand."""

    name = models.CharField(max_length=60, unique=True)

    def __str__(self):
        return self.name


class Dealer(models.Model):
    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="dealer"
    )
    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=15, help_text="Format 2547XXXXXXXX")
    latitude = models.FloatField()
    longitude = models.FloatField()
    delivery_radius_km = models.PositiveSmallIntegerField(default=3)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class DealerProduct(models.Model):
    """What a dealer sells and at what price."""

    SIZES = [(6, "6 kg"), (13, "13 kg"), (22, "22 kg"), (50, "50 kg")]

    dealer = models.ForeignKey(Dealer, on_delete=models.CASCADE, related_name="products")
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT)
    size_kg = models.PositiveSmallIntegerField(choices=SIZES)
    refill_price = models.DecimalField(max_digits=8, decimal_places=2)
    in_stock = models.BooleanField(default=True)

    class Meta:
        unique_together = ("dealer", "brand", "size_kg")

    def __str__(self):
        return f"{self.dealer} - {self.brand} {self.size_kg}kg"
