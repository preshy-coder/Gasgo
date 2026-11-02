from rest_framework import generics

from .models import Address
from .serializers import AddressSerializer


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