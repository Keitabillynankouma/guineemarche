# GUIMATRIX — Rôles utilisateurs & Flux fonctionnels

> Document interne — Mise à jour : octobre 2026

---

## 1. Les rôles utilisateurs

L'application Guimatrix distingue deux catégories de rôles : les rôles utilisateurs ordinaires (acheteur, vendeur, livreur) et les rôles d'administration avec des accès restreints selon les responsabilités.

---

### 1.1 Acheteur (`buyer`)

**Valeur par défaut :** Oui — tout compte créé est `buyer` par défaut  
**Accès admin :** Aucun

Le compte doit être vérifié (`is_verified = true`) avant de pouvoir passer une commande.

L'acheteur peut :
- Parcourir les annonces sans être connecté
- Passer une commande et payer (Orange Money, MTN MoMo, PayCard…)
- Suivre sa commande en temps réel
- Confirmer la réception de l'article
- Ouvrir un litige en cas de problème
- Parrainer d'autres utilisateurs avec son code de parrainage unique (8 caractères) et gagner des commissions affilié

---

### 1.2 Vendeur (`seller`)

**Accès admin :** Aucun

Le vendeur peut :
- Créer des annonces (soumises à approbation avant d'être visibles publiquement)
- Consulter et gérer ses commandes reçues
- Confirmer qu'il a l'article prêt pour la livraison ou remise
- Configurer son compte Mobile Money (Orange Money, MTN MoMo, PayCard, Kulu, Soutra Money, Akiba) pour recevoir ses paiements
- Recevoir une **avance de 70%** du montant dès la collecte par le livreur (capital de roulement)
- Recevoir le **solde de 30%** à la confirmation de réception par l'acheteur

---

### 1.3 Livreur (`livreur`)

**Accès admin :** Aucun — interface livreur dédiée

Le livreur peut :
- Voir ses missions de livraison assignées par un admin
- Activer ou désactiver sa disponibilité lui-même (`is_available`)
- Démarrer une livraison et mettre à jour sa position GPS
- Confirmer la collecte chez le vendeur (déclenche le paiement de l'avance vendeur à 70%)
- Confirmer la livraison chez l'acheteur
- Configurer son compte Mobile Money pour recevoir ses virements hebdomadaires automatiques

---

### 1.4 Administrateur (`admin`)

**is_staff :** Oui  
**is_super_admin :** Oui (équivalent super_admin)

Accès complet à tous les modules du dashboard d'administration : commandes, litiges, annonces, boutiques, livraisons, comptabilité, capital de roulement, paramètres, utilisateurs.

---

### 1.5 Super Administrateur (`super_admin`)

**is_staff :** Oui  
**Privilège exclusif :** Peut modifier le champ `is_staff` d'autres comptes (promotion / rétrogradation du personnel)

Même périmètre que l'admin. C'est le rôle le plus élevé de l'application.

---

### 1.6 Admin Livraison (`admin_delivery`)

**is_staff :** Oui  
**Onglets accessibles :** Livraisons · Points de retrait · Zones de rencontre · Config livraison

Peut :
- Assigner un livreur à une commande confirmée
- Réassigner une livraison à un autre livreur
- Créer, modifier, supprimer les points de retrait et zones de rencontre
- Configurer les zones de livraison et les tarifs inter-quartiers de Conakry

---

### 1.7 Admin Marketing (`admin_marketing`)

**is_staff :** Oui  
**Onglets accessibles :** Annonces · Boutiques · Publicités · Catégories · Utilisateurs

Peut :
- Approuver ou rejeter les annonces (avec motif de rejet)
- Suspendre une annonce active
- Approuver et modifier les boutiques vendeurs
- Créer, modifier, supprimer les publicités (banners)
- Gérer les catégories d'annonces
- Activer ou suspendre des comptes utilisateurs

---

### 1.8 Admin Comptabilité (`admin_accounting`)

**is_staff :** Oui  
**Onglets accessibles :** Comptabilité · Dashboard · Commandes · Retours · Paramètres · Capital roulement

Peut :
- Suivre et déclencher les virements vendeurs (libération escrow → Mobile Money)
- Consulter les gains des livreurs et générer les virements hebdomadaires
- Appliquer des amendes aux livreurs
- Résoudre les litiges (en faveur de l'acheteur ou du vendeur)
- Gérer le capital de roulement : injecter des fonds, modifier le taux d'avance (%), définir le plafond par commande
- Signaler les défauts de paiement sur les avances vendeurs
- Exporter les données comptables en CSV

---

## Tableau des permissions par rôle

| Permission | admin / super_admin | admin_delivery | admin_marketing | admin_accounting | buyer / seller |
|---|:---:|:---:|:---:|:---:|:---:|
| is_admin (accès admin) | ✅ | ✅ | ✅ | ✅ | ❌ |
| is_super_admin (accès total) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gérer livraisons | ✅ | ✅ | ❌ | ❌ | ❌ |
| Gérer annonces & marketing | ✅ | ❌ | ✅ | ❌ | ❌ |
| Gérer comptabilité | ✅ | ❌ | ❌ | ✅ | ❌ |
| Modifier is_staff | super_admin seulement | ❌ | ❌ | ❌ | ❌ |
| Capital de roulement | ✅ | ❌ | ❌ | ✅ | ❌ |
| Ouvrir un litige | ❌ | ❌ | ❌ | ❌ | ✅ acheteur |
| Passer une commande | ❌ | ❌ | ❌ | ❌ | ✅ acheteur |
| Créer une annonce | ❌ | ❌ | ❌ | ❌ | ✅ vendeur |

---

## 2. Flux fonctionnels

---

### 2.1 Inscription & Authentification

Tout utilisateur s'inscrit avec son **numéro de téléphone guinéen**. Le compte est créé avec le rôle `buyer` par défaut. Un **code de parrainage unique** (8 caractères alphanumériques) est généré automatiquement. Le compte doit être vérifié (`is_verified = true`) par un admin avant de pouvoir passer une commande ou créer une annonce.

---

### 2.2 Cycle de vie d'une commande

L'escrow (fonds retenus) protège l'acheteur jusqu'à confirmation de réception.

| Statut | Qui agit | Ce qui se passe |
|---|---|---|
| **PENDING** | Acheteur | Commande passée, paiement effectué. Escrow = HELD (fonds retenus). |
| **CONFIRMED** | Vendeur | Vendeur confirme qu'il a l'article prêt. Livreur en attente d'assignation. |
| **PICKUP_CONFIRMED** | Livreur + Admin | Livreur collecte chez le vendeur → vendeur reçoit 70% immédiatement (si capital disponible). 30% en attente. |
| **COMPLETED** | Acheteur / Livreur | Acheteur confirme la réception → escrow libéré → vendeur reçoit le 30% restant. Livreur crédité de sa commission. |
| **CANCELLED** | Acheteur / Admin | Annulation avant collecte. Remboursement acheteur. Escrow = REFUNDED. |
| **DISPUTED** | Acheteur | Litige ouvert. Admin tranche → COMPLETED (vendeur gagne) ou CANCELLED (acheteur remboursé). |

```
PENDING → (vendeur confirme) → CONFIRMED
                                    ↓
                     (livreur collecte) → PICKUP_CONFIRMED  ← vendeur reçoit 70%
                                    ↓
                     (livraison faite) → COMPLETED  ← vendeur reçoit 30% restants
                                    ↓
                     (litige ouvert)  → DISPUTED → (admin résout) → COMPLETED ou CANCELLED
```

---

### 2.3 Flux Capital de roulement (livraison à domicile)

Le capital de roulement (10 000 000 GNF de départ) permet de payer le vendeur partiellement dès la collecte par le livreur, sans attendre que l'acheteur confirme. Cela réduit la méfiance du vendeur envers la plateforme.

1. Livreur collecte l'article chez le vendeur → appelle `confirm-pickup`
2. Système vérifie le capital disponible et le plafond par commande (300 000 GNF par défaut)
3. Si éligible : vendeur reçoit **70%** du montant article immédiatement (Mobile Money)
4. **30% restant** est retenu jusqu'à confirmation de l'acheteur
5. Quand l'acheteur confirme → escrow libéré → 30% virés au vendeur → capital reconstitué
6. En cas de défaut → admin signale le défaut → capital enregistre la perte (`total_defaulted_gnf`)

---

### 2.4 Modes de livraison

#### Remise en main propre (`meeting_point`)
Acheteur et vendeur se retrouvent dans un lieu public convenu (marché, carrefour, mosquée…). Aucun livreur impliqué. Le paiement via escrow est libéré quand l'acheteur confirme la réception.

#### Point de retrait (`pickup_point`)
L'acheteur récupère l'article dans un point de retrait Guimatrix agréé. Le livreur dépose l'article au point de retrait.

#### Livraison à domicile (`home_delivery`)
Un livreur Guimatrix collecte l'article chez le vendeur et le livre directement chez l'acheteur. **Seul mode éligible au capital de roulement** (avance 70% au vendeur à la collecte).

---

### 2.5 Automatismes — Cron jobs (Render)

Quatre tâches automatiques tournent en arrière-plan et maintiennent la cohérence de la plateforme.

| Cron job | Fréquence | Action |
|---|---|---|
| `expire-listings` | Quotidien | Expire automatiquement les annonces dont la date est dépassée. |
| `notify-escrow` | Quotidien | Notifie les vendeurs que leur paiement escrow est prêt à être libéré. |
| `release-escrow` | Quotidien | Libère automatiquement l'escrow après le délai légal sans litige. |
| `weekly-payout` | Lundi matin | Génère et déclenche les virements hebdomadaires de tous les livreurs. |

---

### 2.6 Système de paiement & Escrow

Guimatrix utilise un mécanisme d'**escrow** : l'argent de l'acheteur est capturé dès la commande et retenu jusqu'à confirmation de réception. Aucun versement n'est fait au vendeur avant cette étape.

- **Opérateurs acceptés :** Orange Money · MTN MoMo · PayCard Guinée · ChaChaP
- **Escrow HELD :** Fonds retenus dès le paiement de l'acheteur
- **Escrow RELEASED :** Vendeur payé après confirmation de réception
- **Escrow REFUNDED :** Remboursement acheteur en cas d'annulation ou litige gagné

---

### 2.7 Programme de parrainage (Affiliés)

Chaque utilisateur possède un **code de parrainage unique** généré automatiquement à l'inscription (8 caractères alphanumériques). Lorsqu'un nouvel utilisateur s'inscrit avec ce code, le parrain reçoit une commission sur les commandes du filleul. Les commissions sont suivies dans le module affiliés.

---

*Guimatrix — Document interne confidentiel*
