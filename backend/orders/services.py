import math

from django.db import transaction
from rest_framework.exceptions import APIException, NotFound

from config.geo import distance_km
from dealers.models import Dealer, DealerStock, Product

from .models import Address, Order, OrderItem, StatusChange


class OrderError(APIException):
    status_code = 400

    def __init__(self, message, code):
        super().__init__(detail=message, code=code)


def delivery_fee(km):
    """KES 150 for the first 3 km, then KES 30 for each extra km (rounded up)."""
    return 150 + max(0, math.ceil(km - 3)) * 30


def build_quote(user, order_type, dealer_id, address_id, lines):
    """Work out prices from the SHOP's own prices. The app only sends product ids and quantities."""
    dealer = Dealer.objects.filter(pk=dealer_id, is_active=True).first()
    if dealer is None:
        raise NotFound("Dealer not found.")
    if not dealer.is_open:
        raise OrderError(f"{dealer.name} is closed right now.", "dealer_closed")
    if not lines:
        raise OrderError("Your cart is empty.", "empty_cart")

    items = []
    subtotal = 0
    for line in lines:
        stock = (
            DealerStock.objects.select_related("product__brand")
            .filter(dealer=dealer, product_id=line["product_id"], product__is_active=True)
            .first()
        )
        if stock is None or stock.quantity < line["quantity"]:
            product = Product.objects.select_related("brand").filter(pk=line["product_id"]).first()
            if product is None:
                raise NotFound("Product not found.")
            raise OrderError(
                f"{dealer.name} doesn't have enough {product.brand.name} {product.size_kg}kg in stock.",
                "out_of_stock",
            )
        items.append((stock.product, line["quantity"], stock.price_kes))
        subtotal += stock.price_kes * line["quantity"]

    address = None
    fee = 0
    if order_type == Order.Type.DELIVERY:
        if address_id:
            address = Address.objects.filter(pk=address_id, user=user, is_deleted=False).first()
        if address is None:
            raise OrderError("Choose a delivery location.", "address_required")
        km = distance_km(address.lat, address.lng, dealer.lat, dealer.lng)
        if km > dealer.delivery_radius_km:
            raise OrderError(f"{dealer.name} doesn't deliver that far ({km:.1f} km).", "out_of_range")
        fee = delivery_fee(km)

    return {
        "dealer": dealer,
        "address": address,
        "items": items,
        "subtotal_kes": subtotal,
        "delivery_fee_kes": fee,
        "total_kes": subtotal + fee,
    }


@transaction.atomic
def create_order(user, order_type, dealer_id, address_id, lines):
    quote = build_quote(user, order_type, dealer_id, address_id, lines)
    order = Order.objects.create(
        customer=user,
        dealer=quote["dealer"],
        type=order_type,
        address=quote["address"],
        subtotal_kes=quote["subtotal_kes"],
        delivery_fee_kes=quote["delivery_fee_kes"],
        total_kes=quote["total_kes"],
    )
    OrderItem.objects.bulk_create(
        [
            OrderItem(order=order, product=product, quantity=qty, unit_price_kes=price)
            for product, qty, price in quote["items"]
        ]
    )
    StatusChange.objects.create(order=order, status=Order.Status.PLACED)
    return order