import django_filters
from .models import Listing


class ListingFilter(django_filters.FilterSet):
    min_price = django_filters.NumberFilter(field_name='price_gnf', lookup_expr='gte')
    max_price = django_filters.NumberFilter(field_name='price_gnf', lookup_expr='lte')
    city      = django_filters.CharFilter(field_name='city', lookup_expr='icontains')
    quartier  = django_filters.CharFilter(field_name='quartier', lookup_expr='icontains')

    class Meta:
        model   = Listing
        fields  = ['category', 'condition', 'price_type', 'city', 'quartier', 'min_price', 'max_price']