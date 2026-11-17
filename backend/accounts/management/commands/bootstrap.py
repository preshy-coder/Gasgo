"""First-run setup for a fresh (empty) database. Safe to run on every deploy.

- Creates the admin account from ADMIN_PHONE + ADMIN_PASSWORD (if both are set
  and no such user exists yet).
- Adds the standard gas brands and products so vendors can pick from them.

Render's free plan has no shell, so this runs as part of the build.
"""
import os

from django.core.management.base import BaseCommand

from accounts.models import User
from accounts.phone import normalize_phone
from dealers.models import Brand, Product

BRANDS = ["K-Gas", "Total", "Afrigas", "ProGas", "Hashi"]
SIZES_KG = [6, 13]
TYPES = [Product.Type.REFILL, Product.Type.NEW_CYLINDER]


class Command(BaseCommand):
    help = "Create the admin user and the starter gas catalogue (idempotent)."

    def handle(self, *args, **options):
        self._admin()
        self._catalogue()

    def _admin(self):
        phone = os.getenv("ADMIN_PHONE", "").strip()
        password = os.getenv("ADMIN_PASSWORD", "")
        if not phone or not password:
            self.stdout.write("Admin: ADMIN_PHONE / ADMIN_PASSWORD not set, skipping.")
            return
        phone = normalize_phone(phone)
        if phone is None:
            self.stderr.write("Admin: ADMIN_PHONE is not a valid Kenyan number, skipping.")
            return
        user = User.objects.filter(phone=phone).first()
        if user is None:
            User.objects.create_superuser(phone=phone, password=password, name="Admin")
            self.stdout.write(f"Admin: created {phone}.")
        else:
            self.stdout.write(f"Admin: {phone} already exists, left unchanged.")

    def _catalogue(self):
        created = 0
        for name in BRANDS:
            brand = Brand.objects.filter(name__iexact=name).first() or Brand.objects.create(name=name)
            for size in SIZES_KG:
                for type_ in TYPES:
                    _, was_created = Product.objects.get_or_create(
                        brand=brand, size_kg=size, type=type_
                    )
                    created += was_created
        self.stdout.write(f"Catalogue: {created} new product(s) added.")
