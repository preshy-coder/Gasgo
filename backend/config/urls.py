from django.contrib import admin
from django.urls import path

urlpatterns = [
    path("admin/", admin.site.urls),
    # API routes get added here as endpoints are built (see docs/API.md)
]
