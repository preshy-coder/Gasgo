from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.views import MeView, OTPRequestView, OTPVerifyView
from dealers.views import DealerListView, ProductListView, VendorRegisterView
from orders.views import AddressDetailView, AddressListCreateView

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
    # more routes are added here as we build each endpoint
]