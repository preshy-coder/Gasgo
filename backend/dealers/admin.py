from django.contrib import admin

from .models import Brand, Dealer, DealerProduct


class DealerProductInline(admin.TabularInline):
    model = DealerProduct
    extra = 1


@admin.register(Dealer)
class DealerAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "is_active", "delivery_radius_km")
    list_filter = ("is_active",)
    search_fields = ("name", "phone")
    inlines = [DealerProductInline]


admin.site.register(Brand)
