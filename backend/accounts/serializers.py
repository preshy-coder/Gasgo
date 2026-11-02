from rest_framework import serializers

from .models import User
from .phone import normalize_phone


class UserSerializer(serializers.ModelSerializer):
    dealer_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "phone", "name", "role", "dealer_id"]
        read_only_fields = ["id", "phone", "role", "dealer_id"]

    def get_dealer_id(self, user):
        dealer = getattr(user, "dealer", None)
        return dealer.id if dealer else None


class OTPRequestSerializer(serializers.Serializer):
    phone = serializers.CharField()

    def validate_phone(self, value):
        phone = normalize_phone(value)
        if not phone:
            raise serializers.ValidationError("Enter a valid Kenyan phone number.")
        return phone


class OTPVerifySerializer(OTPRequestSerializer):
    code = serializers.RegexField(r"^\d{6}$", error_messages={"invalid": "Enter the 6-digit code."})