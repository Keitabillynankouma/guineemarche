from django.urls import path
from . import views

urlpatterns = [
    path('',                     views.ListingListCreateView.as_view(),    name='listing-list'),
    path('<uuid:pk>/',           views.ListingDetailView.as_view(),        name='listing-detail'),
    path('my/',                  views.MyListingsView.as_view(),           name='my-listings'),
    path('categories/',          views.CategoryListView.as_view(),         name='category-list'),
    path('categories/<uuid:pk>/attributes/', views.CategoryAttributeListView.as_view(), name='category-attributes'),
    path('banners/',             views.BannerListView.as_view(),           name='banner-list'),
    path('banners/<uuid:pk>/click/', views.BannerClickView.as_view(),     name='banner-click'),
    path('favorites/',           views.FavoriteListCreateView.as_view(),   name='favorites'),
    path('favorites/<uuid:pk>/', views.FavoriteDeleteView.as_view(),      name='favorite-delete'),
    path('report/',              views.ListingReportView.as_view(),        name='listing-report'),
]