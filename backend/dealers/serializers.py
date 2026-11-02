from rest_framework import serializers

from config.geo import OUTSIDE_AREA_MESSAGE, in_service_area

from .models import Dealer, DealerStock, Product


class ProductSerializer(serializers.ModelSerializer):
    brand = serializers.CharField(source="brand.name")
    price_kes = serializers.IntegerField(read_only=True)  
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ["id", "brand", "size_kg", "type", "price_kes", "image_url", "is_active"]

    def get_image_url(self, product):
        return product.image_url or None


class DealerStockSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = DealerStock
        fields = ["product_id", "quantity", "price_kes"]


class DealerSerializer(serializers.ModelSerializer):
    stock = DealerStockSerializer(many=True, read_only=True)
    distance_km = serializers.FloatField(read_only=True) 

    class Meta:
        model = Dealer
        fields = [
            "id", "name", "phone", "lat", "lng", "address", "opening_hours",
            "delivery_radius_km", "is_open", "stock", "distance_km",
        ]


class VendorSignupSerializer(serializers.Serializer):
    shop_name = serializers.CharField(max_length=120)
    address = serializers.CharField(max_length=255)
    landmark_notes = serializers.CharField(max_length=255, allow_blank=True, required=False, default="")
    lat = serializers.FloatField()
    lng = serializers.FloatField()
    opening_hours = serializers.CharField(max_length=120, allow_blank=True, required=False, default="")
    delivery_radius_km = serializers.IntegerField(min_value=1, max_value=20)

    def validate(self, attrs):
        if not in_service_area(attrs["lat"], attrs["lng"]):
            raise serializers.ValidationError(OUTSIDE_AREA_MESSAGE)
        return attrs