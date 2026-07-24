/**
 * Communes / quartiers de Guinée par ville.
 * Utilisé dans l'inscription, la création d'annonce et la commande.
 */
export const COMMUNES_PAR_VILLE = {
  'Conakry':    ['Kaloum', 'Dixinn', 'Matam', 'Ratoma', 'Matoto'],
  'Kindia':     ['Kindia Centre', 'Coyah', 'Dubréka', 'Forécariah', 'Fria', 'Télimélé'],
  'Boké':       ['Boké Centre', 'Boffa', 'Fria', 'Gaoual', 'Koundara', 'Mali'],
  'Labé':       ['Labé Centre', 'Dalaba', 'Lélouma', 'Mali', 'Pita', 'Tougué'],
  'Mamou':      ['Mamou Centre', 'Dalaba', 'Pita'],
  'Kankan':     ['Kankan Centre', 'Kérouané', 'Kouroussa', 'Mandiana', 'Siguiri'],
  'Siguiri':    ['Siguiri Centre', 'Doko', 'Kintinian', 'Nounkounkan'],
  'Faranah':    ['Faranah Centre', 'Dabola', 'Dinguiraye', 'Kissidougou'],
  'Nzérékoué': ['Nzérékoué Centre', 'Beyla', 'Guéckédou', 'Lola', 'Macenta', 'Yomou'],
  'Coyah':      ['Coyah Centre', 'Manéah', 'Wonkifong'],
}

export const VILLES = Object.keys(COMMUNES_PAR_VILLE)

export function getCommunesByVille(ville) {
  return COMMUNES_PAR_VILLE[ville] || []
}
