from django.contrib import admin

from .models import Order, Payment


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    readonly_fields = ("checkout_request_id", "mpesa_receipt", "status", "result_desc", "created_at")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "status", "dealer", "customer_phone", "total", "created_at")
    list_filter = ("status", "dealer")
    search_fields = ("customer_phone", "address_note")
    inlines = [PaymentInline]


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "order", "amount", "status", "mpesa_receipt", "created_at")
    list_filter = ("status",)
    search_fields = ("mpesa_receipt", "checkout_request_id", "phone")
