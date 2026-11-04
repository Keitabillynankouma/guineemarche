from django.contrib import admin
from .models import (
    Order, PickupPoint, MeetingZone, DeliveryZone,
    Payment, DeliveryAssignment, SellerPayout,
    LivreurPayment, LivreurWeeklyPayout, LivreurFine,
)


@admin.register(PickupPoint)
class PickupPointAdmin(admin.ModelAdmin):
    list_display   = ('name', 'city', 'commune', 'address', 'phone', 'is_active')
    list_filter    = ('city', 'is_active')
    search_fields  = ('name', 'address', 'city', 'commune')
    list_editable  = ('is_active',)
    ordering       = ('city', 'name')
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(MeetingZone)
class MeetingZoneAdmin(admin.ModelAdmin):
    list_display   = ('name', 'city', 'address', 'is_active')
    list_filter    = ('city', 'is_active')
    search_fields  = ('name', 'city', 'address')
    list_editable  = ('is_active',)
    ordering       = ('city', 'name')
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(DeliveryZone)
class DeliveryZoneAdmin(admin.ModelAdmin):
    list_display   = ('city', 'fee_gnf', 'estimated_days', 'is_active')
    list_filter    = ('is_active',)
    search_fields  = ('city',)
    list_editable  = ('fee_gnf', 'estimated_days', 'is_active')
    ordering       = ('city',)
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display   = (
        'short_id', 'listing_title', 'seller_info', 'adresse_collecte',
        'status_badge', 'pickup_point_name', 'article_amount_fmt',
        'escrow_status', 'created_at',
    )
    list_filter    = ('status', 'escrow_status', 'delivery_mode')
    search_fields  = (
        'buyer__full_name', 'buyer__phone_number',
        'seller__full_name', 'seller__phone_number',
        'listing__title', 'listing__pickup_address',
        'pickup_point__name',
    )
    readonly_fields = ('id', 'created_at', 'updated_at', 'adresse_collecte_detail')
    ordering       = ('-created_at',)
    actions        = ['confirm_orders', 'marquer_collecte', 'marquer_au_pdr', 'cancel_orders']

    fieldsets = (
        ('Commande', {
            'fields': ('id', 'status', 'listing', 'buyer', 'seller', 'created_at', 'updated_at'),
        }),
        ('🚚 Collecte & Dépôt PDR', {
            'fields': ('adresse_collecte_detail', 'pickup_point', 'delivery_mode'),
            'classes': ('wide',),
            'description': 'Adresse de collecte chez le vendeur → Point de retrait acheteur',
        }),
        ('💰 Paiement & Escrow', {
            'fields': (
                'amount_gnf', 'article_amount_gnf', 'delivery_fee_gnf', 'buyer_service_fee_gnf',
                'commitment_amount_gnf', 'commission_gnf', 'seller_payout_gnf',
                'escrow_status', 'article_paid',
            ),
        }),
    )

    # ── Colonnes personnalisées ───────────────────────────────────────────────

    @admin.display(description='ID')
    def short_id(self, obj):
        return str(obj.id)[:8] + '…'

    @admin.display(description='Article')
    def listing_title(self, obj):
        return obj.listing.title if obj.listing else '—'

    @admin.display(description='Vendeur / Tél')
    def seller_info(self, obj):
        return f"{obj.seller.full_name} · {obj.seller.phone_number}"

    @admin.display(description='📍 Adresse collecte')
    def adresse_collecte(self, obj):
        try:
            addr = obj.listing.pickup_address
            return addr[:60] + '…' if addr and len(addr) > 60 else (addr or '⚠️ Non renseignée')
        except Exception:
            return '—'

    @admin.display(description='📍 Adresse collecte (complète)')
    def adresse_collecte_detail(self, obj):
        try:
            addr = obj.listing.pickup_address
            phone = obj.seller.phone_number
            return f"{addr or '⚠️ Non renseignée'}  —  Tél vendeur : {phone}"
        except Exception:
            return '—'

    @admin.display(description='Point de retrait')
    def pickup_point_name(self, obj):
        return obj.pickup_point.name if obj.pickup_point else '—'

    @admin.display(description='Statut')
    def status_badge(self, obj):
        ICONS = {
            'pending':          '⏳ En attente',
            'confirmed':        '✅ Confirmée',
            'pickup_confirmed': '🚚 Collecté',
            'au_point_retrait': '📦 Au PDR',
            'en_essai':         '🔍 En essai',
            'completed':        '🏁 Terminée',
            'cancelled':        '❌ Annulée',
            'disputed':         '⚖️ Litige',
            'retourne':         '↩️ Retourné',
        }
        return ICONS.get(obj.status, obj.status)

    @admin.display(description='Prix article')
    def article_amount_fmt(self, obj):
        amt = obj.article_amount_gnf or 0
        return f"{amt:,} GNF"

    # ── Actions ───────────────────────────────────────────────────────────────

    @admin.action(description='✅ Confirmer les commandes sélectionnées')
    def confirm_orders(self, request, queryset):
        ok = 0
        for order in queryset.filter(status='pending'):
            order.confirm()
            ok += 1
        self.message_user(request, f'{ok} commande(s) confirmée(s).')

    @admin.action(description='🚚 Marquer comme collecté chez le vendeur')
    def marquer_collecte(self, request, queryset):
        from django.utils import timezone
        ok = 0
        for order in queryset.filter(status='confirmed'):
            order.status = 'pickup_confirmed'
            order.save(update_fields=['status', 'updated_at'])
            ok += 1
        self.message_user(request, f'{ok} commande(s) marquée(s) comme collectée(s) chez le vendeur.')

    @admin.action(description='📦 Marquer comme déposé au point de retrait')
    def marquer_au_pdr(self, request, queryset):
        ok = 0
        for order in queryset.filter(status='pickup_confirmed'):
            order.status = 'au_point_retrait'
            order.save(update_fields=['status', 'updated_at'])
            ok += 1
        self.message_user(request, f'{ok} commande(s) marquée(s) comme déposée(s) au point de retrait.')

    @admin.action(description='❌ Annuler les commandes sélectionnées')
    def cancel_orders(self, request, queryset):
        ok = 0
        for order in queryset.filter(status__in=['pending', 'confirmed']):
            order.cancel()
            ok += 1
        self.message_user(request, f'{ok} commande(s) annulée(s).')


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display   = ('id', 'order', 'provider', 'phone_number', 'amount_gnf', 'status', 'created_at')
    list_filter    = ('provider', 'status')
    search_fields  = ('phone_number', 'external_ref', 'order__buyer__full_name')
    readonly_fields = ('id', 'created_at', 'updated_at')
    ordering       = ('-created_at',)


@admin.register(DeliveryAssignment)
class DeliveryAssignmentAdmin(admin.ModelAdmin):
    list_display   = ('order', 'livreur', 'status', 'pickup_code', 'verification_code', 'assigned_at', 'delivered_at')
    list_filter    = ('status',)
    search_fields  = ('livreur__full_name', 'livreur__phone_number', 'order__buyer__full_name', 'verification_code', 'pickup_code')
    readonly_fields = ('id', 'pickup_code', 'verification_code', 'assigned_at', 'created_at', 'updated_at')
    ordering       = ('-assigned_at',)
    actions        = ['mark_delivered']

    @admin.action(description='✅ Marquer comme livrées')
    def mark_delivered(self, request, queryset):
        from django.utils import timezone
        queryset.update(status='delivered', delivered_at=timezone.now())
        self.message_user(request, 'Livraisons marquées comme livrées.')


@admin.register(SellerPayout)
class SellerPayoutAdmin(admin.ModelAdmin):
    list_display   = ('seller_name', 'amount_gnf_fmt', 'provider', 'payout_phone', 'status', 'processed_at', 'created_at')
    list_filter    = ('status', 'provider')
    search_fields  = ('seller__full_name', 'seller__phone_number', 'payout_phone', 'external_ref')
    readonly_fields = ('id', 'order', 'seller', 'amount_gnf', 'created_at', 'updated_at', 'processed_at', 'external_ref')
    ordering       = ('-created_at',)
    actions        = ['trigger_payout', 'mark_paid_manually']

    @admin.display(description='Vendeur')
    def seller_name(self, obj):
        return obj.seller.full_name

    @admin.display(description='Montant (GNF)')
    def amount_gnf_fmt(self, obj):
        return f"{obj.amount_gnf:,} GNF"

    @admin.action(description='💸 Déclencher le virement automatique')
    def trigger_payout(self, request, queryset):
        from apps.orders.payment_service import disburse_to_seller
        ok = err = 0
        for payout in queryset.filter(status__in=['pending', 'failed']):
            result = disburse_to_seller(str(payout.id))
            if result.success:
                ok += 1
            else:
                err += 1
        self.message_user(request, f'{ok} virement(s) lancé(s), {err} échec(s).')

    @admin.action(description='✅ Marquer comme versé manuellement')
    def mark_paid_manually(self, request, queryset):
        for payout in queryset.filter(status__in=['pending', 'processing', 'failed']):
            payout.mark_completed(note='Versement manuel validé par admin')
        self.message_user(request, 'Virements marqués comme versés.')


@admin.register(LivreurPayment)
class LivreurPaymentAdmin(admin.ModelAdmin):
    list_display  = ('livreur_name', 'gross_gnf_fmt', 'net_gnf_fmt', 'status', 'paid_at', 'created_at')
    list_filter   = ('status',)
    search_fields = ('livreur__full_name', 'livreur__phone_number', 'payment_ref')
    readonly_fields = ('id', 'assignment', 'livreur', 'gross_gnf', 'platform_cut_gnf', 'net_gnf', 'created_at', 'updated_at')
    ordering      = ('-created_at',)

    @admin.display(description='Livreur')
    def livreur_name(self, obj): return obj.livreur.full_name

    @admin.display(description='Brut')
    def gross_gnf_fmt(self, obj): return f"{obj.gross_gnf:,} GNF"

    @admin.display(description='Net livreur')
    def net_gnf_fmt(self, obj): return f"{obj.net_gnf:,} GNF"


@admin.register(LivreurWeeklyPayout)
class LivreurWeeklyPayoutAdmin(admin.ModelAdmin):
    list_display  = ('livreur_name', 'week_start', 'deliveries_count', 'gross_gnf_fmt', 'fines_gnf_fmt', 'net_gnf_fmt', 'livreur_phone', 'status', 'paid_at')
    list_filter   = ('status',)
    search_fields = ('livreur__full_name', 'livreur__phone_number', 'payment_ref')
    readonly_fields = ('id', 'livreur', 'week_start', 'week_end', 'deliveries_count', 'gross_gnf', 'fines_gnf', 'net_gnf', 'created_at', 'updated_at')
    ordering      = ('-week_start',)
    actions       = ['trigger_auto_disburse', 'mark_paid_manual']

    @admin.display(description='Livreur')
    def livreur_name(self, obj): return obj.livreur.full_name

    @admin.display(description='📱 Mobile money')
    def livreur_phone(self, obj):
        if obj.livreur.payout_phone:
            icon = '🟠' if obj.livreur.payout_provider == 'orange_money' else '🟡'
            return f"{icon} {obj.livreur.payout_phone}"
        return '⚠️ Non configuré'

    @admin.display(description='Brut')
    def gross_gnf_fmt(self, obj): return f"{obj.gross_gnf:,} GNF"

    @admin.display(description='Amendes')
    def fines_gnf_fmt(self, obj): return f"-{obj.fines_gnf:,} GNF" if obj.fines_gnf else '—'

    @admin.display(description='Net à verser')
    def net_gnf_fmt(self, obj): return f"{obj.net_gnf:,} GNF"

    @admin.action(description='💸 Déclencher le virement automatique (ChaChaP B2C)')
    def trigger_auto_disburse(self, request, queryset):
        from apps.orders.payment_service import disburse_to_livreur
        ok = err = skip = 0
        for payout in queryset.filter(status='pending'):
            if not payout.livreur.has_payout_info:
                skip += 1
                continue
            result = disburse_to_livreur(str(payout.id))
            if result.success: ok += 1
            else:              err += 1
        self.message_user(request, f'{ok} virement(s) lancé(s), {err} échec(s), {skip} sans numéro mobile money.')

    @admin.action(description='✅ Marquer comme versé manuellement')
    def mark_paid_manual(self, request, queryset):
        from django.utils import timezone
        count = queryset.filter(status='pending').update(
            status='paid', paid_at=timezone.now(),
            payment_method='manual', note='Versement manuel admin',
        )
        self.message_user(request, f'{count} virement(s) marqué(s) comme versé(s).')


@admin.register(LivreurFine)
class LivreurFineAdmin(admin.ModelAdmin):
    list_display  = ('livreur_name', 'reason_display', 'amount_gnf_fmt', 'status', 'created_at')
    list_filter   = ('status', 'reason')
    search_fields = ('livreur__full_name', 'livreur__phone_number')
    readonly_fields = ('id', 'livreur', 'created_at', 'updated_at')
    ordering      = ('-created_at',)

    @admin.display(description='Livreur')
    def livreur_name(self, obj): return obj.livreur.full_name

    @admin.display(description='Raison')
    def reason_display(self, obj): return obj.get_reason_display()

    @admin.display(description='Montant')
    def amount_gnf_fmt(self, obj): return f"{obj.amount_gnf:,} GNF"
