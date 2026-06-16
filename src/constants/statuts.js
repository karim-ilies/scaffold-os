export const STATUTS_CHANTIER = {
  EN_ATTENTE: 'en_attente',
  EN_COURS:   'en_cours',
  TERMINE:    'termine',
  ANNULE:     'annule',
}

export const STATUTS_FACTURE = {
  BROUILLON: 'brouillon',
  ENVOYEE:   'envoyee',
  PAYEE:     'payee',
  ANNULEE:   'annulee',
  AVOIR:     'avoir',
}

export const STATUTS_DEVIS = {
  BROUILLON: 'brouillon',
  ENVOYE:    'envoye',
  ACCEPTE:   'accepte',
  REFUSE:    'refuse',
  EXPIRE:    'expire',
}

export const STATUTS_PERSONNEL = {
  ACTIF:   true,
  INACTIF: false,
}

export const STATUTS_POINTAGE = {
  EN_COURS:   'en_cours',
  A_VERIFIER: 'a_verifier',
  VALIDE:     'valide',
  REJETE:     'rejete',
}

export const STATUTS_TICKET = {
  EN_ATTENTE: 'en_attente',
  VALIDE:     'valide',
  REMBOURSE:  'rembourse',
  REFUSE:     'refuse',
}

export const ROLES = {
  PATRON:      'patron',
  CHEF_EQUIPE: 'chef_equipe',
  OUVRIER:     'ouvrier',
  COMPTABLE:   'comptable',
}

export const ROLES_LABELS = {
  patron:      'Patron',
  chef_equipe: 'Chef d\'équipe',
  ouvrier:     'Ouvrier',
  comptable:   'Comptable',
}

export const TYPES_CHANTIER = {
  NEUF:       'neuf',
  RENOVATION: 'renovation',
  LOCATION:   'location',
}

export const TYPES_CLIENT = {
  PARTICULIER: 'particulier',
  PRO:         'pro',
}

export const CATEGORIES_STOCK = [
  'cadres', 'planches', 'tubes', 'pieds', 'filets', 'autre',
]

export const CATEGORIES_STOCK_LABELS = {
  cadres:    'Cadres',
  planches:  'Planches',
  tubes:     'Tubes',
  pieds:     'Pieds réglables',
  filets:    'Filets de protection',
  autre:     'Autre',
}

export const TYPES_LIGNE_FACTURE = {
  REGIE:    'regie',
  FORFAIT:  'forfait',
  LOCATION: 'location',
}

export const MODES_PAIEMENT = {
  VIREMENT: 'virement',
  CHEQUE:   'cheque',
  ESPECES:  'especes',
}

export const TYPES_CONTRAT = {
  CDI:    'CDI',
  CDD:    'CDD',
  INTERIM:'interim',
}

export const TYPES_TICKET = {
  CARBURANT: 'carburant',
  MATERIAU:  'materiau',
  REPAS:     'repas',
  AUTRE:     'autre',
}

export const ETAT_STOCK = {
  BON:         'bon',
  USAGE:       'usage',
  MAINTENANCE: 'maintenance',
  REBUT:       'rebut',
}
