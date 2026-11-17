from django.conf import settings
from django.contrib import admin

from .models import Address, Order, OrderItem, Payment, StatusChange


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


class StatusChangeInline(admin.TabularInline):
    model = StatusChange
    extra = 0
    can_delete = False
    readonly_fields = ("status", "at")


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    readonly_fields = ("checkout_request_id", "mpesa_receipt", "status", "result_desc", "created_at")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_number", "status", "type", "dealer", "customer", "total_kes", "created_at")
    list_filter = ("status", "type", "dealer")
    search_fields = ("customer__phone", "dealer__name")
    readonly_fields = ("status",)  
    inlines = [OrderItemInline, PaymentInline, StatusChangeInline]
    actions = ["mark_paid", "mark_refunded"]

    def get_actions(self, request):
        actions = super().get_actions(request)
        # The testing shortcut only exists when ENABLE_TEST_TOOLS=True
        if not settings.ENABLE_TEST_TOOLS:
            actions.pop("mark_paid", None)
        return actions

    @admin.action(description="TESTING: mark selected orders as paid")
    def mark_paid(self, request, queryset):
        done = 0
        for order in queryset:
            if order.can_move_to(Order.Status.PAID):
                order.move_to(Order.Status.PAID)
                done += 1
        self.message_user(request, f"{done} order(s) marked paid.")

    @admin.action(description="Mark selected orders as refunded")
    def mark_refunded(self, request, queryset):
        done = 0
        for order in queryset:
            if order.can_move_to(Order.Status.REFUNDED):
                order.move_to(Order.Status.REFUNDED)
                done += 1
        self.message_user(request, f"{done} order(s) marked refunded.")


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "order", "amount_kes", "status", "mpesa_receipt", "created_at")
    list_filter = ("status",)
    search_fields = ("mpesa_receipt", "checkout_request_id", "phone")


admin.site.register(Address)
