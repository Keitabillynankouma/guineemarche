from django.urls import path
from . import views

urlpatterns = [
    path('',                          views.ListingListCreateView.as_view(),  name='listing-list'),
    path('<uuid:pk>/',                views.ListingDetailView.as_view(),      name='listing-detail'),
    path('<uuid:pk>/boost/',          views.BoostListingView.as_view(),       name='listing-boost'),
    path('<uuid:pk>/favorite/',       views.FavoriteToggleView.as_view(),     name='listing-favorite-toggle'),
    path('my/',                       views.MyListingsView.as_view(),         name='my-listings'),
    path('my/stats/',                 views.MySellerStatsView.as_view(),      name='my-seller-stats'),
    path('categories/',          views.CategoryListView.as_view(),         name='category-list'),
    path('categories/<uuid:pk>/attributes/', views.CategoryAttributeListView.as_view(), name='category-attributes'),
    path('banners/',             views.BannerListView.as_view(),           name='banner-list'),
    path('banners/<uuid:pk>/click/', views.BannerClickView.as_view(),     name='banner-click'),
    path('favorites/',           views.FavoriteListCreateView.as_view(),   name='favorites'),
    path('favorites/<uuid:pk>/', views.FavoriteDeleteView.as_view(),      name='favorite-delete'),
    path('report/',              views.ListingReportView.as_view(),        name='listing-report'),

    # Admin
    path('admin/listings/',                      views.AdminListingListView.as_view(),    name='admin-listing-list'),
    path('admin/listings/<uuid:pk>/',            views.AdminListingDetailView.as_view(),  name='admin-listing-detail'),
    path('admin/listings/<uuid:pk>/approve/',    views.AdminListingApproveView.as_view(), name='admin-listing-approve'),
    path('admin/listings/<uuid:pk>/reject/',     views.AdminListingRejectView.as_view(),  name='admin-listing-reject'),
    path('admin/banners/',            views.AdminBannerListCreateView.as_view(), name='admin-banner-list'),
    path('admin/banners/<uuid:pk>/',  views.AdminBannerDetailView.as_view(),   name='admin-banner-detail'),
    path('admin/categories/',         views.AdminCategoryListCreateView.as_view(), name='admin-category-list'),
    path('admin/categories/<uuid:pk>/', views.AdminCategoryDetailView.as_view(), name='admin-category-detail'),
]