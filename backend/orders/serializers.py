from rest_framework import serializers

from config.geo import OUTSIDE_AREA_MESSAGE, in_service_area

from .models import Address


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = ["id", "label", "lat", "lng", "formatted_address", "landmark_notes"]

    def validate(self, attrs):
        if not in_service_area(attrs["lat"], attrs["lng"]):
            raise serializers.ValidationError(OUTSIDE_AREA_MESSAGE)
        return attrs