from django.db import transaction
from django.db.models import Min, Prefetch
from rest_framework import generics
from rest_framework.exceptions import APIException, NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.serializers import UserSerializer
from config.geo import distance_km

from .models import Brand, Dealer, DealerStock, Product, brand_key
from .serializers import (
    DealerSerializer,
    NewStockSerializer,
    ProductSerializer,
    ShopUpdateSerializer,
    StockItemSerializer,
    StockUpdateSerializer,
    VendorSignupSerializer,
)


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

class StockError(APIException):
    status_code = 400

    def __init__(self, message, code):
        super().__init__(detail=message, code=code)


def my_dealer(user):
    dealer = getattr(user, "dealer", None)
    if dealer is None:
        raise PermissionDenied("Vendors only.")
    return dealer


class MyShopView(APIView):
    def get(self, request):
        return Response(DealerSerializer(my_dealer(request.user)).data)

    def patch(self, request):
        dealer = my_dealer(request.user)
        serializer = ShopUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dealer.is_open = serializer.validated_data["is_open"]
        dealer.save(update_fields=["is_open"])
        return Response(DealerSerializer(dealer).data)


class StockListCreateView(APIView):
    def get(self, request):
        stock = (
            DealerStock.objects.filter(dealer=my_dealer(request.user))
            .select_related("product__brand")
            .order_by("product__brand__name", "product__size_kg")
        )
        return Response(StockItemSerializer(stock, many=True).data)

    def post(self, request):
        dealer = my_dealer(request.user)
        serializer = NewStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            # "kgas", "K-Gas" and "K Gas" are the same brand.
            brand = Brand.objects.filter(key=brand_key(data["brand"])).first()
            if brand is None:
                brand = Brand.objects.create(name=data["brand"])
            product, _ = Product.objects.get_or_create(brand=brand, size_kg=data["size_kg"], type=data["type"])
            if DealerStock.objects.filter(dealer=dealer, product=product).exists():
                kind = "refill" if product.type == Product.Type.REFILL else "new cylinder"
                raise StockError(
                    f"{brand.name} {product.size_kg}kg {kind} is already in your stock. Update it below instead.",
                    "duplicate",
                )
            stock = DealerStock.objects.create(
                dealer=dealer, product=product, quantity=data["quantity"], price_kes=data["price_kes"]
            )
        return Response(StockItemSerializer(stock).data, status=201)


class StockDetailView(APIView):
    def _get_stock(self, request, pk):
        stock = (
            DealerStock.objects.select_related("product__brand")
            .filter(pk=pk, dealer=my_dealer(request.user))
            .first()
        )
        if stock is None:
            raise NotFound("Gas type not found.")
        return stock

    def patch(self, request, pk):
        stock = self._get_stock(request, pk)
        serializer = StockUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(stock, field, value)
        stock.save()
        return Response(StockItemSerializer(stock).data)

    def delete(self, request, pk):
        self._get_stock(request, pk).delete()
        return Response(status=204)