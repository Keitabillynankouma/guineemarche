/**
 * Génère "Toutes les fonctionnalités de Guimatrix.docx"
 * Exécuter : node generate_features_doc.js
 * Requis    : npm install -g docx (ou npm install docx dans ce dossier)
 */

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, LevelFormat, ExternalHyperlink,
  PageBreak,
} = require('docx');
const fs = require('fs');

// ── Couleurs ────────────────────────────────────────────────────────────────
const GREEN   = '1A7A4A';
const LGREEN  = 'E8F5EE';
const DGREEN  = '145E38';
const GRAY    = 'F5F5F5';
const DGRAY   = '555555';
const WHITE   = 'FFFFFF';
const BORDER  = 'CCCCCC';

const border  = { style: BorderStyle.SINGLE, size: 1, color: BORDER };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

// ── Helpers ─────────────────────────────────────────────────────────────────
const sp  = (before, after) => ({ spacing: { before: before * 20, after: after * 20 } });
const H1  = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  children: [new TextRun({ text, font: 'Arial', size: 36, bold: true, color: DGREEN })],
  ...sp(24, 12),
  border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: GREEN, space: 4 } },
});
const H2  = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  children: [new TextRun({ text, font: 'Arial', size: 28, bold: true, color: GREEN })],
  ...sp(18, 8),
});
const H3  = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  children: [new TextRun({ text, font: 'Arial', size: 24, bold: true, color: DGRAY })],
  ...sp(14, 6),
});
const P   = (text, opts = {}) => new Paragraph({
  children: [new TextRun({ text, font: 'Arial', size: 22, color: '333333', ...opts })],
  ...sp(0, 6),
});
const bullet = (text, bold = false) => new Paragraph({
  numbering: { reference: 'bullets', level: 0 },
  children: [new TextRun({ text, font: 'Arial', size: 22, bold, color: '333333' })],
  ...sp(0, 3),
});
const subbullet = (text) => new Paragraph({
  numbering: { reference: 'subbullets', level: 1 },
  children: [new TextRun({ text, font: 'Arial', size: 20, color: DGRAY })],
  ...sp(0, 2),
});
const space = (n = 8) => new Paragraph({ children: [new TextRun('')], spacing: { before: 0, after: n * 20 } });

// Badge coloré pour status
const badge = (text, bg = GREEN) => new Paragraph({
  children: [new TextRun({ text: `  ${text}  `, font: 'Arial', size: 18, bold: true, color: WHITE, highlight: null })],
  shading: { fill: bg, type: ShadingType.CLEAR },
  spacing: { before: 40, after: 40 },
  alignment: AlignmentType.LEFT,
});

// Ligne de séparateur
const divider = () => new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER, space: 2 } },
  spacing: { before: 80, after: 80 },
  children: [new TextRun('')],
});

// ── Tableau de feature ───────────────────────────────────────────────────────
const featureRow = (feature, status, description) => new TableRow({
  children: [
    new TableCell({
      borders,
      width: { size: 3200, type: WidthType.DXA },
      shading: { fill: GRAY, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 150, right: 150 },
      children: [new Paragraph({ children: [new TextRun({ text: feature, font: 'Arial', size: 20, bold: true })] })],
    }),
    new TableCell({
      borders,
      width: { size: 1400, type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 80, bottom: 80, left: 150, right: 150 },
      shading: {
        fill: status === '✅ Actif' ? 'D4EDDA' : status === '🔄 En cours' ? 'FFF3CD' : 'F8D7DA',
        type: ShadingType.CLEAR,
      },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: status, font: 'Arial', size: 18,
          color: status === '✅ Actif' ? '155724' : status === '🔄 En cours' ? '856404' : '721C24' })],
      })],
    }),
    new TableCell({
      borders,
      width: { size: 4760, type: WidthType.DXA },
      margins: { top: 80, bottom: 80, left: 150, right: 150 },
      children: [new Paragraph({ children: [new TextRun({ text: description, font: 'Arial', size: 20, color: '444444' })] })],
    }),
  ],
});

const tableHeader = () => new TableRow({
  tableHeader: true,
  children: [
    new TableCell({
      borders,
      width: { size: 3200, type: WidthType.DXA },
      shading: { fill: GREEN, type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 150, right: 150 },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Fonctionnalité', font: 'Arial', size: 20, bold: true, color: WHITE })] })],
    }),
    new TableCell({
      borders,
      width: { size: 1400, type: WidthType.DXA },
      shading: { fill: GREEN, type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 150, right: 150 },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Statut', font: 'Arial', size: 20, bold: true, color: WHITE })] })],
    }),
    new TableCell({
      borders,
      width: { size: 4760, type: WidthType.DXA },
      shading: { fill: GREEN, type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 150, right: 150 },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Description', font: 'Arial', size: 20, bold: true, color: WHITE })] })],
    }),
  ],
});

const featureTable = (rows) => new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [3200, 1400, 4760],
  rows: [tableHeader(), ...rows],
});

// ── Page de titre ────────────────────────────────────────────────────────────
const titlePage = [
  new Paragraph({
    children: [new TextRun({ text: '\n\n\n' })],
    spacing: { before: 2000 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'GUIMATRIX', font: 'Arial Black', size: 80, bold: true, color: GREEN })],
    spacing: { before: 0, after: 120 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'La Marketplace Intelligente de la Guinée', font: 'Arial', size: 32, color: DGRAY, italics: true })],
    spacing: { before: 0, after: 200 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: GREEN }, bottom: { style: BorderStyle.SINGLE, size: 4, color: GREEN } },
    children: [new TextRun({ text: 'CATALOGUE COMPLET DES FONCTIONNALITÉS', font: 'Arial', size: 26, bold: true, color: DGREEN })],
    spacing: { before: 120, after: 120 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Version 2.0 — Juillet 2026', font: 'Arial', size: 22, color: DGRAY })],
    spacing: { before: 120, after: 800 },
  }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ── Contenu ──────────────────────────────────────────────────────────────────
const content = [
  ...titlePage,

  // ── 1. AUTHENTIFICATION ──
  H1('1. Authentification & Gestion des Comptes'),
  P('Système d\'authentification dual : voie SMS pour les utilisateurs en Guinée, voie email pour la diaspora mondiale.'),
  space(),

  H2('1.1 Inscription Guinée (SMS OTP)'),
  featureTable([
    featureRow('Inscription SMS', '✅ Actif', 'Formulaire numéro de téléphone + mot de passe. OTP envoyé via Nimba SMS (fournisseur guinéen).'),
    featureRow('Vérification OTP 6 chiffres', '✅ Actif', '6 champs individuels avec auto-focus, auto-avance et support copier-coller. Délai d\'expiration 10 minutes.'),
    featureRow('Rate limiting OTP', '✅ Actif', '5 tentatives maximum par heure par IP. Protection contre le brute-force.'),
    featureRow('Code parrainage', '✅ Actif', 'Optionnel à l\'inscription. Récompense automatique pour le parrain et le parrainé.'),
  ]),
  space(),

  H2('1.2 Inscription Diaspora (Email)'),
  featureTable([
    featureRow('Inscription email', '✅ Actif', 'Email + mot de passe fort. OTP envoyé via Brevo API HTTP (Railway bloque SMTP, on utilise HTTPS).'),
    featureRow('Toggle Guinée / Diaspora', '✅ Actif', 'Sélecteur pill sur la page d\'inscription pour choisir le type de compte.'),
    featureRow('Vérification email OTP', '✅ Actif', 'Même mécanisme 6 chiffres que SMS. Email délivré via Brevo en < 30 secondes.'),
  ]),
  space(),

  H2('1.3 Connexion & Sécurité Session'),
  featureTable([
    featureRow('Login universel', '✅ Actif', 'Identifiant = téléphone ou email. Détection automatique du type (icône dynamique dans le formulaire).'),
    featureRow('JWT Access Token', '✅ Actif', 'Validité 2 heures. Signé avec SHA256(SECRET_KEY) → toujours 256 bits.'),
    featureRow('JWT Refresh Token', '✅ Actif', 'Validité 30 jours. Rotation automatique + blacklist Redis à chaque usage.'),
    featureRow('Rate limiting login', '✅ Actif', '10 tentatives maximum par heure par IP.'),
    featureRow('Réinitialisation mot de passe', '✅ Actif', 'Workflow 3 étapes : email → OTP → nouveau mot de passe. Progress bar visuelle.'),
    featureRow('Déconnexion', '✅ Actif', 'Blacklist du refresh token → session invalidée côté serveur.'),
    featureRow('Connexion diaspora détectée', '✅ Actif', 'Message "✓ Connexion diaspora détectée" quand l\'identifiant contient un @.'),
  ]),
  space(16),

  // ── 2. ANNONCES ──
  H1('2. Annonces'),
  P('Module central de la marketplace. Création, modération IA, recherche intelligente et géolocalisation.'),
  space(),

  H2('2.1 Création & Gestion'),
  featureTable([
    featureRow('Création annonce', '✅ Actif', 'Titre, description, prix GNF, catégorie, condition, ville, quartier, coordonnées GPS optionnelles.'),
    featureRow('Upload photos', '✅ Actif', 'Cloudinary CDN. Validation type MIME réel (pas seulement l\'extension) pour bloquer les fichiers déguisés.'),
    featureRow('Modération IA automatique', '✅ Actif', 'Claude Haiku analyse titre + description + prix à la création. Décision : approve / review / reject avec raison.'),
    featureRow('Re-modération à l\'édition', '✅ Actif', 'Si titre ou description change, l\'annonce repasse en DRAFT et est re-modérée avant publication.'),
    featureRow('Expiration automatique', '✅ Actif', 'Les annonces expirées disparaissent automatiquement de la liste. Commande de gestion disponible.'),
    featureRow('Boost d\'annonce', '✅ Actif', 'Les annonces boostées apparaissent en haut des résultats.'),
    featureRow('Suppression douce', '✅ Actif', 'La suppression passe l\'annonce en SUSPENDED (pas de DELETE SQL). Historique conservé.'),
  ]),
  space(),

  H2('2.2 Recherche & Filtres'),
  featureTable([
    featureRow('Recherche textuelle', '✅ Actif', 'Recherche dans titre, description, ville, quartier.'),
    featureRow('Filtres multiples', '✅ Actif', 'Catégorie, prix min/max, ville, condition (neuf/occasion), type de prix (fixe/négociable/gratuit).'),
    featureRow('Géolocalisation radius', '✅ Actif', 'Filtre near_lat / near_lng / radius_km avec calcul Haversine.'),
    featureRow('Recherche IA (langue naturelle)', '✅ Actif', 'POST /ai-search/ — Claude Haiku extrait les filtres d\'une phrase en français, anglais ou langue locale.'),
    featureRow('Catégories hiérarchiques', '✅ Actif', 'Catégories parentes et sous-catégories avec attributs dynamiques personnalisables par catégorie.'),
  ]),
  space(),

  H2('2.3 Fonctionnalités Sociales'),
  featureTable([
    featureRow('Favoris', '✅ Actif', 'Ajouter / retirer des favoris. Liste personnelle accessible dans le profil.'),
    featureRow('Signalement', '✅ Actif', 'Signaler une annonce suspecte avec raison. Envoyé à l\'équipe de modération.'),
    featureRow('Compteur de vues', '✅ Actif', 'Incrémentation atomique à chaque consultation (view_count).'),
    featureRow('Recommandations similaires', '✅ Actif', 'GET /{id}/similar/ — même catégorie, fourchette de prix ±60%. IA sémantique si < 4 résultats SQL.'),
    featureRow('Bannières publicitaires', '✅ Actif', 'Bannières admin par catégorie, affichées en haut des listings.'),
  ]),
  space(16),

  // ── 3. IA ──
  H1('3. Intelligence Artificielle (Claude Haiku)'),
  P('5 agents IA actifs + 7 nouveaux prévus. Tous tournent sur Claude Haiku (Anthropic) pour minimiser les coûts.'),
  space(),

  featureTable([
    featureRow('AI-01 Modération annonces', '✅ Actif', 'Approve / Review / Reject à la création. Détecte : contenu adulte, armes, drogues, prix suspects (iPhone à 5 000 GNF).'),
    featureRow('AI-02 Rapport sécurité quotidien', '✅ Actif', 'Scan Celery à 07h00. Collecte annonces suspectes, comptes frauduleux, anomalies paiement. Email rapport à l\'admin.'),
    featureRow('AI-03 Recherche naturelle', '✅ Actif', 'Convertit "je cherche un iPhone pas cher à Conakry" en filtres Django structurés.'),
    featureRow('AI-04 Assistant achat', '✅ Actif', 'Chatbot contextuel avec connaissance de l\'annonce en cours. Conseille sur prix, négociation, signaux d\'arnaque.'),
    featureRow('AI-05 Recommandations', '✅ Actif', 'Annonces similaires avec enrichissement sémantique si peu de résultats SQL.'),
    featureRow('AI-06 Fraude reviews', '🔄 Prévu', 'Détecte les fausses avis (burst, copy-paste, reviewer sans commande).'),
    featureRow('AI-07 Sécurité chat', '✅ Actif', 'Analyse chaque message en temps réel : numéros de téléphone, mots-clés arnaque, liens externes. Warn ou block.'),
    featureRow('AI-08 Modération images', '🔄 Prévu', 'Analyse visuelle des photos uploadées (contenu adulte, armes, billets de banque).'),
    featureRow('AI-09 Résolution litiges', '🔄 Prévu', 'Analyse ordre + messages + historique parties → rapport recommandation pour l\'admin.'),
    featureRow('AI-10 Qualité annonces', '🔄 Prévu', 'Score 0-100 + suggestions vendeur pour améliorer ses annonces.'),
    featureRow('AI-11 Comptes dupliqués', '🔄 Prévu', 'Détecte réinscriptions après ban (nom similaire, même IP, téléphone proche).'),
    featureRow('AI-12 Traduction locale', '🔄 Prévu', 'Traduit annonces en Pular, Mandingo, Susu pour les acheteurs ruraux.'),
  ]),
  space(16),

  // ── 4. PAIEMENTS ──
  H1('4. Paiements & Escrow'),
  P('Intégration Paycard Guinée (agrégateur Mobile Money + Visa) avec système d\'escrow pour protéger acheteurs et vendeurs.'),
  space(),

  featureTable([
    featureRow('Orange Money GN', '✅ Actif', 'Paiement mobile money via Paycard API. Confirmation par webhook sécurisé HMAC-SHA256.'),
    featureRow('MTN MoMo GN', '✅ Actif', 'Paiement mobile money MTN via Paycard API.'),
    featureRow('Visa / Mastercard', '✅ Actif', 'Paiement carte bancaire internationale via Paycard. Redirection vers page de paiement sécurisée.'),
    featureRow('Système Escrow', '✅ Actif', 'Les fonds sont bloqués à la commande et libérés uniquement après confirmation de réception par l\'acheteur.'),
    featureRow('Libération automatique', '✅ Actif', 'Celery Beat libère l\'escrow automatiquement après délai configurable si l\'acheteur ne confirme pas.'),
    featureRow('Protection replay attack', '✅ Actif', 'Fenêtre de 5 minutes sur les webhooks. Timestamp trop ancien = rejet.'),
    featureRow('Remboursement', '✅ Actif', 'Webhook paycard_refund met à jour le statut REFUNDED automatiquement.'),
    featureRow('Commission vendeur', '✅ Actif', 'Champ commission_gnf et seller_payout_gnf calculés sur chaque commande.'),
  ]),
  space(16),

  // ── 5. COMMANDES ──
  H1('5. Commandes & Livraison'),
  featureTable([
    featureRow('Workflow commandes', '✅ Actif', 'PENDING → CONFIRMED → COMPLETED. Branches : CANCELLED, DISPUTED.'),
    featureRow('Confirmation vendeur', '✅ Actif', 'Le vendeur confirme la commande. Notification push + email à l\'acheteur.'),
    featureRow('Confirmation réception', '✅ Actif', 'L\'acheteur valide la réception → libère l\'escrow immédiatement.'),
    featureRow('Système de litige', '✅ Actif', 'L\'acheteur ouvre un litige → escrow bloqué jusqu\'à résolution admin.'),
    featureRow('Points de retrait', '✅ Actif', 'CRUD admin des points de retrait par ville. Sélectionnable à la commande.'),
    featureRow('Zones de rencontre', '✅ Actif', 'Lieux de rencontre sécurisés suggérés par l\'admin pour les échanges en personne.'),
    featureRow('Blocage escrow admin', '✅ Actif', 'L\'admin peut bloquer/débloquer manuellement l\'escrow d\'une commande.'),
    featureRow('Protection auto-achat', '✅ Actif', 'Impossible d\'acheter sa propre annonce (vérification côté serveur).'),
  ]),
  space(16),

  // ── 6. MESSAGERIE ──
  H1('6. Messagerie Temps Réel'),
  featureTable([
    featureRow('WebSockets (Django Channels)', '✅ Actif', 'Messagerie temps réel via Redis Channel Layer. Latence < 100ms.'),
    featureRow('Conversations par annonce', '✅ Actif', 'Une conversation par couple (acheteur, annonce). Pas de doublons.'),
    featureRow('Types de messages', '✅ Actif', 'Texte, offre de prix (offer_amount_gnf), médias.'),
    featureRow('Anti-spam messagerie', '✅ Actif', 'Rate limit 60 messages/heure par utilisateur.'),
    featureRow('Agent sécurité chat', '✅ Actif', 'Détection en temps réel des arnaques : numéros de téléphone, mots-clés virement, liens externes suspects.'),
    featureRow('Marque-lu automatique', '✅ Actif', 'Les messages sont marqués "lu" à l\'ouverture de la conversation.'),
    featureRow('Notifications push', '✅ Actif', 'Notification in-app WebSocket à la réception d\'un nouveau message.'),
  ]),
  space(16),

  // ── 7. PROFILS ──
  H1('7. Profils, Boutiques & Gamification'),
  featureTable([
    featureRow('Profil utilisateur', '✅ Actif', 'Nom complet, photo, bio, téléphone, email, préférences.'),
    featureRow('Notation vendeur', '✅ Actif', 'Moyenne des avis (rating_avg) et nombre total de ventes calculés automatiquement.'),
    featureRow('Avis clients (Reviews)', '✅ Actif', 'Un avis par commande COMPLETED. Vérification que reviewer et reviewee sont bien parties prenantes de la commande.'),
    featureRow('Boutiques vendeurs', '✅ Actif', 'Page boutique personnalisée avec logo, bannière, description et plan d\'abonnement.'),
    featureRow('Abonnements', '✅ Actif', 'Plan Gratuit (quota annonces) et Plan Pro (annonces illimitées). Contrôlé par SiteSettings admin.'),
    featureRow('Badges gamification', '✅ Actif', 'Attribution automatique : Première annonce, Premier vendeur, etc.'),
    featureRow('Système de parrainage', '✅ Actif', 'Code unique par utilisateur. Récompenses automatiques à l\'inscription du filleul.'),
  ]),
  space(16),

  // ── 8. SÉCURITÉ ──
  H1('8. Sécurité'),
  P('Architecture de sécurité multi-couches. Score actuel : 7/10 (5 failles corrigées en juillet 2026).'),
  space(),

  featureTable([
    featureRow('GuineeSecurityMiddleware', '✅ Actif', 'Détection SQL injection, XSS, path traversal dans toutes les URLs et paramètres.'),
    featureRow('Blocage IP progressif', '✅ Actif', '10 fails → 30 minutes de ban. Compteurs Redis. Réinitialisation automatique.'),
    featureRow('Détection User-Agent malveillants', '✅ Actif', 'sqlmap, nikto, nmap, burpsuite, Havij, Acunetix → 403 immédiat.'),
    featureRow('En-têtes de sécurité HTTP', '✅ Actif', 'HSTS, CSP strict, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy.'),
    featureRow('Blocage chemins sensibles', '✅ Actif', '/etc/passwd, .env, /wp-admin, /phpmyadmin → 404 immédiat.'),
    featureRow('Vérification signatures webhook', '✅ Actif', 'HMAC-SHA256 sur Orange Money et Paycard. Rejet si secret absent (fix juillet 2026).'),
    featureRow('Rate limiting multi-niveaux', '✅ Actif', 'Global (200/j anon, 1000/j user) + OTP (5/h) + Login (10/h) + Messages (60/h).'),
    featureRow('JWT sécurisé', '✅ Actif', 'Clé de signature SHA256(SECRET_KEY) → toujours 256 bits. Blacklist à chaque rotation.'),
    featureRow('Validation MIME réelle', '✅ Actif', 'Lecture magic bytes des fichiers uploadés, pas seulement l\'extension.'),
    featureRow('URL admin secrète', '✅ Actif', 'L\'URL /admin/ est masquée. Seule l\'URL secrète configurée en env donne accès.'),
    featureRow('Sentry monitoring', '✅ Actif', '10% traces prod, 100% dev. Ignorer les 401/404 normaux. Alerte sur ERROR+.'),
    featureRow('CORS strict en prod', '✅ Actif', 'Liste blanche des origines autorisées. CORS_ALLOW_ALL_ORIGINS uniquement en dev.'),
  ]),
  space(16),

  // ── 9. EMAILS ──
  H1('9. Emails Transactionnels (Brevo)'),
  P('Tous les emails passent par Brevo HTTP API (Railway bloque SMTP). Backend Django personnalisé (BrevoEmailBackend).'),
  space(),

  featureTable([
    featureRow('OTP inscription email', '✅ Actif', 'Email avec code 6 chiffres envoyé à l\'inscription diaspora.'),
    featureRow('Réinitialisation mot de passe', '✅ Actif', 'Email OTP pour reset password.'),
    featureRow('Nouvelle commande (vendeur)', '✅ Actif', 'Email au vendeur à chaque nouvelle commande reçue.'),
    featureRow('Commande confirmée (acheteur)', '✅ Actif', 'Email à l\'acheteur quand le vendeur confirme.'),
    featureRow('Paiement reçu', '✅ Actif', 'Email confirmation paiement à acheteur et vendeur.'),
    featureRow('Escrow libéré (vendeur)', '✅ Actif', 'Email au vendeur quand les fonds sont débloqués.'),
    featureRow('Commande annulée', '✅ Actif', 'Email aux deux parties en cas d\'annulation.'),
    featureRow('Litige ouvert', '✅ Actif', 'Email au vendeur et notification admin.'),
    featureRow('Rapport sécurité quotidien', '✅ Actif', 'Email admin à 07h00 avec le rapport de l\'agent IA sécurité.'),
  ]),
  space(16),

  // ── 10. FRONTEND ──
  H1('10. Interface Utilisateur (React + Tailwind)'),
  featureTable([
    featureRow('Page Inscription', '✅ Actif', 'Split-screen : panneau marque vert gradient + formulaire. Toggle Guinée/Diaspora. OTP 6 chiffres.'),
    featureRow('Page Connexion', '✅ Actif', 'Split-screen avec témoignage client. Icône dynamique téléphone/email. "✓ Connexion diaspora détectée".'),
    featureRow('Mot de passe oublié', '✅ Actif', 'Progress bar 3 étapes avec checkmarks. Validation temps réel correspondance mots de passe.'),
    featureRow('Page annonce détail', '✅ Actif', 'Galerie photos, description, vendeur, assistant IA contextuel, recommandations.'),
    featureRow('Page profil', '✅ Actif', 'Statistiques vendeur, historique avis, liste annonces, boutique.'),
    featureRow('Page commandes', '✅ Actif', 'Onglets acheteur/vendeur. Timeline de statut. Boutons actions contextuels.'),
    featureRow('Messagerie', '✅ Actif', 'Chat temps réel. Affichage safety_warning si message suspect.'),
    featureRow('Design responsive', '✅ Actif', 'Mobile-first. Panneau marque masqué sur mobile (lg:grid). Classes Tailwind CSS.'),
    featureRow('HomePage', '🔄 Prévu', 'Hero section, grille annonces vedettes, navbar professionnelle.'),
    featureRow('CreateListing', '🔄 Prévu', 'Formulaire création annonce redesigné avec upload drag-and-drop.'),
    featureRow('Favorites / MyListings / Shop', '🔄 Prévu', 'Pages secondaires à redesigner.'),
  ]),
  space(16),

  // ── 11. INFRA ──
  H1('11. Infrastructure & DevOps'),
  featureTable([
    featureRow('Hébergement', '✅ Actif', 'Railway (backend Django + Celery + PostgreSQL + Redis).'),
    featureRow('CDN médias', '✅ Actif', 'Cloudinary pour toutes les images. URLs sécurisées HTTPS.'),
    featureRow('Base de données', '✅ Actif', 'PostgreSQL (Railway). Migrations Django. 6 apps.'),
    featureRow('Cache & Message Broker', '✅ Actif', 'Redis pour Celery, Channel Layers WebSocket, blocage IP.'),
    featureRow('Tâches asynchrones', '✅ Actif', 'Celery Beat + Worker. 4 tâches planifiées (escrow, sécurité, rappels).'),
    featureRow('WebSockets', '✅ Actif', 'Django Channels via ASGI + Redis Channel Layer.'),
    featureRow('Variables d\'environnement', '✅ Actif', 'Toutes les clés secrètes dans Railway env vars (jamais dans le code).'),
    featureRow('CI/CD', '✅ Actif', 'Push git main → redéploiement automatique Railway.'),
  ]),

  space(24),
  divider(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Guimatrix © 2026 — Tous droits réservés — guimatrix.com', font: 'Arial', size: 18, color: DGRAY, italics: true })],
    spacing: { before: 120, after: 0 },
  }),
];

// ── Document final ───────────────────────────────────────────────────────────
const doc = new Document({
  creator: 'Guimatrix',
  title: 'Toutes les fonctionnalités de Guimatrix',
  description: 'Catalogue complet des fonctionnalités — Version 2.0',
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: 'Arial', color: DGREEN },
        paragraph: { spacing: { before: 480, after: 240 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Arial', color: GREEN },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: 'Arial', color: DGRAY },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      ]},
      { reference: 'subbullets', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
      ]},
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          children: [
            new TextRun({ text: 'GUIMATRIX — Catalogue des Fonctionnalités', font: 'Arial', size: 18, color: GREEN, bold: true }),
            new TextRun({ text: '\t', font: 'Arial', size: 18 }),
            new TextRun({ text: 'Version 2.0 — Juillet 2026', font: 'Arial', size: 18, color: DGRAY }),
          ],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GREEN, space: 4 } },
          tabStops: [{ type: 'right', position: 9026 }],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDER, space: 4 } },
          children: [
            new TextRun({ text: 'Page ', font: 'Arial', size: 18, color: DGRAY }),
            new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 18, color: DGRAY }),
            new TextRun({ text: ' / ', font: 'Arial', size: 18, color: DGRAY }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 18, color: DGRAY }),
          ],
          spacing: { before: 120 },
        })],
      }),
    },
    children: content,
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('Toutes les fonctionnalités de Guimatrix v2.docx', buffer);
  console.log('✅ Fichier créé : Toutes les fonctionnalités de Guimatrix v2.docx');
}).catch(err => {
  console.error('❌ Erreur :', err.message);
});
