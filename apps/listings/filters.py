import django_filters
import math
from django.db.models import FloatField, ExpressionWrapper, F, Func, Value
from .models import Listing


class ListingFilter(django_filters.FilterSet):
    min_price  = django_filters.NumberFilter(field_name='price_gnf', lookup_expr='gte')
    max_price  = django_filters.NumberFilter(field_name='price_gnf', lookup_expr='lte')
    city       = django_filters.CharFilter(field_name='city', lookup_expr='icontains')
    quartier   = django_filters.CharFilter(field_name='quartier', lookup_expr='icontains')
    # Filtre géographique : near_lat, near_lng, radius_km
    near_lat   = django_filters.NumberFilter(method='noop')
    near_lng   = django_filters.NumberFilter(method='noop')
    radius_km  = django_filters.NumberFilter(method='noop')

    def noop(self, queryset, name, value):
        return queryset  # handled in view.filter_queryset

    class Meta:
        model   = Listing
        fields  = ['category', 'condition', 'price_type', 'city', 'quartier', 'min_price', 'max_price']