/**
 * Villes et quartiers/communes de Guinée — version mobile.
 * Identique à frontend/src/constants/communes.js
 */
export const COMMUNES_PAR_VILLE = {
  // ── Grande Conakry ────────────────────────────────────────────────
  'Conakry': ['Kaloum', 'Dixinn', 'Matam', 'Ratoma', 'Matoto'],
  'Coyah':   ['Coyah Centre', 'Manéah', 'Wonkifong'],
  'Dubreka': ['Dubreka Centre', 'Farmoriah', 'Khorira', 'Tanènè'],

  // ── Régions ──────────────────────────────────────────────────────
  'Boké':      ['Boké Centre', 'Boffa', 'Gaoual', 'Koundara'],
  'Faranah':   ['Faranah Centre', 'Dabola', 'Dinguiraye', 'Kissidougou'],
  'Kankan':    ['Kankan Centre', 'Kérouané', 'Kouroussa', 'Mandiana'],
  'Kindia':    ['Kindia Centre', 'Forécariah', 'Fria', 'Télimélé'],
  'Labé':      ['Labé Centre', 'Dalaba', 'Lélouma', 'Pita', 'Tougué'],
  'Mamou':     ['Mamou Centre', 'Dalaba', 'Pita'],
  'Nzérékoré': ['Nzérékoré Centre', 'Beyla', 'Guéckédou', 'Lola', 'Macenta', 'Yomou'],
  'Siguiri':   ['Siguiri Centre', 'Doko', 'Kintinian', 'Nounkounkan'],
}

export const VILLES = Object.keys(COMMUNES_PAR_VILLE)

export function getCommunesByVille(ville) {
  return COMMUNES_PAR_VILLE[ville] || []
}
