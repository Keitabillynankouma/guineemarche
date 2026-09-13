from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from core.permissions import IsAdmin

from .models import AffiliateProfile, AffiliateCommission, AffiliateWithdrawal
from .serializers import (
    AffiliateProfileSerializer,
    AffiliateCommissionSerializer,
    AffiliateWithdrawalSerializer,
    WithdrawalRequestSerializer,
    AffiliateRegisterSerializer,
)


# ─────────────────────────────────────────────────────────────────────────────
# Vues Affilié (espace personnel)
# ─────────────────────────────────────────────────────────────────────────────

class AffiliateRegisterView(APIView):
    """POST /api/v1/affiliates/register/ — S'inscrire comme affilié."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if hasattr(request.user, 'affiliate_profile'):
            return Response(
                {'detail': 'Vous êtes déjà inscrit comme affilié.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        s = AffiliateRegisterSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        profile = AffiliateProfile.objects.create(
            user=request.user,
            display_name=s.validated_data.get('display_name', ''),
            bio=s.validated_data.get('bio', ''),
            payout_phone=s.validated_data.get('payout_phone', ''),
            payout_provider=s.validated_data.get('payout_provider', ''),
            # Auto-approuver pour l'instant ; admin peut révoquer
            status=AffiliateProfile.Status.ACTIVE,
        )
        return Response(AffiliateProfileSerializer(profile).data, status=status.HTTP_201_CREATED)


class AffiliateMeView(APIView):
    """GET/PATCH /api/v1/affiliates/me/ — Profil affilié de l'utilisateur connecté."""
    permission_classes = [IsAuthenticated]

    def _get_profile(self, user):
        try:
            return user.affiliate_profile
        except AffiliateProfile.DoesNotExist:
            return None

    def get(self, request):
        profile = self._get_profile(request.user)
        if not profile:
            return Response({'detail': 'Vous n\'êtes pas encore affilié.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(AffiliateProfileSerializer(profile).data)

    def patch(self, request):
        profile = self._get_profile(request.user)
        if not profile:
            return Response({'detail': 'Vous n\'êtes pas encore affilié.'}, status=status.HTTP_404_NOT_FOUND)
        s = AffiliateProfileSerializer(profile, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)


class AffiliateCommissionsView(APIView):
    """GET /api/v1/affiliates/commissions/ — Historique des commissions."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            profile = request.user.affiliate_profile
        except AffiliateProfile.DoesNotExist:
            return Response({'detail': 'Vous n\'êtes pas encore affilié.'}, status=status.HTTP_404_NOT_FOUND)

        qs = profile.commissions.select_related('order__listing').order_by('-created_at')
        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        return Response(AffiliateCommissionSerializer(qs, many=True).data)


class AffiliateWithdrawView(APIView):
    """
    GET  /api/v1/affiliates/withdraw/ — Historique des retraits.
    POST /api/v1/affiliates/withdraw/ — Demander un retrait.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            profile = request.user.affiliate_profile
        except AffiliateProfile.DoesNotExist:
            return Response({'detail': 'Vous n\'êtes pas encore affilié.'}, status=status.HTTP_404_NOT_FOUND)
        qs = profile.withdrawals.order_by('-created_at')
        return Response(AffiliateWithdrawalSerializer(qs, many=True).data)

    def post(self, request):
        try:
            profile = request.user.affiliate_profile
        except AffiliateProfile.DoesNotExist:
            return Response({'detail': 'Vous n\'êtes pas encore affilié.'}, status=status.HTTP_404_NOT_FOUND)

        if not profile.is_active:
            return Response({'detail': 'Votre compte affilié n\'est pas actif.'}, status=status.HTTP_403_FORBIDDEN)

        s = WithdrawalRequestSerializer(data=request.data, context={'affiliate': profile})
        s.is_valid(raise_exception=True)

        with transaction.atomic():
            # Vérouiller et déduire le solde immédiatement
            locked_profile = AffiliateProfile.objects.select_for_update().get(pk=profile.pk)
            amount = s.validated_data['amount_gnf']
            if amount > locked_profile.balance_gnf:
                return Response({'detail': 'Solde insuffisant.'}, status=status.HTTP_400_BAD_REQUEST)
            locked_profile.debit(amount)

            withdrawal = AffiliateWithdrawal.objects.create(
                affiliate=locked_profile,
                amount_gnf=amount,
                payout_phone=s.validated_data['payout_phone'],
                payout_provider=s.validated_data['payout_provider'],
            )

        return Response(AffiliateWithdrawalSerializer(withdrawal).data, status=status.HTTP_201_CREATED)


# ─────────────────────────────────────────────────────────────────────────────
# Vues Admin
# ─────────────────────────────────────────────────────────────────────────────

class AdminAffiliateListView(APIView):
    """GET /api/v1/affiliates/admin/list/ — Liste tous les affiliés."""
    permission_classes = [IsAdmin]

    def get(self, request):
        qs = AffiliateProfile.objects.select_related('user').order_by('-total_earned_gnf')
        s_filter = request.query_params.get('status')
        if s_filter:
            qs = qs.filter(status=s_filter)
        return Response(AffiliateProfileSerializer(qs, many=True).data)


class AdminAffiliateDetailView(APIView):
    """
    GET   /api/v1/affiliates/admin/<pk>/
    PATCH /api/v1/affiliates/admin/<pk>/ — Modifier statut, note admin
    """
    permission_classes = [IsAdmin]

    def _get(self, pk):
        try:
            return AffiliateProfile.objects.select_related('user').get(pk=pk)
        except AffiliateProfile.DoesNotExist:
            return None

    def get(self, request, pk):
        p = self._get(pk)
        if not p:
            return Response({'detail': 'Non trouvé.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(AffiliateProfileSerializer(p).data)

    def patch(self, request, pk):
        p = self._get(pk)
        if not p:
            return Response({'detail': 'Non trouvé.'}, status=status.HTTP_404_NOT_FOUND)
        allowed = {'status', 'admin_note', 'display_name', 'bio'}
        data = {k: v for k, v in request.data.items() if k in allowed}
        for k, v in data.items():
            setattr(p, k, v)
        p.save(update_fields=list(data.keys()) + ['updated_at'])
        return Response(AffiliateProfileSerializer(p).data)


class AdminWithdrawalListView(APIView):
    """GET /api/v1/affiliates/admin/withdrawals/ — Liste toutes les demandes de retrait."""
    permission_classes = [IsAdmin]

    def get(self, request):
        qs = AffiliateWithdrawal.objects.select_related('affiliate__user').order_by('-created_at')
        s_filter = request.query_params.get('status', 'pending')
        if s_filter:
            qs = qs.filter(status=s_filter)
        return Response(AffiliateWithdrawalSerializer(qs, many=True).data)


class AdminWithdrawalActionView(APIView):
    """POST /api/v1/affiliates/admin/withdrawals/<pk>/pay/ — Marquer comme versé."""
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        try:
            w = AffiliateWithdrawal.objects.select_related('affiliate').get(pk=pk)
        except AffiliateWithdrawal.DoesNotExist:
            return Response({'detail': 'Non trouvé.'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action', 'pay')
        ref    = request.data.get('ref', '')
        note   = request.data.get('note', '')

        if action == 'pay':
            if w.status != AffiliateWithdrawal.Status.PENDING:
                return Response({'detail': 'Ce retrait n\'est plus en attente.'}, status=status.HTTP_400_BAD_REQUEST)
            w.approve_and_pay(ref=ref, note=note)
        elif action == 'reject':
            if w.status != AffiliateWithdrawal.Status.PENDING:
                return Response({'detail': 'Ce retrait n\'est plus en attente.'}, status=status.HTTP_400_BAD_REQUEST)
            w.reject(note=note)
        else:
            return Response({'detail': 'Action invalide (pay ou reject).'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(AffiliateWithdrawalSerializer(w).data)
