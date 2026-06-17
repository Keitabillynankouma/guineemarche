// Business Plan GuinéeMarché — générateur docx
// Exécuter : node generate_business_plan.js
const fs = require('fs');

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
  BorderStyle, WidthType, ShadingType, VerticalAlign, PageNumber,
  PageBreak, TableOfContents
} = require('docx');

// ─── Helpers ────────────────────────────────────────────────────────────────
const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 100, bottom: 100, left: 140, right: 140 };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, bold: true, size: 36, font: 'Arial', color: '1A5C2A' })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 140 },
    children: [new TextRun({ text, bold: true, size: 28, font: 'Arial', color: '276F3F' })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24, font: 'Arial', color: '2E7D32' })],
  });
}
function p(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 120 },
    children: [new TextRun({ text, font: 'Arial', size: 22, ...opts })],
  });
}
function bullet(text, opts = {}) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, font: 'Arial', size: 22, ...opts })],
  });
}
function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}
function spacer() {
  return new Paragraph({ children: [new TextRun('')], spacing: { before: 80, after: 80 } });
}

function twoColTable(rows) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3500, 5860],
    rows: rows.map(([label, value]) =>
      new TableRow({
        children: [
          new TableCell({
            borders, margins: cellMargins,
            width: { size: 3500, type: WidthType.DXA },
            shading: { fill: 'E8F5E9', type: ShadingType.CLEAR },
            children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, font: 'Arial', size: 20 })] })],
          }),
          new TableCell({
            borders, margins: cellMargins,
            width: { size: 5860, type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun({ text: value, font: 'Arial', size: 20 })] })],
          }),
        ],
      })
    ),
  });
}

function threeColTable(headers, rows) {
  const colW = [3120, 3120, 3120];
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: colW,
    rows: [
      new TableRow({
        children: headers.map((h, i) =>
          new TableCell({
            borders, margins: cellMargins,
            width: { size: colW[i], type: WidthType.DXA },
            shading: { fill: '1A5C2A', type: ShadingType.CLEAR },
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', font: 'Arial', size: 20 })]
            })],
          })
        ),
      }),
      ...rows.map((row, ri) =>
        new TableRow({
          children: row.map((cell, i) =>
            new TableCell({
              borders, margins: cellMargins,
              width: { size: colW[i], type: WidthType.DXA },
              shading: { fill: ri % 2 === 0 ? 'F9FBF9' : 'FFFFFF', type: ShadingType.CLEAR },
              children: [new Paragraph({ children: [new TextRun({ text: cell, font: 'Arial', size: 20 })] })],
            })
          ),
        })
      ),
    ],
  });
}

// ─── Document ───────────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  styles: {
    default: {
      document: { run: { font: 'Arial', size: 22 } },
    },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: 'Arial', color: '1A5C2A' },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 },
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Arial', color: '276F3F' },
        paragraph: { spacing: { before: 260, after: 140 }, outlineLevel: 1 },
      },
      {
        id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: 'Arial', color: '2E7D32' },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 },
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '1A5C2A', space: 1 } },
            children: [
              new TextRun({ text: 'GuinéeMarché — Business Plan Confidentiel', font: 'Arial', size: 18, color: '1A5C2A' }),
              new TextRun({ text: '\t2026', font: 'Arial', size: 18, color: '888888' }),
            ],
            tabStops: [{ type: 'right', position: 9026 }],
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC', space: 1 } },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Page ', font: 'Arial', size: 18, color: '888888' }),
              new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 18, color: '888888' }),
            ],
          }),
        ],
      }),
    },
    children: [

      // ══════════════════════════════
      // PAGE DE COUVERTURE
      // ══════════════════════════════
      new Paragraph({
        spacing: { before: 1440, after: 480 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'GuinéeMarché', bold: true, size: 72, font: 'Arial', color: '1A5C2A' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 240 },
        children: [new TextRun({ text: 'La première marketplace sécurisée de Guinée', size: 30, font: 'Arial', color: '444444', italics: true })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 480, after: 120 },
        children: [new TextRun({ text: 'BUSINESS PLAN', bold: true, size: 48, font: 'Arial', color: '276F3F' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 960 },
        children: [new TextRun({ text: 'Exercice 2026 – 2029', size: 24, font: 'Arial', color: '666666' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 1440, after: 80 },
        children: [new TextRun({ text: 'CONFIDENTIEL', bold: true, size: 22, font: 'Arial', color: 'CC0000' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Ce document est destiné exclusivement à ses destinataires et ne peut être reproduit sans autorisation.', size: 18, font: 'Arial', color: '888888', italics: true })],
      }),
      pageBreak(),

      // ══════════════════════════════
      // TABLE DES MATIÈRES
      // ══════════════════════════════
      new Paragraph({
        spacing: { before: 0, after: 360 },
        children: [new TextRun({ text: 'Table des matières', bold: true, size: 36, font: 'Arial', color: '1A5C2A' })],
      }),
      new TableOfContents('Table des matières', { hyperlink: true, headingStyleRange: '1-3' }),
      pageBreak(),

      // ══════════════════════════════
      // 1. RÉSUMÉ EXÉCUTIF
      // ══════════════════════════════
      h1('1. Résumé Exécutif'),
      p('GuinéeMarché est la première plateforme de commerce en ligne sécurisée de Guinée, fondée en 2025 et opérationnelle depuis début 2026. Elle met en relation acheteurs et vendeurs guinéens via une interface mobile-first avec un système de paiement escrow intégré, une modération IA automatique et une authentification par numéro de téléphone — sans nécessiter de carte bancaire ni d\'adresse email.'),
      spacer(),
      twoColTable([
        ['Secteur', 'E-commerce & Marketplace B2C/C2C'],
        ['Zone géographique', 'Guinée (Conakry en priorité), puis CEDEAO'],
        ['Modèle économique', 'Commission 5–10 % + abonnements vendeurs + publicité native'],
        ['Paiement', 'Orange Money (intégration exclusive), paiement à la livraison'],
        ['Stade', 'MVP en production — guineemarche-frontend.onrender.com'],
        ['Objectif Année 1', '5 000 utilisateurs actifs, 500 vendeurs, GMV 2 Md GNF'],
        ['Objectif Année 3', '50 000 utilisateurs, GMV 30 Md GNF, rentabilité opérationnelle'],
        ['Investissement recherché', '500 000 000 GNF (~55 000 USD) en Série A'],
      ]),
      spacer(),
      p('GuinéeMarché se distingue de tous les concurrents locaux par son escrow intelligent (séquestre automatique des fonds), sa modération IA en temps réel via Claude (Anthropic), son chatbot support 24h/24, et son programme de fidélisation avec badges et parrainage.'),
      pageBreak(),

      // ══════════════════════════════
      // 2. PRÉSENTATION DE GUINÉEMARCHÉ
      // ══════════════════════════════
      h1('2. Présentation de GuinéeMarché'),

      h2('2.1 Mission et vision'),
      p('Mission : Démocratiser le commerce en ligne en Guinée en offrant à chaque vendeur — du commerçant du marché Madina au revendeur de téléphones à Labé — une vitrine numérique fiable, sécurisée et accessible depuis n\'importe quel téléphone.'),
      p('Vision : Devenir le leader du e-commerce en Afrique de l\'Ouest francophone d\'ici 2030, en partant de la Guinée pour s\'étendre vers la Côte d\'Ivoire, le Sénégal et le Mali.'),

      h2('2.2 Problème résolu'),
      p('Le commerce en Guinée souffre de quatre problèmes structurels que GuinéeMarché résout directement :'),
      bullet('Confiance zéro : les acheteurs paient et ne reçoivent jamais leurs produits. → Escrow intelligent : le paiement est bloqué jusqu\'à confirmation de réception.'),
      bullet('Fragmentation : les annonces sont éparpillées sur Facebook, WhatsApp et bouche-à-oreille. → Catalogue centralisé, catégorisé et modéré.'),
      bullet('Fraude : faux vendeurs, doublons, produits dangereux. → Modération IA (Claude) automatique + vérification numéro OTP.'),
      bullet('Exclusion bancaire : 80 % des Guinéens n\'ont pas de compte bancaire. → Orange Money comme seul mode de paiement nécessaire.'),

      h2('2.3 Fonctionnalités principales'),
      h3('Côté acheteur'),
      bullet('Recherche full-text avec filtres (prix, ville, catégorie, état)'),
      bullet('Système de favoris / wishlist'),
      bullet('Commande en un clic avec paiement Orange Money ou paiement à la livraison'),
      bullet('Suivi de commande avec timeline visuelle'),
      bullet('Messagerie intégrée vendeur ↔ acheteur (WebSocket temps réel)'),
      bullet('Notifications push (PWA) et in-app'),
      bullet('Avis et évaluations vendeurs vérifiés'),

      h3('Côté vendeur'),
      bullet('Création d\'annonces avec photos et vidéos (Cloudinary)'),
      bullet('Modération IA instantanée ou révision manuelle'),
      bullet('Tableau de bord analytique : vues, conversions, portée, avis'),
      bullet('Boutique personnalisée avec URL dédiée'),
      bullet('Système de boost d\'annonce payant (Orange Money)'),
      bullet('Abonnements Pro/Premium avec avantages exclusifs'),
      bullet('Export CSV commandes et statistiques'),

      h3('Côté administration'),
      bullet('Panel admin complet : annonces, utilisateurs, boutiques, litiges'),
      bullet('Modération manuelle avec notification vendeur (in-app + SMS)'),
      bullet('Gestion des bannières publicitaires et promotions'),
      bullet('Feature flags pour activer/désactiver les modules (escrow, abonnements...)'),
      bullet('Suivi des litiges avec résolution manuelle'),
      bullet('Export données et statistiques globales'),
      pageBreak(),

      // ══════════════════════════════
      // 3. ANALYSE DU MARCHÉ GUINÉEN
      // ══════════════════════════════
      h1('3. Analyse du Marché Guinéen'),

      h2('3.1 Contexte macroéconomique'),
      p('La Guinée compte environ 14 millions d\'habitants (2025), avec un taux de pénétration mobile de 93 % et un taux de smartphone en progression rapide (~45 %). Conakry, capitale économique de 3 millions d\'habitants, concentre 70 % des transactions commerciales du pays.'),
      p('L\'économie guinéenne est portée par l\'extraction minière (bauxite, or), mais le secteur informel représente 75–80 % du PIB. La classe moyenne urbaine est en croissance rapide, notamment les 18–40 ans connectés et à l\'aise avec les applications mobiles.'),
      spacer(),
      twoColTable([
        ['Population totale', '~14,2 millions (2025)'],
        ['PIB par habitant', '~900 USD (2024)'],
        ['Taux de pénétration mobile', '93 %'],
        ['Utilisateurs internet mobile', '~6 millions actifs'],
        ['Taux bancarisation', '< 20 % (Orange Money : 40M en CEDEAO)'],
        ['Marché e-commerce estimé (2024)', '~15 M USD, croissance +20 %/an'],
        ['Devise', 'Franc Guinéen (GNF) — 1 USD ≈ 8 600 GNF (2025)'],
      ]),

      h2('3.2 Mobile Money : moteur de la révolution'),
      p('Orange Money est le premier système de paiement mobile en Guinée avec plus de 40 millions d\'utilisateurs actifs en Afrique de l\'Ouest (CEDEAO). En décembre 2025, Orange a lancé "Max it", une Super App intégrant paiement, crédit et commerce — confirmant la centralité du mobile money dans l\'économie guinéenne.'),
      p('GuinéeMarché s\'appuie sur cette infrastructure existante : l\'utilisateur moyen n\'a besoin que de son numéro Orange Money pour acheter ou vendre. Aucune carte bancaire, aucun virement SWIFT, aucune connaissance technique.'),

      h2('3.3 Opportunités spécifiques'),
      bullet('Commerce informel numérisable : des milliers de petits commerçants du marché Madina, Kaloum et Ratoma sans présence digitale'),
      bullet('Diaspora guinéenne : 2–3 millions de Guinéens à l\'étranger souhaitant acheter des produits locaux pour la famille'),
      bullet('Secteur agro-alimentaire : fruits, céréales, huile de palme — circuits courts numériques quasi inexistants'),
      bullet('Téléphonie / électronique : marché de la revente très actif, déjà partiellement sur WhatsApp'),
      bullet('Mode et artisanat : tissus, bijoux, vêtements traditionnels — marché régional potentiel'),
      pageBreak(),

      // ══════════════════════════════
      // 4. ANALYSE CONCURRENTIELLE
      // ══════════════════════════════
      h1('4. Analyse Concurrentielle'),

      h2('4.1 Paysage concurrentiel'),
      p('Le marché e-commerce guinéen est encore naissant. Voici les principaux acteurs avec lesquels GuinéeMarché se positionne :'),
      spacer(),
      threeColTable(
        ['Concurrent', 'Forces', 'Faiblesses vs GuinéeMarché'],
        [
          ['Arabinènè Marketplace (2019)', 'Pionnier local, 100+ fournisseurs, 6 000 références, Conakry', 'Pas d\'escrow, pas de modération IA, UX dépassée, paiement limité'],
          ['Margaarou', 'Intègre Orange Money et MTN, actif en Guinée', 'Catalogue limité, pas de messagerie temps réel, pas de boutiques'],
          ['Jumia West Africa', 'Notoriété panafricaine, logistique établie', 'Présence marginale en Guinée, ne parle pas aux petits vendeurs locaux, frais élevés'],
          ['Facebook Marketplace / WhatsApp', 'Gratuit, adoption massive', 'Pas de paiement sécurisé, pas de modération, fraude massive, pas d\'historique acheteur/vendeur'],
          ['GuinéeMarché (nous)', 'Escrow IA + modération + PWA + analytics', 'Notoriété à construire, catalogue à enrichir'],
        ]
      ),

      h2('4.2 Avantages compétitifs différenciateurs'),
      p('GuinéeMarché est la seule plateforme locale à combiner les six piliers suivants simultanément :'),
      bullet('Escrow intelligent : fonds sécurisés automatiquement avec libération conditionnelle (6h < 500 000 GNF, 48h ≥ 500 000 GNF)'),
      bullet('Modération IA : chaque annonce passe par Claude (Anthropic) avant publication — 0 contenu frauduleux ou dangereux'),
      bullet('Authentication par SMS OTP : aucun email requis, adapté au marché guinéen'),
      bullet('PWA mobile-first : fonctionne hors connexion partielle, installable sans app store'),
      bullet('Boutiques dédiées : chaque vendeur Pro/Premium a sa boutique avec URL, logo, avis et statistiques'),
      bullet('Support IA 24h/24 : chatbot Claude intégré répondant en wolof/français à toutes heures'),
      pageBreak(),

      // ══════════════════════════════
      // 5. MODÈLE ÉCONOMIQUE
      // ══════════════════════════════
      h1('5. Modèle Économique'),

      h2('5.1 Sources de revenus'),
      twoColTable([
        ['Commission transactions', '5 % sur chaque vente traitée via escrow (prélevée sur le paiement vendeur)'],
        ['Abonnement Standard', 'Gratuit — 3 annonces actives, sans boutique'],
        ['Abonnement Pro', '50 000 GNF/mois — 15 annonces, boutique, analytics de base'],
        ['Abonnement Premium', '100 000 GNF/mois — Annonces illimitées, boost automatique, analytics avancés'],
        ['Boost d\'annonce', '5 000 à 20 000 GNF selon la durée (24h, 3j, 7j) — mise en avant en homepage'],
        ['Publicité native (Banners)', '200 000 à 1 000 000 GNF/semaine selon format et position'],
        ['Commission livraison (futur)', 'Partenariat avec livreurs locaux — 2–3 % sur chaque livraison coordonnée'],
      ]),

      h2('5.2 Économie unitaire'),
      p('Pour une transaction type de 500 000 GNF (environ 58 USD) :'),
      bullet('Commission GuinéeMarché : 25 000 GNF (5 %)'),
      bullet('Frais Orange Money : ~1–2 % à la charge de l\'acheteur (hors modèle GuinéeMarché)'),
      bullet('Net vendeur : 475 000 GNF'),
      p('Avec 100 transactions/jour à cette valeur moyenne : revenus bruts = 2 500 000 GNF/jour = ~75 000 000 GNF/mois (~8 700 USD/mois en Année 2).'),

      h2('5.3 Projections financières'),
      spacer(),
      threeColTable(
        ['Indicateur', 'Année 1 (2026)', 'Année 3 (2028)'],
        [
          ['Utilisateurs enregistrés', '8 000', '80 000'],
          ['Utilisateurs actifs mensuels', '2 500', '25 000'],
          ['Vendeurs actifs', '500', '5 000'],
          ['Transactions/mois', '2 000', '20 000'],
          ['GMV mensuel (GNF)', '1 Md', '15 Md'],
          ['Revenus commissions (GNF)', '50 M', '750 M'],
          ['Revenus abonnements (GNF)', '25 M', '500 M'],
          ['Revenus publicité (GNF)', '10 M', '200 M'],
          ['Total revenus mensuels (GNF)', '85 M (~10 000 USD)', '1,45 Md (~168 000 USD)'],
          ['Charges opérationnelles (GNF)', '150 M', '600 M'],
          ['EBITDA mensuel (GNF)', '-65 M (investissement)', '+850 M (rentable)'],
        ]
      ),
      pageBreak(),

      // ══════════════════════════════
      // 6. INFRASTRUCTURE TECHNIQUE
      // ══════════════════════════════
      h1('6. Infrastructure Technique'),

      h2('6.1 Stack technologique'),
      twoColTable([
        ['Backend', 'Django 5.2 + Django REST Framework + PostgreSQL'],
        ['Frontend', 'React 19 + Vite + TanStack Query + Zustand (PWA)'],
        ['Temps réel', 'Django Channels + WebSocket (chat, notifications)'],
        ['Tâches async', 'Celery + Redis (modération, escrow auto, emails)'],
        ['Stockage media', 'Cloudinary (photos annonces + vidéos)'],
        ['Paiement', 'Orange Money API (intégration webhook sécurisé)'],
        ['IA modération', 'Claude API (Anthropic) — modération + chatbot support'],
        ['Surveillance', 'Sentry (backend + frontend) + alertes Slack'],
        ['Hébergement', 'Render.com (scalable, auto-deploy depuis GitHub)'],
        ['Authentification', 'JWT (SimpleJWT) + OTP SMS (numéro de téléphone uniquement)'],
      ]),

      h2('6.2 Sécurité'),
      bullet('Rate limiting OTP : 5 tentatives par heure par IP'),
      bullet('Vérification signature webhook Orange Money (HMAC-SHA256)'),
      bullet('Middleware de détection d\'attaques en temps réel (SQLi, XSS, CSRF)'),
      bullet('Séquestre des paiements (escrow) — fonds jamais directement entre les mains du vendeur avant confirmation'),
      bullet('Système de litiges avec gel des fonds en cas de dispute'),
      bullet('Audit logs sur toutes les actions admin'),

      h2('6.3 Scalabilité'),
      p('L\'architecture actuelle supporte jusqu\'à 50 000 requêtes/jour sur Render.com sans modification. Pour la phase de croissance (>100 000 users), la migration vers AWS ou OVH Cloud (présent en Afrique de l\'Ouest) est planifiée avec :'),
      bullet('Base de données PostgreSQL managed (RDS ou Supabase)'),
      bullet('CDN Cloudflare pour les assets statiques et la réduction de latence Afrique'),
      bullet('Celery workers horizontalement scalables via Redis Cluster'),
      bullet('Application mobile React Native (Expo) — déjà développée, en attente de déploiement App Store/Play Store'),
      pageBreak(),

      // ══════════════════════════════
      // 7. PLAN MARKETING
      // ══════════════════════════════
      h1('7. Plan Marketing et Acquisition'),

      h2('7.1 Stratégie d\'acquisition'),
      h3('Canal 1 — Bouche-à-oreille + parrainage (0 GNF)'),
      p('Le programme de parrainage intégré offre 5 000 GNF de crédit plateforme pour chaque nouvel utilisateur invité. Chaque vendeur actif devient un ambassadeur naturel dès que ses acheteurs reçoivent leurs colis à temps grâce à l\'escrow.'),
      h3('Canal 2 — Présence physique marchés (faible coût)'),
      p('Équipe d\'animateurs terrains aux marchés Madina, Kaloum, Kaporo (Conakry) pour aider les vendeurs à créer leurs annonces sur place. Stickers QR Code sur les étals. Coût estimé : 2 000 000 GNF/mois pour 2 animateurs.'),
      h3('Canal 3 — Réseaux sociaux guinéens (Meta + WhatsApp)'),
      p('Facebook reste le principal réseau social en Guinée. Campagnes Meta Ads ciblées : 18–45 ans, Conakry, intérêts commerce/téléphonie/mode. Budget : 3 000 000 GNF/mois. WhatsApp Business pour les annonces flash et l\'animation communauté vendeurs.'),
      h3('Canal 4 — Partenariats Orange Money'),
      p('Négociation d\'une intégration dans l\'application Orange Money / Max it pour apparaître dans la section "Achats". Potentiel de visibilité de 2+ millions d\'utilisateurs Orange Money Guinée sans coût publicitaire direct.'),
      h3('Canal 5 — Radio + presse locale'),
      p('Spots radio sur Espace FM, Djoma FM, Familia FM — stations leaders à Conakry. Coût : 1 500 000 GNF/mois pour 5 spots/jour. Partenariat éditorial avec Guinée Matin et Guineenews pour des articles sur le commerce digital.'),

      h2('7.2 Rétention'),
      bullet('Notifications push personnalisées (nouveautés dans les catégories favorites)'),
      bullet('Programme de fidélité : badges Bronze / Argent / Or selon l\'activité'),
      bullet('Alertes prix : notification automatique si une annonce favorisée baisse de prix'),
      bullet('Newsletter SMS mensuelle avec les meilleures offres'),
      pageBreak(),

      // ══════════════════════════════
      // 8. ORGANISATION ET ÉQUIPE
      // ══════════════════════════════
      h1('8. Organisation et Équipe'),

      h2('8.1 Structure actuelle'),
      twoColTable([
        ['Fondateur / CTO', 'Développement full-stack, architecture technique, opérations'],
        ['Support client (à recruter)', 'Gestion des litiges, validation manuelle des annonces sensibles'],
        ['Animateurs terrain (à recruter)', '2 personnes à Conakry pour l\'onboarding des vendeurs'],
        ['Community manager (à recruter)', 'Réseaux sociaux, WhatsApp Business, relations presse'],
      ]),

      h2('8.2 Plan de recrutement (Année 1)'),
      bullet('Q3 2026 : Responsable support client + modération (150 000 GNF/mois)'),
      bullet('Q3 2026 : 2 animateurs terrains à temps partiel (100 000 GNF/mois chacun)'),
      bullet('Q4 2026 : Community Manager (120 000 GNF/mois)'),
      bullet('Q1 2027 : Développeur backend junior (200 000 GNF/mois)'),

      h2('8.3 Structure juridique'),
      p('Constitution en SARL (Société à Responsabilité Limitée) selon le droit OHADA applicable en Guinée. Enregistrement auprès du Registre de Commerce et du Crédit Mobilier (RCCM) de Conakry. Capital social initial : 50 000 000 GNF.'),
      p('Obligations fiscales : TVA 18 % sur les commissions perçues, IS 35 % sur bénéfices nets, retenues à la source sur paiements mobile money conformément au code fiscal guinéen.'),
      pageBreak(),

      // ══════════════════════════════
      // 9. PLAN D'INVESTISSEMENT
      // ══════════════════════════════
      h1('9. Plan d\'Investissement'),

      h2('9.1 Utilisation des fonds (500 000 000 GNF)'),
      spacer(),
      threeColTable(
        ['Poste', 'Montant (GNF)', 'Pourcentage'],
        [
          ['Marketing & Acquisition (Année 1)', '180 000 000', '36 %'],
          ['Équipe (salaires 12 mois)', '120 000 000', '24 %'],
          ['Infrastructure technique (serveurs, API, CDN)', '60 000 000', '12 %'],
          ['Juridique & Conformité', '40 000 000', '8 %'],
          ['Opérations terrain (animateurs, matériel)', '50 000 000', '10 %'],
          ['Réserve de trésorerie', '50 000 000', '10 %'],
          ['TOTAL', '500 000 000', '100 %'],
        ]
      ),

      h2('9.2 Retour sur investissement prévu'),
      bullet('Seuil de rentabilité opérationnel : fin Q3 2027 (18 mois post-investissement)'),
      bullet('ROI investisseur : ×3 en 3 ans basé sur projections GMV Année 3'),
      bullet('Possibilité de sortie : acquisition par opérateur télécoms (Orange, MTN) ou fonds africains (Partech Africa, Timon Capital)'),
      pageBreak(),

      // ══════════════════════════════
      // 10. FEUILLE DE ROUTE
      // ══════════════════════════════
      h1('10. Feuille de Route (2026–2028)'),
      spacer(),
      threeColTable(
        ['Phase', 'Période', 'Objectifs clés'],
        [
          ['Phase 1 — Lancement', 'Q1–Q2 2026', '500 vendeurs, 2 000 acheteurs, Conakry uniquement, modération 100 % IA, Orange Money live'],
          ['Phase 2 — Croissance', 'Q3–Q4 2026', '2 000 vendeurs, 15 000 acheteurs, expansion villes secondaires (Labé, Kankan, Nzérékoré), application mobile Play Store'],
          ['Phase 3 — Monétisation', 'Q1–Q2 2027', 'Abonnements Pro/Premium actifs, première rentabilité mensuelle, partenariat Orange Money officiel'],
          ['Phase 4 — Expansion régionale', 'Q3 2027–Q4 2028', 'Ouverture Côte d\'Ivoire et Sénégal, GMV 30 Md GNF, équipe 15 personnes, Série B'],
        ]
      ),
      spacer(),
      p('Jalons techniques déjà validés en production :'),
      bullet('✅ Marketplace complète : annonces, recherche, filtres, catégories, sous-catégories'),
      bullet('✅ Paiement Orange Money avec escrow intelligent (6h/48h selon montant)'),
      bullet('✅ Modération IA automatique (Claude) avec notification vendeur'),
      bullet('✅ Messagerie temps réel acheteur ↔ vendeur (WebSocket)'),
      bullet('✅ PWA installable + notifications push'),
      bullet('✅ Système d\'avis et évaluations vendeurs'),
      bullet('✅ Boutiques personnalisées avec analytics'),
      bullet('✅ Panel admin complet avec gestion litiges et bannières'),
      bullet('✅ Application mobile React Native (Expo) développée'),
      bullet('✅ Chatbot support IA 24h/24 (Claude)'),
      bullet('✅ Programme de parrainage avec récompenses'),
      bullet('⏳ Partenariat officiel Orange Money Guinée — en cours'),
      bullet('⏳ Déploiement App Store iOS + Google Play Store'),
      bullet('⏳ Expansion villes secondaires (Q3 2026)'),
      pageBreak(),

      // ══════════════════════════════
      // 11. RISQUES ET MITIGATION
      // ══════════════════════════════
      h1('11. Risques et Mitigation'),
      spacer(),
      threeColTable(
        ['Risque', 'Probabilité', 'Mitigation'],
        [
          ['Instabilité internet / coupures fréquentes', 'Élevée', 'PWA offline-first, synchronisation différée, cache local agressif'],
          ['Fraude et faux vendeurs', 'Élevée', 'Modération IA, vérification OTP, escrow, système de signalement'],
          ['Résistance au changement des commerçants', 'Moyenne', 'Animateurs terrain, interface ultra-simple, onboarding en 5 minutes'],
          ['Arrivée de Jumia Guinée ou concurrent international', 'Faible–Moyenne', 'Avantage local (langue, UX, réseau), ancrage communautaire'],
          ['Modification API Orange Money', 'Faible', 'Architecture webhook modulaire, contrat partenaire officiel visé'],
          ['Délais de paiement / déboursement vendeurs', 'Moyenne', 'Politique de reversement J+2 ouvrable, support dédié'],
        ]
      ),
      spacer(),

      // ══════════════════════════════
      // 12. ANNEXE — ARCHITECTURE API
      // ══════════════════════════════
      h1('12. Annexe — Documentation API Principale'),

      h2('12.1 Authentification'),
      twoColTable([
        ['POST /auth/register/', 'Inscription par numéro de téléphone + OTP SMS'],
        ['POST /auth/verify-otp/', 'Vérification OTP (inscription ou réinitialisation)'],
        ['POST /auth/login/', 'Connexion → retourne access_token + refresh_token (JWT)'],
        ['POST /auth/forgot-password/', 'Envoi OTP de réinitialisation par SMS'],
        ['POST /auth/reset-password/', 'Réinitialisation mot de passe via OTP vérifié'],
        ['GET /auth/me/', 'Profil utilisateur connecté'],
        ['PATCH /auth/me/', 'Mise à jour profil (photo, nom, ville)'],
      ]),

      h2('12.2 Annonces'),
      twoColTable([
        ['GET /listings/', 'Liste paginée avec filtres (q, city, category, min_price, max_price)'],
        ['POST /listings/', 'Créer une annonce (déclenche modération IA async)'],
        ['GET /listings/{id}/', 'Détail annonce + incrémentation vues'],
        ['GET /listings/my/', 'Mes annonces (vendeur authentifié)'],
        ['POST /listings/admin/listings/{id}/approve/', 'Admin : approuver une annonce'],
        ['POST /listings/admin/listings/{id}/reject/', 'Admin : refuser avec raison (notifie vendeur)'],
      ]),

      h2('12.3 Commandes et Escrow'),
      twoColTable([
        ['POST /orders/', 'Créer une commande (initie paiement Orange Money)'],
        ['GET /orders/{id}/', 'Détail commande avec statut escrow'],
        ['POST /orders/{id}/confirm-receipt/', 'Acheteur confirme réception → libère escrow vendeur'],
        ['POST /orders/{id}/dispute/', 'Acheteur ouvre un litige → gel des fonds'],
        ['GET /payments/escrow/', 'Admin : liste des paiements en séquestre'],
        ['POST /payments/escrow/{id}/hold/', 'Admin : mettre en attente manuelle'],
      ]),

      spacer(),
      new Paragraph({
        spacing: { before: 480, after: 80 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: '1A5C2A', space: 4 } },
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'GuinéeMarché — Bâtissons ensemble le commerce de demain en Guinée', italics: true, font: 'Arial', size: 22, color: '444444' }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'Contact : guineemarche@gmail.com | guineemarche-frontend.onrender.com', font: 'Arial', size: 20, color: '666666' }),
        ],
      }),
    ],
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('GuineeMarche_Business_Plan_2026.docx', buffer);
  console.log('✅ Business plan créé : GuineeMarche_Business_Plan_2026.docx');
}).catch(err => {
  console.error('❌ Erreur :', err);
});
