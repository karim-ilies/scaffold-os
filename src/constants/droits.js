export const DROITS = {
  // Fiche ouvrier
  VOIR_FICHE_COMPLETE:   ['patron'],
  VOIR_FICHE_BASIQUE:    ['patron', 'chef_equipe'],
  MODIFIER_OUVRIER:      ['patron'],
  SUPPRIMER_OUVRIER:     ['patron'],
  DESACTIVER_OUVRIER:    ['patron'],
  INVITER_OUVRIER:       ['patron'],

  // Pointage
  POINTER_SOI_MEME:      ['patron', 'chef_equipe', 'ouvrier'],
  VOIR_SON_POINTAGE:     ['patron', 'chef_equipe', 'ouvrier'],
  VOIR_POINTAGE_EQUIPE:  ['patron', 'chef_equipe'],
  MODIFIER_POINTAGE:     ['patron'],
  VALIDER_POINTAGE:      ['patron'],
  VOIR_GPS_EQUIPE:       ['patron'],

  // Paie — jamais visible par chef_equipe ni ouvrier
  VOIR_BULLETIN:         ['patron'],
  MODIFIER_BULLETIN:     ['patron'],
  VOIR_TAUX_FACTURATION: ['patron', 'comptable'],
  VOIR_SALAIRE:          ['patron'],
  VOIR_IBAN_SECU:        ['patron'],
  AJOUTER_PRIME:         ['patron'],
  AJOUTER_ACOMPTE:       ['patron'],

  // Factures / Devis
  VOIR_FACTURES:         ['patron', 'comptable'],
  CREER_FACTURE:         ['patron'],
  VOIR_MONTANTS:         ['patron', 'comptable'],

  // Comptabilité
  VOIR_COMPTABILITE:     ['patron', 'comptable'],
  EXPORTER_FEC:          ['patron', 'comptable'],

  // Stock
  VOIR_STOCK:            ['patron', 'chef_equipe'],
  MODIFIER_STOCK:        ['patron'],

  // Paramètres
  MODIFIER_PARAMETRES:   ['patron'],
  GERER_UTILISATEURS:    ['patron'],
  VOIR_ARCHIVES:         ['patron'],
  PURGER_ARCHIVES:       ['patron'],
}

export function peutFaire(role, droit) {
  return (DROITS[droit] || []).includes(role)
}
