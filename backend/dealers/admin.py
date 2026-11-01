from django.contrib import admin

from .models import Brand, Dealer, DealerStock, Product


class DealerStockInline(admin.TabularInline):
    model = DealerStock
    extra = 1


@admin.register(Dealer)
class DealerAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "is_open", "is_active", "delivery_radius_km")
    list_filter = ("is_open", "is_active")
    search_fields = ("name", "phone", "address")
    inlines = [DealerStockInline]


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("__str__", "is_active")
    list_filter = ("type", "is_active")


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ("name", "key")