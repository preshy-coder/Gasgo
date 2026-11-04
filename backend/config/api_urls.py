from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.views import MeView, OTPRequestView, OTPVerifyView
from dealers.views import (
    DealerListView,
    MyShopView,
    ProductListView,
    StockDetailView,
    StockListCreateView,
    VendorRegisterView,
)
from orders.views import (
    AddressDetailView,
    AddressListCreateView,
    DealerAcceptView,
    DealerOrderListView,
    DealerRejectView,
    DealerStatusView,
    OrderCancelView,
    OrderDetailView,
    OrderListCreateView,
    QuoteView,
)

urlpatterns = [
    path("auth/otp/request/", OTPRequestView.as_view()),
    path("auth/otp/verify/", OTPVerifyView.as_view()),
    path("auth/token/refresh/", TokenRefreshView.as_view()),
    path("me/", MeView.as_view()),
    path("products/", ProductListView.as_view()),
    path("dealers/", DealerListView.as_view()),
    path("vendors/register/", VendorRegisterView.as_view()),
    path("addresses/", AddressListCreateView.as_view()),
    path("addresses/<int:pk>/", AddressDetailView.as_view()),
    path("orders/quote/", QuoteView.as_view()),
    path("orders/", OrderListCreateView.as_view()),
    path("orders/<int:pk>/", OrderDetailView.as_view()),
    path("orders/<int:pk>/cancel/", OrderCancelView.as_view()),
    path("dealer/orders/", DealerOrderListView.as_view()),
    path("dealer/orders/<int:pk>/accept/", DealerAcceptView.as_view()),
    path("dealer/orders/<int:pk>/reject/", DealerRejectView.as_view()),
    path("dealer/orders/<int:pk>/status/", DealerStatusView.as_view()),
    path("dealer/shop/", MyShopView.as_view()),
    path("dealer/stock/", StockListCreateView.as_view()),
    path("dealer/stock/<int:pk>/", StockDetailView.as_view()),
    
]