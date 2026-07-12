/**
 * Génère 2 documents MVP Guimatrix :
 *   1. Guimatrix_MVP_Pitch.docx       — Pitch / Business Plan
 *   2. Guimatrix_CahierDesCharges.docx — Cahier des charges technique
 *
 * Exécuter : node generate_mvp_docs.js
 * Requis   : npm install -g docx (ou npm install docx dans ce dossier)
 */

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, LevelFormat, PageBreak,
} = require('docx');
const fs = require('fs');

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  green:  '1A7A4A', lgreen: 'E8F5EE', dgreen: '145E38',
  gray:   'F5F5F5', dgray:  '555555', lgray:  'EEEEEE',
  white:  'FFFFFF', black:  '111111', border: 'CCCCCC',
  red:    'C0392B', orange: 'E67E22', blue:   '2980B9', purple: '8E44AD',
};

// ── Utils ────────────────────────────────────────────────────────────────────
const sp   = (b, a) => ({ spacing: { before: b * 20, after: a * 20 } });
const br   = () => new Paragraph({ children: [new PageBreak()] });
const line = (color = C.border, sz = 4) => new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: sz, color, space: 2 } },
  children: [new TextRun('')],
  ...sp(6, 6),
});
const vsp  = (n = 8) => new Paragraph({ children: [new TextRun('')], ...sp(0, n) });

const txt  = (t, opts = {}) => new TextRun({ text: t, font: 'Arial', size: 22, color: C.black, ...opts });
const bold = (t, opts = {}) => txt(t, { bold: true, ...opts });

const Para = (runs, opts = {}) => new Paragraph({ children: Array.isArray(runs) ? runs : [txt(runs)], ...sp(0, 6), ...opts });
const H1   = (t, color = C.dgreen) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  children: [new TextRun({ text: t, font: 'Arial', size: 40, bold: true, color })],
  border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: C.green, space: 4 } },
  ...sp(24, 14),
});
const H2   = (t, color = C.green) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  children: [new TextRun({ text: t, font: 'Arial', size: 30, bold: true, color })],
  ...sp(18, 8),
});
const H3   = (t) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  children: [new TextRun({ text: t, font: 'Arial', size: 24, bold: true, color: C.dgray })],
  ...sp(12, 6),
});
const bul  = (t, sub = false) => new Paragraph({
  numbering: { reference: sub ? 'sub' : 'bul', level: sub ? 1 : 0 },
  children: [txt(t, sub ? { color: C.dgray, size: 20 } : {})],
  ...sp(0, sub ? 2 : 4),
});

// Tableau 2 colonnes simple
const twoCol = (rows, widths = [3500, 5860], bg = C.gray) => new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: widths,
  rows: rows.map(([l, r]) => new TableRow({ children: [
    new TableCell({
      width: { size: widths[0], type: WidthType.DXA },
      borders: { top: { style: BorderStyle.SINGLE, size: 1, color: C.border }, bottom: { style: BorderStyle.SINGLE, size: 1, color: C.border }, left: { style: BorderStyle.NONE, size: 0, color: C.white }, right: { style: BorderStyle.NONE, size: 0, color: C.white } },
      shading: { fill: bg, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 150, right: 150 },
      children: [new Paragraph({ children: [txt(l, { bold: true })] })],
    }),
    new TableCell({
      width: { size: widths[1], type: WidthType.DXA },
      borders: { top: { style: BorderStyle.SINGLE, size: 1, color: C.border }, bottom: { style: BorderStyle.SINGLE, size: 1, color: C.border }, left: { style: BorderStyle.NONE, size: 0, color: C.white }, right: { style: BorderStyle.NONE, size: 0, color: C.white } },
      margins: { top: 80, bottom: 80, left: 150, right: 150 },
      children: [new Paragraph({ children: [txt(r)] })],
    }),
  ]})),
});

// Carte colorée pour KPIs
const kpiTable = (items) => new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [2340, 2340, 2340, 2340],
  rows: [new TableRow({
    children: items.map(([val, lbl, color]) => new TableCell({
      width: { size: 2340, type: WidthType.DXA },
      shading: { fill: color, type: ShadingType.CLEAR },
      borders: { top: { style: BorderStyle.NONE, size: 0, color: C.white }, bottom: { style: BorderStyle.NONE, size: 0, color: C.white }, left: { style: BorderStyle.NONE, size: 0, color: C.white }, right: { style: BorderStyle.NONE, size: 0, color: C.white } },
      margins: { top: 200, bottom: 200, left: 200, right: 200 },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: val, font: 'Arial Black', size: 52, bold: true, color: C.white })], ...sp(0, 4) }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: lbl, font: 'Arial', size: 20, color: C.white })], ...sp(0, 0) }),
      ],
    })),
  })],
});

const numbering = {
  config: [
    { reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: 'sub', levels: [
      { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
    ]},
    { reference: 'num', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
  ],
};

const styles = {
  default: { document: { run: { font: 'Arial', size: 22 } } },
  paragraphStyles: [
    { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { size: 40, bold: true, font: 'Arial', color: C.dgreen },
      paragraph: { spacing: { before: 480, after: 280 }, outlineLevel: 0 } },
    { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { size: 30, bold: true, font: 'Arial', color: C.green },
      paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 1 } },
    { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { size: 24, bold: true, font: 'Arial', color: C.dgray },
      paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 2 } },
  ],
};

const pageProps = {
  size: { width: 11906, height: 16838 },
  margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
};

const makeHeader = (title) => ({
  default: new Header({ children: [new Paragraph({
    children: [
      new TextRun({ text: 'GUIMATRIX', font: 'Arial', size: 18, bold: true, color: C.green }),
      new TextRun({ text: `  ·  ${title}`, font: 'Arial', size: 18, color: C.dgray }),
      new TextRun({ text: '\tJuillet 2026', font: 'Arial', size: 18, color: C.dgray }),
    ],
    tabStops: [{ type: 'right', position: 9026 }],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.green, space: 4 } },
  })]}),
});

const makeFooter = () => ({
  default: new Footer({ children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.border, space: 4 } },
    children: [
      txt('Page ', { size: 18, color: C.dgray }),
      new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 18, color: C.dgray }),
      txt(' sur ', { size: 18, color: C.dgray }),
      new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 18, color: C.dgray }),
      txt('  —  Confidentiel', { size: 18, color: C.dgray }),
    ],
    ...sp(6, 0),
  })]},
)});


// ════════════════════════════════════════════════════════════════════════════
// DOCUMENT 1 : PITCH / BUSINESS PLAN MVP
// ════════════════════════════════════════════════════════════════════════════

const pitchContent = [

  // COUVERTURE
  new Paragraph({ children: [new TextRun({ text: 'GUIMATRIX', font: 'Arial Black', size: 96, bold: true, color: C.green })], alignment: AlignmentType.CENTER, ...sp(100, 20) }),
  new Paragraph({ children: [txt('La Marketplace Intelligente de la Guinée', { size: 32, color: C.dgray, italics: true })], alignment: AlignmentType.CENTER, ...sp(0, 60) }),
  line(C.green, 16),
  new Paragraph({ children: [txt('DOSSIER MVP — PITCH INVESTISSEUR', { size: 28, bold: true, color: C.dgreen })], alignment: AlignmentType.CENTER, ...sp(40, 20) }),
  new Paragraph({ children: [txt('Confidentiel — Juillet 2026', { size: 22, color: C.dgray })], alignment: AlignmentType.CENTER, ...sp(0, 80) }),
  br(),

  // RÉSUMÉ EXÉCUTIF
  H1('1. Résumé Exécutif'),
  Para([
    bold('Guimatrix '), txt('est la première marketplace intelligente de Guinée, conçue pour connecter les vendeurs locaux avec les acheteurs, en Guinée et dans la diaspora mondiale. Grâce à une intégration native d\'Intelligence Artificielle (Claude Haiku d\'Anthropic), Guimatrix offre une expérience de vente et d\'achat sécurisée, moderne et adaptée aux réalités économiques guinéennes.'),
  ]),
  vsp(8),
  kpiTable([
    ['10K+', 'Annonces cibles (an 1)', C.green],
    ['50K+', 'Utilisateurs cibles', C.blue],
    ['12 IA', 'Agents automatisés', C.purple],
    ['3 pays', 'Marchés adressés', C.orange],
  ]),
  vsp(16),
  twoCol([
    ['Fondateurs', 'Billy Nankouma Keita & équipe'],
    ['Siège', 'Conakry, Guinée'],
    ['Stade', 'MVP — Backend opérationnel, Frontend en cours'],
    ['Technologie', 'Django REST + React.js + IA Claude (Anthropic)'],
    ['Paiements', 'Orange Money GN · MTN MoMo GN · Visa/Mastercard'],
    ['Déploiement', 'Railway (backend) · Cloudinary (médias)'],
    ['Contact', 'bnkeita020@gmail.com · guimatrix.com'],
  ]),
  vsp(16),

  // PROBLÈME
  H1('2. Le Problème'),
  Para('La Guinée est un marché de 14 millions d\'habitants avec une économie dynamique mais sous-digitalisée. Le commerce en ligne reste embryonnaire pour plusieurs raisons :'),
  vsp(4),
  bul('Absence de marketplace locale fiable — les acteurs internationaux (Jumia, etc.) ne desservent pas la Guinée.'),
  bul('Méfiance envers les paiements en ligne — pas de système d\'escrow local. Les arnaques sont fréquentes.'),
  bul('Barrière linguistique — la plupart des plateformes sont en anglais ou en français standard, pas en langues locales (Pular, Mandingo, Susu).'),
  bul('Pas de Mobile Money intégré — Orange Money et MTN MoMo sont massivement utilisés mais absent des marketplaces existantes.'),
  bul('Diaspora déconnectée — 3 millions de Guinéens à l\'étranger souhaitent acheter, investir ou aider leur famille, sans canal sécurisé.'),
  vsp(16),

  // SOLUTION
  H1('3. La Solution Guimatrix'),
  H2('3.1 Une marketplace 100% adaptée à la Guinée'),
  bul('Inscription via SMS (Guinée) ou Email (Diaspora) avec vérification OTP'),
  bul('Paiement en Orange Money GN, MTN MoMo GN et Visa/Mastercard via Paycard'),
  bul('Escrow automatique : les fonds sont bloqués jusqu\'à confirmation de réception'),
  bul('Interface bilingue (français + langues locales en roadmap)'),
  vsp(8),

  H2('3.2 Intelligence Artificielle intégrée (différenciateur clé)'),
  Para('Guimatrix est la première marketplace en Afrique de l\'Ouest à intégrer 12 agents IA autonomes :'),
  vsp(4),
  twoCol([
    ['AI-01 Modération annonces',      'Analyse chaque annonce avant publication (Claude Haiku). Détecte armes, drogues, prix suspects.'],
    ['AI-02 Rapport sécurité quotidien', 'Scan fraude à 07h00 chaque matin. Email admin automatique.'],
    ['AI-03 Recherche naturelle',       'L\'utilisateur tape "je cherche un iPhone pas cher" → filtres extraits automatiquement.'],
    ['AI-04 Assistant achat',           'Chatbot contextuel qui conseille acheteur (prix marché, signaux d\'arnaque, négociation).'],
    ['AI-05 Recommandations',           'Annonces similaires avec scoring sémantique.'],
    ['AI-07 Sécurité chat',             'Détecte arnaques dans les messages : numéros partagés, demandes de virement hors système.'],
    ['AI-09 Résolution litiges',        '(Prévu) Analyse dossier litige et recommande une décision à l\'admin.'],
    ['AI-12 Traduction locale',         '(Prévu) Traduit les annonces en Pular, Mandingo, Susu.'],
  ], [3200, 6160]),
  vsp(16),

  // MARCHÉ
  H1('4. Marché Adressable'),
  kpiTable([
    ['14M', 'Habitants en Guinée', C.green],
    ['65%', 'Pop. < 25 ans', C.blue],
    ['3M+', 'Diaspora mondiale', C.purple],
    ['85%', 'Taux Mobile Money GN', C.orange],
  ]),
  vsp(16),
  H2('4.1 Marché Total Adressable (TAM)'),
  bul('Économie guinéenne : PIB ~15 milliards USD (2024). Commerce informel estimé à 60% = ~9 Mds USD/an non digitalisé.'),
  bul('Taux de pénétration internet : 25% et croissant (4G en expansion).'),
  bul('Marché e-commerce Afrique de l\'Ouest : 25 milliards USD d\'ici 2027 (source : McKinsey).'),
  vsp(8),

  H2('4.2 Segment Adressable Immédiat (SAM)'),
  bul('Commerce de biens de consommation (téléphones, électronique, vêtements) à Conakry et 5 villes majeures.'),
  bul('Objectif an 1 : 10 000 annonces actives, 50 000 utilisateurs, 5 000 commandes mensuelles.'),
  vsp(16),

  // MODÈLE ÉCONOMIQUE
  H1('5. Modèle Économique'),
  H2('5.1 Flux de revenus'),
  twoCol([
    ['Commission transactions', '3–5% sur chaque vente finalisée via escrow (Orange Money, MTN, Carte).'],
    ['Abonnements vendeurs Pro', '99 000 GNF/mois (~10 USD) : annonces illimitées, badge Pro, priorité recherche.'],
    ['Boost d\'annonces',        '20 000–50 000 GNF : annonce mise en avant pendant 7 ou 30 jours.'],
    ['Bannières publicitaires',  'Espaces pub par catégorie pour marques locales et internationales.'],
    ['Shopify diaspora',         '(Prévu) Boutiques premium pour vendeurs ciblant la diaspora.'],
  ]),
  vsp(8),

  H2('5.2 Projections Financières (hypothèse conservatrice)'),
  twoCol([
    ['An 1 — Lancement',      '5 000 utilisateurs actifs · 1 000 commandes/mois · 15M GNF (~1 500 USD) de revenus mensuels'],
    ['An 2 — Croissance',     '25 000 utilisateurs · 5 000 commandes/mois · 80M GNF/mois + premiers revenus pub'],
    ['An 3 — Échelle',        '100 000 utilisateurs · 20 000 commandes/mois · 400M GNF/mois + expansion Sierra Leone & Mali'],
  ]),
  vsp(16),

  // ROADMAP
  H1('6. Roadmap Produit'),
  H2('MVP v1.0 — Actuel (Juillet 2026)'),
  bul('Backend Django complet : auth, annonces, commandes, paiements, messagerie, reviews, abonnements'),
  bul('Frontend React : 8 pages redesignées (Register, Login, ForgotPassword, ListingDetail, Profil, Commandes, Chat, Favorites)'),
  bul('5 agents IA actifs (modération, sécurité, recherche, assistant, recommandations)'),
  bul('3 moyens de paiement intégrés (Orange Money, MTN MoMo, Visa via Paycard)'),
  bul('Infrastructure Railway + PostgreSQL + Redis + Cloudinary'),
  bul('Sécurité multi-couches (middleware, throttling, HMAC, Sentry, agent IA quotidien)'),
  vsp(8),

  H2('v1.1 — Août–Septembre 2026'),
  bul('Redesign HomePage, CreateListing, MyListings, Shop (4 pages restantes)'),
  bul('Application mobile React Native (iOS + Android) — wrapper WebView MVP'),
  bul('Notifications push mobiles (Firebase FCM)'),
  bul('Agent IA revues frauduleuses (AI-06)'),
  bul('Modération d\'images par IA (AI-08)'),
  vsp(8),

  H2('v1.2 — Octobre–Décembre 2026'),
  bul('Traduction locale Pular / Mandingo / Susu (AI-12)'),
  bul('Agent résolution litiges (AI-09)'),
  bul('Score qualité annonces + suggestions vendeur (AI-10)'),
  bul('Ouverture boutiques diaspora premium'),
  bul('Programme d\'affiliation influenceurs'),
  vsp(8),

  H2('v2.0 — 2027 — Expansion régionale'),
  bul('Sierra Leone (langue anglaise, intégration Mobile Money local)'),
  bul('Mali (Pular et Bambara)'),
  bul('Sénégal (partenariats Orange Sénégal)'),
  vsp(16),

  // AVANTAGE CONCURRENTIEL
  H1('7. Avantage Concurrentiel'),
  twoCol([
    ['IA profonde native',       'Le seul acteur e-commerce en Afrique de l\'Ouest avec 12 agents IA autonomes intégrés dès le MVP.'],
    ['Mobile Money natif',       'Orange Money et MTN MoMo intégrés nativement, pas en add-on. Escrow automatique.'],
    ['Double marché',            'Guinée locale + diaspora mondiale sur la même plateforme.'],
    ['Sécurité avancée',         'Agent IA sécurité quotidien, agent sécurité chat temps réel. Niveau de protection inégalé sur le marché.'],
    ['Langues locales',          'Roadmap de traduction Pular / Mandingo / Susu — aucun concurrent n\'adresse ce marché.'],
    ['Fondateurs locaux',        'Connaissance profonde du marché guinéen, réseau local, compréhension des usages.'],
  ]),
  vsp(16),

  // ÉQUIPE
  H1('8. Équipe'),
  twoCol([
    ['Billy Nankouma Keita', 'CEO & CTO — Développeur full-stack, architecte du produit. Expertise Django, React, IA, paiements.'],
    ['Support IA — Claude (Anthropic)', 'Partenaire technologique IA. Analyse, modération, recommandations, sécurité.'],
    ['Recrutements prévus (An 1)', 'Commercial / Business Development · Designer UI/UX · Support client bilingue français/langues locales'],
  ]),
  vsp(16),

  // BESOIN EN FINANCEMENT
  H1('9. Besoins & Utilisation des Fonds'),
  Para('Nous cherchons une levée de 50 000 USD (Seed) pour accélérer le go-to-market et atteindre 25 000 utilisateurs en 12 mois.'),
  vsp(8),
  twoCol([
    ['Développement produit (30%)',      '15 000 USD — Application mobile, agents IA manquants, traduction locale'],
    ['Marketing & Acquisition (40%)',    '20 000 USD — Campagnes radio Conakry, influenceurs réseaux sociaux, partenariats télécom'],
    ['Infrastructure & Opérations (20%)', '10 000 USD — Serveurs, CDN, SMS, emails, monitoring'],
    ['Équipe & Recrutement (10%)',       '5 000 USD — Commercial terrain, support client'],
  ]),
  vsp(16),

  // CTA
  H1('10. Prochaines Étapes'),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [txt('Rejoignez-nous pour digitaliser l\'économie guinéenne.', { size: 26, bold: true, color: C.green })],
    ...sp(0, 20),
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [txt('Billy Nankouma Keita · bnkeita020@gmail.com · guimatrix.com', { size: 22, color: C.dgray })],
    ...sp(0, 0),
  }),
];


// ════════════════════════════════════════════════════════════════════════════
// DOCUMENT 2 : CAHIER DES CHARGES TECHNIQUE
// ════════════════════════════════════════════════════════════════════════════

const cdcContent = [

  // COUVERTURE
  new Paragraph({ children: [new TextRun({ text: 'GUIMATRIX', font: 'Arial Black', size: 80, bold: true, color: C.green })], alignment: AlignmentType.CENTER, ...sp(80, 16) }),
  new Paragraph({ children: [txt('CAHIER DES CHARGES TECHNIQUE', { size: 32, bold: true, color: C.dgreen })], alignment: AlignmentType.CENTER, ...sp(0, 12) }),
  new Paragraph({ children: [txt('Version 2.0 — Juillet 2026', { size: 22, color: C.dgray })], alignment: AlignmentType.CENTER, ...sp(0, 80) }),
  line(C.green, 12),
  vsp(8),
  twoCol([
    ['Projet',         'Guimatrix — Marketplace en ligne Guinée'],
    ['Type',           'Application web full-stack + API REST'],
    ['Version actuelle', 'MVP 1.0 opérationnel'],
    ['Auteur',         'Billy Nankouma Keita'],
    ['Date',           'Juillet 2026'],
    ['Confidentialité', 'Document interne — Ne pas diffuser'],
  ]),
  br(),

  // ARCHITECTURE
  H1('1. Architecture Technique'),
  H2('1.1 Vue d\'ensemble'),
  twoCol([
    ['Paradigme',     'Monolithe modulaire (6 apps Django) avec API REST. Frontend SPA React découplé.'],
    ['Communication', 'HTTP/REST pour les données + WebSocket (ASGI) pour la messagerie temps réel.'],
    ['Déploiement',   'Railway (PaaS) — Backend Django · Celery Worker · Celery Beat · PostgreSQL · Redis.'],
    ['CDN médias',    'Cloudinary (images annonces, avatars, logos boutiques).'],
    ['Frontend',      'Vercel ou Railway Static — React 18 + Vite + Tailwind CSS.'],
  ]),
  vsp(8),

  H2('1.2 Stack Technique'),
  twoCol([
    ['Backend',            'Python 3.12 + Django 5.x + Django REST Framework 3.17'],
    ['Authentification',   'djangorestframework-simplejwt · JWT (access 2h, refresh 30j, blacklist)'],
    ['Base de données',    'PostgreSQL 16 (Railway)'],
    ['Cache & Broker',     'Redis 7 (Railway) — Celery, Channel Layers, IP blocking'],
    ['WebSockets',         'Django Channels 4 + channels-redis'],
    ['Tâches async',       'Celery 5 + Celery Beat (4 tâches planifiées)'],
    ['Frontend',           'React 18 + Vite 6 + Tailwind CSS 3 + React Router 6'],
    ['State management',   'Zustand (authStore, cartStore)'],
    ['Intelligence Artificielle', 'Anthropic SDK (Claude Haiku 4.5) — 12 agents'],
    ['Paiements',          'Paycard Guinée (Orange Money GN + MTN MoMo GN + Visa/Mastercard)'],
    ['Email',              'Brevo HTTP API (custom Django EmailBackend — SMTP bloqué sur Railway)'],
    ['SMS / OTP',          'Nimba SMS (fournisseur guinéen)'],
    ['Monitoring',         'Sentry (errors + performance + security)'],
    ['Médias',             'Cloudinary (upload, transformation, CDN)'],
    ['Sécurité',           'GuineeSecurityMiddleware custom + rate limiting + HMAC webhooks'],
  ]),
  vsp(16),

  // STRUCTURE DES APPS
  H1('2. Structure des Applications Django'),
  H2('2.1 Apps'),
  twoCol([
    ['apps.accounts',     'Utilisateurs (User, OTPCode, UserProfile, Subscription, Badge, Shop, Referral). Auth SMS + Email.'],
    ['apps.listings',     'Annonces (Listing, Category, CategoryAttribute, ListingMedia, Favorite, ListingReport, Banner). IA + search.'],
    ['apps.orders',       'Commandes (Order, Payment, PickupPoint, MeetingZone). Escrow. Paycard. Webhooks.'],
    ['apps.messaging',    'Messagerie (Conversation, Message). WebSockets Django Channels.'],
    ['apps.reviews',      'Avis (Review). Note vendeur automatique. Vérification commande COMPLETED.'],
    ['apps.notifications', 'Notifications in-app (Notification). WebSocket push.'],
    ['core',              'Middleware sécurité · Brevo backend · Chat safety agent · Security agent · Email notifications · Permissions · Pagination · Site settings.'],
    ['config',            'Settings · URLs · ASGI · Celery.'],
  ]),
  vsp(16),

  // MODÈLES DE DONNÉES
  H1('3. Modèles de Données Principaux'),
  H2('3.1 User (apps.accounts)'),
  twoCol([
    ['phone_number', 'PhoneNumberField (unique, nullable) — clé primaire identité Guinée'],
    ['email',        'EmailField (unique, nullable) — identité diaspora'],
    ['password',     'PasswordField (hashé Django)'],
    ['is_verified',  'Boolean — vrai après vérification OTP'],
    ['is_seller',    'Boolean — accès fonctions vendeur'],
    ['referred_by',  'FK User (self) — parrainage'],
    ['referral_code', 'CharField unique (6 chars) — code parrainage auto-généré'],
  ]),
  vsp(8),

  H2('3.2 Listing (apps.listings)'),
  twoCol([
    ['title / description', 'Titre et description (modérés par IA)'],
    ['price_gnf',    'Prix en Francs Guinéens'],
    ['status',       'DRAFT · ACTIVE · SUSPENDED · SOLD · EXPIRED'],
    ['condition',    'new · like_new · good · fair · poor'],
    ['city / quartier / latitude / longitude', 'Localisation pour recherche géographique'],
    ['is_boosted',   'Boolean — ordre de tri prioritaire'],
    ['seller',       'FK User'],
    ['category',     'FK Category (hiérarchique, avec attributs dynamiques)'],
    ['expires_at',   'DateTime — expiration automatique'],
  ]),
  vsp(8),

  H2('3.3 Order (apps.orders)'),
  twoCol([
    ['status',            'PENDING · CONFIRMED · COMPLETED · CANCELLED · DISPUTED'],
    ['escrow_status',     'NONE · HELD · RELEASED · REFUNDED'],
    ['amount_gnf',        'Montant total en GNF'],
    ['commission_gnf',    'Commission plateforme'],
    ['seller_payout_gnf', 'Net vendeur après commission'],
    ['escrow_release_at', 'DateTime libération automatique programmée'],
    ['escrow_admin_hold', 'Boolean — blocage manuel admin'],
  ]),
  vsp(16),

  // API ENDPOINTS
  H1('4. API REST — Endpoints Principaux'),
  H2('4.1 Authentification (/api/v1/accounts/)'),
  twoCol([
    ['POST /register/',              'Inscription Guinée (téléphone + OTP SMS)'],
    ['POST /register/email/',        'Inscription Diaspora (email + OTP email)'],
    ['POST /verify-otp/',            'Vérification OTP SMS'],
    ['POST /verify-email-otp/',      'Vérification OTP Email'],
    ['POST /login/',                 'Connexion (téléphone ou email + mot de passe)'],
    ['POST /logout/',                'Déconnexion (blacklist refresh token)'],
    ['GET/PATCH /me/',               'Profil utilisateur connecté'],
    ['POST /forgot-password/',       'Envoi OTP reset mot de passe'],
    ['POST /reset-password/',        'Nouveau mot de passe avec OTP valide'],
  ], [3500, 5860]),
  vsp(8),

  H2('4.2 Annonces (/api/v1/listings/)'),
  twoCol([
    ['GET /listings/',               'Liste filtrée (catégorie, prix, ville, condition, géo)'],
    ['POST /listings/',              'Créer annonce (auth) → modération IA async'],
    ['GET/PATCH/DELETE /listings/{id}/', 'Détail / Modifier / Supprimer (propriétaire)'],
    ['GET /listings/{id}/similar/', 'Recommandations IA annonces similaires'],
    ['POST /listings/ai-search/',   'Recherche langue naturelle (Claude Haiku)'],
    ['POST /listings/assistant/',   'Assistant achat contextuel (Claude Haiku)'],
    ['GET /categories/',            'Arbre des catégories actives'],
    ['POST/DELETE /favorites/',     'Ajouter/retirer des favoris'],
    ['GET /my-listings/',           'Annonces du vendeur connecté'],
    ['POST /reports/',              'Signaler une annonce'],
  ], [3500, 5860]),
  vsp(8),

  H2('4.3 Commandes & Paiements (/api/v1/orders/)'),
  twoCol([
    ['POST /orders/',                'Créer une commande'],
    ['GET /orders/',                 'Mes commandes (acheteur)'],
    ['GET /orders/seller/',          'Commandes reçues (vendeur)'],
    ['POST /orders/{id}/{action}/',  'action = confirm | complete | cancel'],
    ['POST /orders/{id}/receipt/',   'Confirmer réception → libère escrow'],
    ['POST /orders/{id}/dispute/',   'Ouvrir un litige'],
    ['POST /orders/{id}/pay/',       'Initier paiement (Orange Money / MTN / Carte)'],
    ['POST /webhook/{provider}/',    'Webhook paiement (orange / paycard / paycard_card / paycard_refund)'],
    ['GET /pickup-points/',          'Points de retrait (filtrable par ville)'],
    ['GET /meeting-zones/',          'Zones de rencontre sécurisées'],
  ], [3500, 5860]),
  vsp(8),

  H2('4.4 Messagerie, Reviews, Notifications'),
  twoCol([
    ['POST /messaging/start/',       'Démarrer une conversation (premier message inclus)'],
    ['GET /messaging/conversations/', 'Liste des conversations de l\'utilisateur'],
    ['GET /messaging/{id}/messages/', 'Messages d\'une conversation'],
    ['POST /messaging/{id}/send/',   'Envoyer un message (throttle 60/h + agent sécurité)'],
    ['GET/POST /reviews/',           'Avis utilisateur (POST = création après commande COMPLETED)'],
    ['GET /reviews/user/{id}/',      'Avis reçus par un utilisateur (public)'],
    ['GET /notifications/',          'Liste notifications'],
    ['POST /notifications/{id}/read/', 'Marquer comme lu'],
    ['WS /ws/notifications/',        'WebSocket push notifications'],
    ['WS /ws/chat/{conversation_id}/', 'WebSocket messagerie temps réel'],
  ], [3500, 5860]),
  vsp(16),

  // SÉCURITÉ
  H1('5. Architecture de Sécurité'),
  H2('5.1 Couches de protection'),
  twoCol([
    ['Couche 1 — Réseau',         'HTTPS obligatoire. HSTS 1 an. SECURE_PROXY_SSL_HEADER Railway.'],
    ['Couche 2 — WAF Django',     'GuineeSecurityMiddleware : SQL injection, XSS, path traversal, malicious UA, sensitive paths.'],
    ['Couche 3 — IP',             'Redis blocage progressif : 10 fails → 30 min ban. Reset automatique.'],
    ['Couche 4 — Rate limiting',  'OTP 5/h · Login 10/h · API anon 200/j · User 1000/j · Messages 60/h.'],
    ['Couche 5 — Auth',           'JWT RS256-like (SHA256 secret) · Blacklist refresh · Session invalide côté serveur.'],
    ['Couche 6 — Données',        'Validation MIME réelle fichiers uploadés. Vérifications propriétaire sur toutes mutations.'],
    ['Couche 7 — Paiements',      'HMAC-SHA256 webhooks · Protection replay 5 min · Escrow impossible à bypass.'],
    ['Couche 8 — IA',             'Agent sécurité quotidien · Agent chat temps réel · Re-modération sur update.'],
    ['Couche 9 — Monitoring',     'Sentry · Logging structuré · Alertes ERROR+ par email.'],
  ]),
  vsp(8),

  H2('5.2 Failles identifiées & corrigées (Juillet 2026)'),
  twoCol([
    ['FAILLE-01 CSRF middleware commenté',  'STATUT : Documenté. API JWT-only → pas de vulnérabilité pratique. À activer avant ajout sessions.'],
    ['FAILLE-02 Orange webhook open door',  'CORRIGÉ — return False si ORANGE_WEBHOOK_SECRET absent.'],
    ['FAILLE-03 Reviews sans vérification', 'CORRIGÉ — Vérification commande COMPLETED + reviewer est partie prenante.'],
    ['FAILLE-04 Pas de re-modération',      'CORRIGÉ — update() avec changement content → DRAFT + moderate_listing_task.'],
    ['FAILLE-05 Messages sans throttle',    'CORRIGÉ — MessageSendThrottle 60/heure.'],
    ['FAILLE-06 Haversine N+1 Python',      'À CORRIGER — Migrer vers calcul SQL (PostGIS ou annotation Haversine).'],
  ]),
  vsp(16),

  // AGENTS IA
  H1('6. Cartographie des Agents IA'),
  twoCol([
    ['AI-01 Modération annonces',     '✅ Actif — Claude Haiku à la création. approve / review / reject.'],
    ['AI-02 Rapport sécurité',        '✅ Actif — Cron 07h00. Collecte fraudes. Email admin.'],
    ['AI-03 Recherche naturelle',     '✅ Actif — Extraction de filtres depuis phrase libre.'],
    ['AI-04 Assistant achat',         '✅ Actif — Chatbot avec contexte annonce. 8 messages d\'historique.'],
    ['AI-05 Recommandations',         '✅ Actif — Similarité sémantique si < 4 résultats SQL.'],
    ['AI-06 Fraude reviews',          '🔄 Prévu Sprint 1 — Burst détection, copy-paste, buyer check.'],
    ['AI-07 Sécurité chat',           '✅ Actif — Heuristiques + Claude Haiku. warn ou block en temps réel.'],
    ['AI-08 Modération images',       '🔄 Prévu Sprint 2 — Vision Claude sur photos uploadées.'],
    ['AI-09 Résolution litiges',      '🔄 Prévu Sprint 2 — Rapport recommandation admin.'],
    ['AI-10 Qualité annonces',        '🔄 Prévu Sprint 3 — Score 0-100 + suggestions.'],
    ['AI-11 Comptes dupliqués',       '🔄 Prévu Sprint 3 — Détection réinscription après ban.'],
    ['AI-12 Traduction locale',       '🔄 Prévu Sprint 4 — Pular, Mandingo, Susu.'],
  ]),
  vsp(16),

  // VARIABLES ENV
  H1('7. Variables d\'Environnement Requises'),
  twoCol([
    ['SECRET_KEY',            'Clé Django (min 50 chars)'],
    ['DATABASE_URL',          'PostgreSQL Railway'],
    ['REDIS_URL',             'Redis Railway'],
    ['ANTHROPIC_API_KEY',     'Claude Haiku — Agents IA'],
    ['BREVO_API_KEY',         'Email HTTP API (xkeysib-...)'],
    ['BREVO_SENDER_EMAIL',    'Email expéditeur vérifié Brevo'],
    ['NIMBA_SERVICE_ID',      'SMS Guinée — OTP inscription'],
    ['NIMBA_SECRET_TOKEN',    'SMS Guinée — OTP inscription'],
    ['CLOUDINARY_CLOUD_NAME', 'Stockage médias'],
    ['CLOUDINARY_API_KEY',    'Stockage médias'],
    ['CLOUDINARY_API_SECRET', 'Stockage médias'],
    ['PAYCARD_API_KEY',       'Paiement Mobile Money + Visa'],
    ['PAYCARD_SECRET_KEY',    'Signature webhooks Paycard'],
    ['PAYCARD_MERCHANT_ID',   'Identifiant marchand Paycard'],
    ['ORANGE_WEBHOOK_SECRET', 'Signature webhooks Orange Money'],
    ['SENTRY_DSN',            'Monitoring erreurs'],
    ['JWT_SIGNING_KEY',       'Optionnel — override SHA256(SECRET_KEY)'],
    ['ALLOWED_HOSTS',         'Domaines autorisés Railway'],
    ['DEBUG',                 'False en production'],
  ]),
  vsp(16),

  // PERFORMANCES & LIMITES
  H1('8. Performances & Limites Connues'),
  twoCol([
    ['Géolocalisation Haversine',  'Calcul Python en mémoire → dégradation à > 5 000 annonces. À migrer vers SQL/PostGIS.'],
    ['Modération synchrone',       'Si Celery down → modération synchrone bloquante (< 2s). Acceptable en MVP.'],
    ['Recherche fulltext',         'icontains Django → scan séquentiel. À migrer vers PostgreSQL Full-Text Search à 50K annonces.'],
    ['WebSocket scaling',          'Redis Channel Layer → scalable horizontalement. Un seul worker suffit jusqu\'à 10K connexions.'],
    ['Modération images',          'Non implémentée — les images ne sont pas analysées par IA (roadmap AI-08).'],
  ]),
  vsp(16),

  // DÉPLOIEMENT
  H1('9. Guide de Déploiement'),
  H2('9.1 Backend (Railway)'),
  new Paragraph({
    children: [new TextRun({ text: 'git add . && git commit -m "feat: ..." && git push', font: 'Courier New', size: 20, color: C.green })],
    shading: { fill: '1A1A1A', type: ShadingType.CLEAR },
    ...sp(4, 4),
  }),
  Para('Le push déclenche automatiquement le redéploiement Railway. Vérifier les logs dans le dashboard Railway.'),
  vsp(8),

  H2('9.2 Frontend (Vercel / Railway Static)'),
  Para('cd frontend && npm run build → dossier dist/ à déployer. Variables VITE_API_URL à configurer dans l\'environnement de build.'),
  vsp(8),

  H2('9.3 Commandes de maintenance'),
  twoCol([
    ['python manage.py migrate',                'Appliquer les migrations Django'],
    ['python manage.py createsuperuser',        'Créer un admin'],
    ['python manage.py expire_listings',        'Expirer les annonces périmées'],
    ['python manage.py migrate_media_to_cloudinary', 'Migrer les médias vers Cloudinary'],
    ['celery -A config worker -l info',         'Démarrer le worker Celery'],
    ['celery -A config beat -l info',           'Démarrer le scheduler Celery Beat'],
  ]),
  vsp(24),

  line(C.green),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [txt('Guimatrix © 2026 — Document Confidentiel — guimatrix.com', { size: 18, color: C.dgray, italics: true })],
    ...sp(8, 0),
  }),
];


// ── Générer les 2 documents ──────────────────────────────────────────────────
const makeDoc = (sectionChildren, title) => new Document({
  creator: 'Guimatrix',
  title,
  styles,
  numbering,
  sections: [{
    properties: { page: pageProps },
    headers: makeHeader(title),
    footers: makeFooter(),
    children: sectionChildren,
  }],
});

Promise.all([
  Packer.toBuffer(makeDoc(pitchContent, 'Pitch MVP')).then(buf => {
    fs.writeFileSync('Guimatrix_MVP_Pitch.docx', buf);
    console.log('✅ Guimatrix_MVP_Pitch.docx créé');
  }),
  Packer.toBuffer(makeDoc(cdcContent, 'Cahier des Charges Technique')).then(buf => {
    fs.writeFileSync('Guimatrix_CahierDesCharges.docx', buf);
    console.log('✅ Guimatrix_CahierDesCharges.docx créé');
  }),
]).catch(err => console.error('❌ Erreur :', err.message));
