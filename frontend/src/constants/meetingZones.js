/**
 * Zones de rencontre pour la remise en main propre.
 * Pour ajouter une ville ou un quartier : ajoutez simplement une entrée ici.
 */
export const MEETING_ZONES = {
    // ── Conakry (par commune) ────────────────────────────────────────────────
    Conakry: [
        // Kaloum
        'Centre Commercial Kaloum',
        'Boulbinet — Marché',
        'Port de Conakry',
        // Dixinn
        'Coleah Centre',
        'Belle-Vue',
        'Dixinn Centre',
        // Matam
        'Marché Madina',
        'Carrefour Hamdallaye',
        'Carrefour Bambéto',
        // Ratoma
        'Carrefour Kipé',
        'Carrefour Cosa',
        'Carrefour Kaporo',
        'Sonfonia Centre',
        'Wanindara Carrefour',
        'Gbessia Port',
        // Matoto
        'Carrefour Matoto',
        'Kobaya Centre',
        'Kagbelen Centre',
        'Carrefour Enta',
    ],

    // ── Kindia ───────────────────────────────────────────────────────────────
    Kindia: [
        'Grand Marché de Kindia',
        'Carrefour Central Kindia',
        'Gare Routière de Kindia',
    ],

    // ── Mamou ────────────────────────────────────────────────────────────────
    Mamou: [
        'Grand Marché de Mamou',
        'Carrefour Central Mamou',
        'Gare Routière de Mamou',
    ],

    // ── Labé ─────────────────────────────────────────────────────────────────
    Labé: [
        'Grand Marché de Labé',
        'Carrefour Central Labé',
        'Gare Routière de Labé',
        'Tata Centre',
    ],

    // ── Kankan ───────────────────────────────────────────────────────────────
    Kankan: [
        'Grand Marché de Kankan',
        'Carrefour Central Kankan',
        'Gare Routière de Kankan',
        'Quartier Farako',
    ],

    // ── Faranah ──────────────────────────────────────────────────────────────
    Faranah: [
        'Grand Marché de Faranah',
        'Carrefour Central Faranah',
        'Gare Routière de Faranah',
    ],

    // ── Kissidougou ──────────────────────────────────────────────────────────
    Kissidougou: [
        'Grand Marché de Kissidougou',
        'Carrefour Central Kissidougou',
    ],

    // ── Guéckédou ────────────────────────────────────────────────────────────
    'Guéckédou': [
        'Grand Marché de Guéckédou',
        'Carrefour Central Guéckédou',
    ],

    // ── Macenta ──────────────────────────────────────────────────────────────
    Macenta: [
        'Grand Marché de Macenta',
        'Carrefour Central Macenta',
    ],

    // ── Nzérékoré ────────────────────────────────────────────────────────────
    'Nzérékoré': [
        'Grand Marché de Nzérékoré',
        'Carrefour Central Nzérékoré',
        'Quartier Yomou',
        'Gare Routière Nzérékoré',
    ],

    // ── Boké ─────────────────────────────────────────────────────────────────
    Boké: [
        'Grand Marché de Boké',
        'Carrefour Central Boké',
    ],

    // ── Fria ─────────────────────────────────────────────────────────────────
    Fria: [
        'Carrefour de Fria',
        'Grand Marché de Fria',
    ],

    // ── Coyah ────────────────────────────────────────────────────────────────
    Coyah: [
        'Carrefour de Coyah',
        'Grand Marché de Coyah',
    ],

    // ── Dubréka ──────────────────────────────────────────────────────────────
    'Dubréka': [
        'Grand Marché de Dubréka',
        'Carrefour Central Dubréka',
    ],

    // ── Télimélé ─────────────────────────────────────────────────────────────
    'Télimélé': [
        'Grand Marché de Télimélé',
    ],

    // ── Pita ─────────────────────────────────────────────────────────────────
    Pita: [
        'Grand Marché de Pita',
        'Carrefour Pita Centre',
    ],

    // ── Dinguiraye ───────────────────────────────────────────────────────────
    Dinguiraye: [
        'Grand Marché de Dinguiraye',
    ],

    // ── Siguiri ──────────────────────────────────────────────────────────────
    Siguiri: [
        'Grand Marché de Siguiri',
        'Carrefour Siguiri Centre',
    ],

    // ── Kérouané ─────────────────────────────────────────────────────────────
    'Kérouané': [
        'Grand Marché de Kérouané',
    ],

    // ── Koundara ─────────────────────────────────────────────────────────────
    Koundara: [
        'Grand Marché de Koundara',
    ],

    // ── Gaoual ───────────────────────────────────────────────────────────────
    Gaoual: [
        'Grand Marché de Gaoual',
    ],
}

/** Toutes les villes disponibles, triées alphabétiquement. */
export const VILLES_GUINEE = ['', ...Object.keys(MEETING_ZONES).sort()]
