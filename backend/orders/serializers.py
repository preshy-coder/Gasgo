from rest_framework import serializers

from config.geo import OUTSIDE_AREA_MESSAGE, in_service_area
from dealers.serializers import DealerSerializer, ProductSerializer

from .models import Address, Order, OrderItem, StatusChange


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = ["id", "label", "lat", "lng", "formatted_address", "landmark_notes"]

    def validate(self, attrs):
        if not in_service_area(attrs["lat"], attrs["lng"]):
            raise serializers.ValidationError(OUTSIDE_AREA_MESSAGE)
        return attrs


class CartLineSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, max_value=20)


class QuoteRequestSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=Order.Type.choices)
    dealer_id = serializers.IntegerField()
    address_id = serializers.IntegerField(required=False, allow_null=True)
    items = CartLineSerializer(many=True)


class RejectSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=255, allow_blank=True, required=False, default="")


class DealerStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Order.Status.choices)


class StatusChangeSerializer(serializers.ModelSerializer):
    class Meta:
        model = StatusChange
        fields = ["status", "at"]


class OrderItemSerializer(serializers.ModelSerializer):
    product = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ["product", "quantity", "unit_price_kes"]

    def get_product(self, item):
        data = dict(ProductSerializer(item.product).data)
        data["price_kes"] = item.unit_price_kes 
        return data


class OrderSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    dealer = DealerSerializer(read_only=True)
    address = AddressSerializer(read_only=True)
    customer = serializers.SerializerMethodField()
    mpesa_receipt = serializers.CharField(read_only=True)
    status_history = StatusChangeSerializer(source="history", many=True, read_only=True)
    cancellation_reason = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id", "order_number", "type", "status", "items", "dealer", "address", "customer",
            "subtotal_kes", "delivery_fee_kes", "total_kes", "mpesa_receipt",
            "status_history", "cancellation_reason", "created_at",
        ]

    def get_customer(self, order):
        return {"name": order.customer.name, "phone": order.customer.phone}

    def get_cancellation_reason(self, order):
        return order.cancellation_reason or None