from django.db import transaction
from django.db.models import F, Q, Value
from django.db.models.functions import Greatest
from rest_framework import generics
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from dealers.models import DealerStock

from .models import Address, Order
from .serializers import (
    AddressSerializer,
    DealerStatusSerializer,
    OrderSerializer,
    QuoteRequestSerializer,
    RejectSerializer,
)
from .services import OrderError, build_quote, create_order

S = Order.Status




class AddressListCreateView(generics.ListCreateAPIView):
    serializer_class = AddressSerializer
    pagination_class = None

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user, is_deleted=False).order_by("-id")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class AddressDetailView(generics.DestroyAPIView):
    def get_queryset(self):
        return Address.objects.filter(user=self.request.user, is_deleted=False)

    def perform_destroy(self, instance):
  
        instance.is_deleted = True
        instance.save(update_fields=["is_deleted"])



def _orders():
    return Order.objects.select_related("dealer", "address", "customer").prefetch_related(
        "items__product__brand", "history", "payments", "dealer__stock"
    )


def _respond(pk, status=200):
    return Response(OrderSerializer(_orders().get(pk=pk)).data, status=status)


def _parse_cart(request):
    serializer = QuoteRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    d = serializer.validated_data
    return d["type"], d["dealer_id"], d.get("address_id"), d["items"]


def _my_dealer(user):
    dealer = getattr(user, "dealer", None)
    if dealer is None:
        raise PermissionDenied("Vendors only.")
    return dealer


def _locked_dealer_order(user, pk):
    """Fetch (and lock) one of this vendor's orders. Call inside transaction.atomic."""
    order = Order.objects.select_for_update().filter(pk=pk, dealer=_my_dealer(user)).first()
    if order is None:
        raise NotFound("Order not found.")
    return order



class QuoteView(APIView):
    def post(self, request):
        quote = build_quote(request.user, *_parse_cart(request))
        return Response({k: quote[k] for k in ("subtotal_kes", "delivery_fee_kes", "total_kes")})


class OrderListCreateView(APIView):
    def get(self, request):
        orders = _orders().filter(customer=request.user)
        return Response(OrderSerializer(orders, many=True).data)

    def post(self, request):
        order = create_order(request.user, *_parse_cart(request))
        return _respond(order.pk, status=201)


class OrderDetailView(APIView):
    def get(self, request, pk):
        order = _orders().filter(pk=pk).filter(Q(customer=request.user) | Q(dealer__owner=request.user)).first()
        if order is None:
            raise NotFound("Order not found.")
        return Response(OrderSerializer(order).data)


class OrderCancelView(APIView):
    @transaction.atomic
    def post(self, request, pk):
        order = Order.objects.select_for_update().filter(pk=pk, customer=request.user).first()
        if order is None:
            raise NotFound("Order not found.")
        if order.status not in (S.PLACED, S.PAID, S.PAYMENT_FAILED):
            raise OrderError("This order can no longer be cancelled.", "cannot_cancel")
        order.cancellation_reason = "customer"
        order.save(update_fields=["cancellation_reason"])
        order.move_to(S.CANCELLED) 
        return _respond(pk)

class DealerOrderListView(APIView):
    def get(self, request):
        orders = _orders().filter(dealer=_my_dealer(request.user)).exclude(status__in=[S.PLACED, S.PAYMENT_FAILED])
        return Response(OrderSerializer(orders, many=True).data)


class DealerAcceptView(APIView):
    @transaction.atomic
    def post(self, request, pk):
        order = _locked_dealer_order(request.user, pk)
        if order.status != S.PAID:
            raise OrderError("Only paid orders can be accepted.", "invalid_status")
        order.move_to(S.ACCEPTED)
        for item in order.items.all():
            DealerStock.objects.filter(dealer=order.dealer, product=item.product).update(
                quantity=Greatest(F("quantity") - item.quantity, Value(0))
            )
        return _respond(pk)


class DealerRejectView(APIView):
    @transaction.atomic
    def post(self, request, pk):
        serializer = RejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = _locked_dealer_order(request.user, pk)
        if order.status != S.PAID:
            raise OrderError("Only paid orders can be rejected.", "invalid_status")
        order.reject_reason = serializer.validated_data["reason"]
        order.save(update_fields=["reject_reason"])
        order.move_to(S.REJECTED_BY_DEALER)  
        return _respond(pk)


class DealerStatusView(APIView):
    DEALER_MOVES = {S.OUT_FOR_DELIVERY, S.READY_FOR_PICKUP, S.DELIVERED, S.COLLECTED}

    @transaction.atomic
    def post(self, request, pk):
        serializer = DealerStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = S(serializer.validated_data["status"])
        order = _locked_dealer_order(request.user, pk)
        wrong_type = (new_status == S.OUT_FOR_DELIVERY and order.type != Order.Type.DELIVERY) or (
            new_status == S.READY_FOR_PICKUP and order.type != Order.Type.PICKUP
        )
        if new_status not in self.DEALER_MOVES or wrong_type or not order.can_move_to(new_status):
            raise OrderError(f'Can\'t move an order from "{order.status}" to "{new_status.value}".', "invalid_status")
        order.move_to(new_status)
        return _respond(pk)