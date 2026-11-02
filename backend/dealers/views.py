from django.db import transaction
from django.db.models import Min, Prefetch
from rest_framework import generics
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.serializers import UserSerializer
from config.geo import distance_km

from .models import Dealer, DealerStock, Product
from .serializers import DealerSerializer, ProductSerializer, VendorSignupSerializer


class AlreadyVendor(APIException):
    status_code = 409
    default_code = "already_vendor"
    default_detail = "This account already has a shop."


class ProductListView(generics.ListAPIView):
    """Gas types that at least one open shop has in stock, with the lowest shop price."""

    serializer_class = ProductSerializer
    pagination_class = None

    def get_queryset(self):
        return (
            Product.objects.filter(
                is_active=True,
                dealer_stock__quantity__gt=0,
                dealer_stock__dealer__is_open=True,
                dealer_stock__dealer__is_active=True,
            )
            .annotate(price_kes=Min("dealer_stock__price_kes"))
            .select_related("brand")
            .order_by("brand__name", "size_kg")
        )


def _read_float(request, name):
    raw = request.query_params.get(name)
    if raw is None:
        return None
    try:
        return float(raw)
    except ValueError:
        raise ValidationError({name: "Must be a number."})


class DealerListView(generics.ListAPIView):
    serializer_class = DealerSerializer
    pagination_class = None

    def list(self, request, *args, **kwargs):
        dealers = list(
            Dealer.objects.filter(is_active=True).prefetch_related(
                Prefetch("stock", queryset=DealerStock.objects.filter(product__is_active=True))
            )
        )
        lat, lng = _read_float(request, "lat"), _read_float(request, "lng")
        if lat is not None and lng is not None:
            for dealer in dealers:
                dealer.distance_km = round(distance_km(lat, lng, dealer.lat, dealer.lng), 2)
            dealers.sort(key=lambda dealer: dealer.distance_km)
        return Response(self.get_serializer(dealers, many=True).data)


class VendorRegisterView(APIView):
    def post(self, request):
        user = request.user
        if hasattr(user, "dealer"):
            raise AlreadyVendor()

        serializer = VendorSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            dealer = Dealer.objects.create(
                owner=user,
                name=data["shop_name"],
                phone=user.phone,
                address=data["address"],
                landmark_notes=data["landmark_notes"],
                lat=data["lat"],
                lng=data["lng"],
                opening_hours=data["opening_hours"],
                delivery_radius_km=data["delivery_radius_km"],
            )
            user.role = User.Role.DEALER
            user.save(update_fields=["role"])

        return Response(
            {"user": UserSerializer(user).data, "dealer": DealerSerializer(dealer).data},
            status=201,
        )