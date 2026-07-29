import { useState } from 'react'
import { Link } from 'react-router-dom'

const TABS = [
    { id: 'cgu',           label: "📜 Conditions d'utilisation" },
    { id: 'privacy',       label: '🔒 Confidentialité' },
    { id: 'refund',        label: '💰 Remboursements & Litiges' },
    { id: 'decharge',      label: '⚠️ Biens interdits & Décharge' },
]

export default function TermsPage() {
    const [active, setActive] = useState('cgu')

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
                <Link to="/" className="text-gray-500 hover:text-gray-700">←</Link>
                <div>
                    <h1 className="font-bold text-gray-900">Politiques & Conditions</h1>
                    <p className="text-xs text-gray-500">Dernière mise à jour : juillet 2026</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b overflow-x-auto">
                <div className="flex min-w-max px-4">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActive(tab.id)}
                            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition ${
                                active === tab.id
                                    ? 'border-green-600 text-green-700'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 text-sm text-gray-700 leading-relaxed">
                {active === 'cgu' && <CGU />}
                {active === 'privacy' && <Privacy />}
                {active === 'refund' && <Refund />}
                {active === 'decharge' && <Decharge />}
            </div>

            <div className="text-center text-xs text-gray-400 pb-8">
                Guimatrix — Conakry, Guinée · contact@guineemarche.com
            </div>
        </div>
    )
}

// ── Conditions Générales d'Utilisation ────────────────────────────────────────
function CGU() {
    return (
        <div className="space-y-6">
            <Section title="1. Présentation de la plateforme">
                Guimatrix est une place de marché en ligne permettant aux particuliers et
                professionnels basés en Guinée d'acheter et vendre des biens et services.
                La plateforme est éditée et exploitée en Guinée Conakry. En vous inscrivant,
                vous acceptez les présentes conditions dans leur intégralité.
            </Section>

            <Section title="2. Inscription et compte">
                L'inscription est ouverte à toute personne physique majeure (18 ans et plus)
                ou morale disposant d'un numéro de téléphone guinéen valide. Vous êtes
                responsable de la confidentialité de votre mot de passe et de toutes les
                actions effectuées depuis votre compte. Tout compte créé avec de fausses
                informations peut être suspendu sans préavis.
            </Section>

            <Section title="3. Publication d'annonces">
                <p>Toute annonce publiée sur Guimatrix doit :</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Décrire fidèlement l'article ou le service proposé</li>
                    <li>Utiliser des photos réelles du produit mis en vente</li>
                    <li>Indiquer un prix en francs guinéens (GNF)</li>
                    <li>Respecter la loi guinéenne (pas d'articles illicites, volés ou contrefaits)</li>
                </ul>
                <p className="mt-2">
                    Les annonces sont soumises à une modération automatique (IA) et manuelle.
                    Guimatrix se réserve le droit de rejeter ou supprimer toute annonce
                    non conforme, sans obligation de justification.
                </p>
                <p className="mt-2 font-semibold text-red-700">
                    ⚠️ La vente de biens volés, contrefaits ou illégalement obtenus est
                    formellement prohibée et constitue une infraction pénale grave. Consultez
                    l'onglet "⚠️ Biens interdits & Décharge" pour les détails complets.
                </p>
            </Section>

            <Section title="4. Transactions et paiements">
                Guimatrix propose le paiement via Orange Money ou en espèces lors de la
                remise en main propre. Les paiements via Orange Money sont sécurisés par un
                système d'escrow (rétention temporaire des fonds) décrit dans l'onglet
                "Remboursements & Litiges". La plateforme prélève une commission de 4 % sur
                chaque transaction, déduite du montant reversé au vendeur.
            </Section>

            <Section title="5. Obligations du vendeur">
                <ul className="list-disc pl-5 space-y-1">
                    <li>Répondre aux demandes d'acheteurs dans un délai raisonnable</li>
                    <li>Honorer les ventes confirmées aux conditions annoncées</li>
                    <li>Remettre l'article dans l'état décrit dans l'annonce</li>
                    <li>Ne pas annuler abusivement des transactions déjà payées</li>
                </ul>
            </Section>

            <Section title="6. Obligations de l'acheteur">
                <ul className="list-disc pl-5 space-y-1">
                    <li>Vérifier l'article avant de confirmer la réception</li>
                    <li>Payer le montant convenu dans les délais impartis</li>
                    <li>Signaler tout problème via la procédure de litige de la plateforme</li>
                    <li>Ne pas initier de paiement Orange Money et annuler immédiatement après</li>
                </ul>
            </Section>

            <Section title="7. Comportements interdits">
                Il est strictement interdit de : publier de fausses informations, usurper
                l'identité d'un tiers, harceler d'autres utilisateurs, contourner le système
                de paiement de la plateforme pour éviter les frais, ou utiliser la plateforme
                à des fins frauduleuses. Tout manquement peut entraîner la suspension
                définitive du compte et, le cas échéant, des poursuites judiciaires.
            </Section>

            <Section title="8. Responsabilité de Guimatrix">
                Guimatrix est une plateforme d'intermédiation. Nous ne sommes pas parties
                aux transactions entre acheteurs et vendeurs et ne pouvons garantir la qualité
                ou la conformité des articles vendus. Notre responsabilité est limitée au bon
                fonctionnement des outils de mise en relation et du système de paiement.
            </Section>

            <Section title="9. Modification des conditions">
                Guimatrix se réserve le droit de modifier les présentes conditions à tout
                moment. Les utilisateurs seront informés des changements importants par
                notification in-app. La poursuite de l'utilisation de la plateforme vaut
                acceptation des nouvelles conditions.
            </Section>
        </div>
    )
}

// ── Politique de Confidentialité ──────────────────────────────────────────────
function Privacy() {
    return (
        <div className="space-y-6">
            <Section title="1. Données collectées">
                <p>Lors de votre inscription et utilisation de Guimatrix, nous collectons :</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li><strong>Données d'identité :</strong> nom complet, numéro de téléphone, ville et quartier</li>
                    <li><strong>Données de transaction :</strong> montants, historique des commandes, statuts de paiement</li>
                    <li><strong>Données d'utilisation :</strong> annonces consultées, recherches effectuées, messages échangés</li>
                    <li><strong>Données techniques :</strong> adresse IP, type d'appareil, système d'exploitation</li>
                </ul>
                <p className="mt-2">Nous ne collectons pas de données bancaires. Les paiements Orange Money sont traités directement par Orange Guinée.</p>
            </Section>

            <Section title="2. Utilisation des données">
                <p>Vos données sont utilisées pour :</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Gérer votre compte et sécuriser vos connexions</li>
                    <li>Traiter et suivre vos commandes</li>
                    <li>Vous envoyer des notifications par SMS et in-app (alertes commandes, rappels escrow)</li>
                    <li>Améliorer nos services et détecter les fraudes</li>
                    <li>Vous proposer des annonces pertinentes basées sur votre historique</li>
                </ul>
            </Section>

            <Section title="3. Partage des données">
                Nous ne vendons jamais vos données personnelles. Elles peuvent être partagées
                avec des tiers uniquement dans les cas suivants :
                <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Prestataires techniques nécessaires au fonctionnement (hébergement Render, stockage Cloudinary, SMS via opérateurs)</li>
                    <li>Autorités guinéennes sur réquisition judiciaire</li>
                    <li>La partie adverse dans le cadre d'un litige (nom et téléphone uniquement)</li>
                </ul>
            </Section>

            <Section title="4. Sécurité des données">
                Vos données sont protégées par chiffrement TLS en transit et chiffrées au
                repos dans notre base de données. Les mots de passe sont stockés sous forme
                de hash (bcrypt) et jamais en clair. Notre système de surveillance détecte
                automatiquement les tentatives d'intrusion.
            </Section>

            <Section title="5. Durée de conservation">
                Vos données sont conservées pendant la durée de vie de votre compte, plus
                3 ans après sa fermeture (obligations légales comptables). Les données de
                messagerie sont conservées 2 ans. Vous pouvez demander la suppression de
                votre compte et de vos données en contactant notre support.
            </Section>

            <Section title="6. Vos droits">
                <p>Conformément aux lois applicables, vous disposez des droits suivants :</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li><strong>Accès :</strong> obtenir une copie de vos données</li>
                    <li><strong>Rectification :</strong> corriger des informations inexactes</li>
                    <li><strong>Suppression :</strong> demander l'effacement de votre compte</li>
                    <li><strong>Opposition :</strong> refuser l'utilisation à des fins marketing</li>
                </ul>
                <p className="mt-2">Pour exercer ces droits, contactez-nous à : <strong>contact@guineemarche.com</strong></p>
            </Section>

            <Section title="7. Cookies et traceurs">
                Guimatrix utilise uniquement des cookies techniques strictement nécessaires
                au fonctionnement (session, authentification JWT). Aucun cookie publicitaire
                ou de tracking tiers n'est utilisé.
            </Section>
        </div>
    )
}

// ── Remboursements & Litiges ──────────────────────────────────────────────────
function Refund() {
    return (
        <div className="space-y-6">
            {/* Escrow highlight box */}
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
                <h2 className="font-bold text-orange-800 mb-2">🔒 Protection escrow Guimatrix</h2>
                <p className="text-orange-700 text-sm">
                    Pour vous protéger des annulations de paiement Orange Money, tous les
                    paiements en ligne transitent par notre système d'escrow : les fonds sont
                    retenus temporairement puis libérés automatiquement au vendeur dès la
                    fenêtre d'annulation dépassée.
                </p>
            </div>

            <Section title="1. Comment fonctionne l'escrow ?">
                <p>Lorsqu'un acheteur paie via Orange Money :</p>
                <ol className="list-decimal pl-5 mt-2 space-y-2">
                    <li>Le paiement est initié et les fonds sont <strong>retenus en escrow</strong> sur la plateforme.</li>
                    <li>Le vendeur est informé et peut préparer la livraison.</li>
                    <li>Les fonds sont <strong>libérés automatiquement</strong> selon le montant :</li>
                </ol>
                <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 rounded-xl p-3 text-center">
                        <div className="text-2xl mb-1">⏱️</div>
                        <div className="font-bold text-blue-800">6 heures</div>
                        <div className="text-xs text-blue-600 mt-1">Montants &lt; 500 000 GNF</div>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-3 text-center">
                        <div className="text-2xl mb-1">🔍</div>
                        <div className="font-bold text-purple-800">48 heures</div>
                        <div className="text-xs text-purple-600 mt-1">Montants ≥ 500 000 GNF</div>
                    </div>
                </div>
                <p className="mt-3 text-xs text-gray-500">
                    Ces délais couvrent la fenêtre d'annulation de paiement Orange Money.
                    Passé ce délai, la transaction est définitive et les fonds sont versés
                    au vendeur (moins la commission de 4 %).
                </p>
            </Section>

            <Section title="2. Libération anticipée">
                Si l'acheteur <strong>confirme la réception</strong> avant l'expiration du
                délai, les fonds sont libérés immédiatement au vendeur sans attendre la fin
                du délai. Nous encourageons les acheteurs à confirmer rapidement pour que
                les vendeurs soient payés au plus tôt.
            </Section>

            <Section title="3. Paiement en espèces">
                Pour les paiements en espèces lors d'une remise en main propre, aucun
                escrow n'est appliqué. L'échange se fait directement entre acheteur et
                vendeur. Guimatrix ne peut pas intervenir en cas de litige sur un
                paiement en espèces non passé par la plateforme.
            </Section>

            <Section title="4. Ouvrir un litige">
                <p>Si vous rencontrez un problème avec une commande, vous pouvez ouvrir un litige :</p>
                <ol className="list-decimal pl-5 mt-2 space-y-1">
                    <li>Rendez-vous dans <strong>Mes Commandes</strong></li>
                    <li>Ouvrez la commande concernée et appuyez sur <strong>"Signaler un problème"</strong></li>
                    <li>Les fonds sont immédiatement bloqués en attente d'examen</li>
                    <li>Notre équipe vous contacte dans un délai de 24 à 48 heures</li>
                </ol>
                <p className="mt-2 text-xs text-gray-500">
                    Un litige doit être ouvert avant la confirmation de réception ou avant
                    la libération automatique des fonds.
                </p>
            </Section>

            <Section title="5. Résolution d'un litige">
                <p>Après instruction du dossier, l'administrateur peut :</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li><strong>Libérer les fonds au vendeur</strong> si la livraison est confirmée conforme</li>
                    <li><strong>Rembourser l'acheteur</strong> si le produit n'est pas conforme ou non livré</li>
                </ul>
                <p className="mt-2">
                    La décision de l'administrateur est définitive. Guimatrix s'engage à
                    traiter les litiges de manière équitable, en examinant toutes les preuves
                    disponibles (photos, messages, témoignages).
                </p>
            </Section>

            <Section title="6. Cas de remboursement">
                <p>Un remboursement peut être accordé dans les cas suivants :</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Article non livré et litige ouvert avant la libération des fonds</li>
                    <li>Article significativement différent de la description de l'annonce</li>
                    <li>Fraude avérée du vendeur</li>
                    <li>Double paiement accidentel</li>
                </ul>
                <p className="mt-2 font-medium text-red-700">
                    Aucun remboursement n'est possible après confirmation de réception par l'acheteur ou après libération automatique des fonds.
                </p>
            </Section>

            <Section title="7. Contact support">
                Pour toute question relative à un paiement ou remboursement, contactez-nous :
                <div className="mt-2 flex flex-col gap-2">
                    <a href="https://wa.me/224620000001" className="inline-flex items-center gap-2 text-green-700 font-medium">
                        💬 WhatsApp support
                    </a>
                    <a href="mailto:contact@guineemarche.com" className="inline-flex items-center gap-2 text-green-700 font-medium">
                        ✉️ contact@guineemarche.com
                    </a>
                </div>
            </Section>
        </div>
    )
}

// ── Biens interdits & Décharge de responsabilité ─────────────────────────────
function Decharge() {
    return (
        <div className="space-y-6">
            {/* Bloc d'avertissement principal */}
            <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5">
                <h2 className="font-black text-red-800 text-base mb-2">
                    ⚠️ DÉCHARGE DE RESPONSABILITÉ — BIENS VOLÉS ET ILLICITES
                </h2>
                <p className="text-red-700 text-sm leading-relaxed">
                    Guimatrix est une plateforme technologique d'intermédiation. Elle ne vend,
                    n'achète ni ne détient aucun article. <strong>La totalité de la responsabilité
                    juridique et pénale concernant l'origine des biens mis en vente repose
                    exclusivement sur le vendeur.</strong>
                </p>
            </div>

            <Section title="1. Biens strictement interdits">
                <p>Il est formellement interdit de mettre en vente sur Guimatrix :</p>
                <ul className="list-disc pl-5 mt-2 space-y-1.5">
                    <li><strong>Biens volés</strong> — tout article soustrait frauduleusement à son propriétaire légitime</li>
                    <li><strong>Biens contrefaits</strong> — imitations de marques, faux documents, fausse monnaie</li>
                    <li><strong>Biens illégalement importés</strong> — articles introduits sur le territoire guinéen en contrebande ou sans déclaration douanière</li>
                    <li><strong>Drogues, stupéfiants et substances contrôlées</strong> de toute nature</li>
                    <li><strong>Armes à feu, munitions et explosifs</strong> sans autorisation administrative valide</li>
                    <li><strong>Espèces animales protégées</strong> ou produits dérivés (ivoire, peaux, etc.)</li>
                    <li><strong>Contenus illicites</strong> — matériaux pédopornographiques, incitation à la haine</li>
                    <li>Tout autre bien ou service dont la vente est prohibée par la législation guinéenne en vigueur</li>
                </ul>
                <p className="mt-3 text-xs text-gray-500">
                    Cette liste est non exhaustive. La loi guinéenne fait foi en cas de doute
                    sur le caractère licite d'un article.
                </p>
            </Section>

            <Section title="2. Responsabilité exclusive du vendeur">
                <p>
                    En publiant une annonce sur Guimatrix, <strong>le vendeur déclare et garantit
                    sous sa seule et entière responsabilité</strong> que :
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1.5">
                    <li>Il est le propriétaire légitime du bien mis en vente ou dispose d'un droit de vente explicite</li>
                    <li>Le bien n'est pas issu d'un vol, d'un recel, d'une escroquerie ou de toute autre activité délictuelle</li>
                    <li>Le bien est conforme à la réglementation guinéenne applicable</li>
                    <li>Toutes les informations fournies dans l'annonce sont exactes et véridiques</li>
                </ul>
                <p className="mt-3">
                    Guimatrix <strong>décline toute responsabilité civile et pénale</strong> pour les
                    infractions commises par les vendeurs. En cas de mise en cause judiciaire de
                    la plateforme du fait d'un vendeur, ce dernier s'engage à prendre en charge
                    la défense de Guimatrix et à l'indemniser de tout préjudice subi.
                </p>
            </Section>

            <Section title="3. Coopération avec les autorités judiciaires">
                <p>
                    Guimatrix coopère pleinement et sans délai avec les autorités judiciaires et
                    les forces de l'ordre guinéennes. En cas de réquisition ou de demande officielle,
                    la plateforme communiquera notamment :
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>L'identité complète du vendeur (nom, téléphone, email)</li>
                    <li>L'adresse IP et les données de connexion</li>
                    <li>L'historique des annonces publiées et des transactions effectuées</li>
                    <li>Les messages échangés sur la plateforme</li>
                    <li>Toute autre information utile à l'enquête</li>
                </ul>
                <p className="mt-3 font-semibold text-gray-800">
                    Guimatrix se réserve également le droit de signaler spontanément aux
                    autorités compétentes tout utilisateur dont les activités semblent
                    constituer une infraction pénale, sans notification préalable à l'utilisateur.
                </p>
            </Section>

            <Section title="4. Déclaration sur l'honneur de l'utilisateur">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="font-semibold text-amber-900 mb-2">
                        En s'inscrivant sur Guimatrix, chaque utilisateur déclare solennellement :
                    </p>
                    <ol className="list-decimal pl-5 space-y-2 text-amber-800">
                        <li>
                            Je certifie que les articles que je mettrai en vente sur Guimatrix
                            m'appartiennent légalement ou que je dispose d'un droit de vente valide.
                        </li>
                        <li>
                            Je certifie que ces articles ne sont pas issus d'un vol, d'un recel,
                            d'une escroquerie ou de toute activité illégale.
                        </li>
                        <li>
                            J'ai pris connaissance des sanctions applicables (pénales et
                            suspension de compte) en cas de non-respect de ces engagements.
                        </li>
                        <li>
                            Je comprends que Guimatrix communiquera mes données personnelles aux
                            autorités judiciaires si ma responsabilité est mise en cause.
                        </li>
                    </ol>
                </div>
                <p className="mt-3 text-xs text-gray-500">
                    Cette déclaration constitue un engagement contractuel et a valeur de
                    décharge de responsabilité pour Guimatrix vis-à-vis des infractions
                    commises par les vendeurs.
                </p>
            </Section>

            <Section title="5. Sanctions en cas d'infraction">
                <p>Tout manquement aux présentes règles peut entraîner, cumulativement :</p>
                <ul className="list-disc pl-5 mt-2 space-y-1.5">
                    <li><strong>Suppression immédiate</strong> des annonces concernées</li>
                    <li><strong>Suspension temporaire ou définitive</strong> du compte sans remboursement des frais</li>
                    <li><strong>Blocage des fonds</strong> en escrow jusqu'à résolution du litige</li>
                    <li><strong>Signalement aux forces de l'ordre</strong> guinéennes compétentes</li>
                    <li><strong>Action en justice</strong> pour recouvrement des dommages et intérêts subis par Guimatrix</li>
                </ul>
                <p className="mt-3">
                    Le recel de vol est puni par la loi guinéenne de peines d'emprisonnement
                    et d'amendes. Guimatrix n'accordera aucune protection à ses utilisateurs
                    en infraction avec la loi.
                </p>
            </Section>

            <Section title="6. Limitation de responsabilité de Guimatrix">
                <p>
                    Guimatrix est exclusivement un prestataire de services technologiques
                    (mise en relation, paiement sécurisé, messagerie). La plateforme :
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>N'est pas propriétaire des biens mis en vente</li>
                    <li>Ne réalise pas d'inspection physique des articles</li>
                    <li>Ne peut garantir l'origine de chaque bien publié par ses utilisateurs</li>
                    <li>N'est pas receleur ni complice des infractions commises par ses utilisateurs</li>
                </ul>
                <p className="mt-3">
                    En conséquence, <strong>Guimatrix ne peut être tenue pénalement ou civilement
                    responsable des actes illicites de ses utilisateurs</strong>, dès lors qu'elle
                    n'en avait pas connaissance et qu'elle a agi promptement pour retirer le
                    contenu signalé comme illicite.
                </p>
                <p className="mt-2 text-xs text-gray-500">
                    Ce principe est conforme aux dispositions applicables aux hébergeurs et
                    places de marché numériques (directive e-Commerce et ses équivalents en
                    droit guinéen).
                </p>
            </Section>

            <Section title="7. Signaler un article suspect">
                <p>
                    Si vous suspectez qu'un article mis en vente est volé ou illicite,
                    signalez-le immédiatement :
                </p>
                <div className="mt-3 flex flex-col gap-2">
                    <a href="mailto:contact@guineemarche.com?subject=Signalement%20article%20suspect" className="inline-flex items-center gap-2 text-red-700 font-medium hover:underline">
                        ✉️ contact@guineemarche.com — objet : "Signalement article suspect"
                    </a>
                    <a href="https://wa.me/224620000001" className="inline-flex items-center gap-2 text-green-700 font-medium hover:underline">
                        💬 WhatsApp support Guimatrix
                    </a>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                    Tout signalement de bonne foi est traité en priorité. L'identité du
                    signalant est protégée et ne sera pas communiquée au vendeur signalé.
                </p>
            </Section>
        </div>
    )
}

// ── Helper ────────────────────────────────────────────────────────────────────
function Section({ title, children }) {
    return (
        <div>
            <h2 className="font-bold text-gray-900 mb-2">{title}</h2>
            <div className="text-gray-700 space-y-2">{children}</div>
        </div>
    )
}
