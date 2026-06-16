/**
 * Schéma Firestore Scaffold-OS — documentation et structure de référence.
 * Ce fichier ne contient pas de logique d'exécution, uniquement des commentaires
 * et des objets de référence pour les développeurs.
 */

export const SCHEMA = {
  /**
   * users/{uid}
   */
  user: {
    nom:            '',
    prenom:         '',
    photo:          null,
    dateNaissance:  '',
    telephone:      '',
    adresse:        { rue: '', cp: '', ville: '' },
    contactUrgence: { nom: '', telephone: '', lien: '' },
    role:           'ouvrier', // patron | chef_equipe | ouvrier | comptable
    actif:          true,
    dateInvitation: null,
    dateInscription: null,
    gpsAutorise:    false,
    typeContrat:    'CDI',  // CDI | CDD | interim
    dateDebut:      '',
    dateFin:        null,
    modePaiement:   'mensuel', // mensuel | journalier
    salaireBrut:    0,
    tauxJournalier: 0,        // CONFIDENTIEL — patron uniquement
    numeroSecu:     '',       // chiffré CryptoJS
    iban:           '',       // chiffré CryptoJS
    documents:      [],
    createdAt:      null,
    updatedAt:      null,
  },

  /**
   * clients/{clientId}
   */
  client: {
    nom:                '',
    type:               'particulier', // particulier | pro
    siret:              '',
    adresse:            { rue: '', cp: '', ville: '' },
    contact:            { nom: '', tel: '', email: '' },
    tvaIntracom:        '',
    regimeTVADefaut:    'normal', // normal | reduit | autoliquidation
    notes:              '',
    createdAt:          null,
  },

  /**
   * chantiers/{chantierId}
   */
  chantier: {
    nom:              '',
    clientId:         '',
    adresse:          { rue: '', cp: '', ville: '', lat: null, lng: null },
    statut:           'en_attente', // en_attente | en_cours | termine | annule
    dateDebut:        null,
    dateFin:          null,
    dateFin_reelle:   null,
    chefEquipeId:     '',
    description:      '',
    typeChantier:     'neuf', // neuf | renovation | location
    materielAffecte:  [],     // [{ stockItemId, quantite }]
    photos:           [],
    notes:            '',
    createdAt:        null,
  },

  /**
   * factures/{factureId}
   */
  facture: {
    numero:         '',    // FAC-2025-042
    clientId:       '',
    chantierId:     '',
    statut:         'brouillon', // brouillon | envoyee | payee | annulee | avoir
    dateEmission:   null,
    dateEcheance:   null,
    lignes:         [],
    regimeTVA:      'normal', // normal | reduit | autoliquidation
    mentionLegale:  null,
    totalHT:        0,
    totalTVA:       0,
    totalTTC:       0,
    totalPaye:      0,
    solde:          0,
    paiements:      [],
    devisId:        null,
    pdfUrl:         null,
    notes:          '',
    createdAt:      null,
    updatedAt:      null,
  },

  /**
   * Ligne de facture/devis
   */
  ligne: {
    id:               '',
    type:             'regie', // regie | forfait | location
    description:      '',
    // Type regie
    nbOuvriers:       0,
    nbJours:          0,
    tauxJournalier:   0,
    // Type forfait / location
    quantite:         0,
    prixUnitaireHT:   0,
    // Calculés + dénormalisés
    montantHT:        0,
    tauxTVA:          0.20,
    montantTVA:       0,
    montantTTC:       0,
  },

  /**
   * devis/{devisId}
   */
  devis: {
    numero:         '',    // DEV-2025-018
    clientId:       '',
    chantierId:     '',
    statut:         'brouillon', // brouillon | envoye | accepte | refuse | expire
    dateEmission:   null,
    dateEcheance:   null,
    dateValidite:   null,
    lignes:         [],
    regimeTVA:      'normal',
    mentionLegale:  null,
    totalHT:        0,
    totalTVA:       0,
    totalTTC:       0,
    factureId:      null,
    notes:          '',
    createdAt:      null,
    updatedAt:      null,
  },

  /**
   * pointages/{pointageId}
   */
  pointage: {
    ouvrierId:          '',
    chantierId:         '',
    chantierAdresse:    { lat: null, lng: null },
    date:               '', // "2025-06-04"
    heureDebut:         '', // "07:30"
    heureFin:           null,
    heuresTravaillees:  0,
    pause:              60, // minutes
    heuresSupp:         0,
    tracesGPS:          [],
    statut:             'en_cours', // en_cours | a_verifier | valide | rejete
    validePar:          null,
    dateValidation:     null,
    notePatron:         null,
    syncStatus:         'synced', // synced | pending
    createdOffline:     false,
    createdAt:          null,
    updatedAt:          null,
  },

  /**
   * stock/{stockId}
   */
  stockItem: {
    nom:                '',
    categorie:          'cadres', // cadres | planches | tubes | pieds | filets | autre
    quantiteTotale:     0,
    quantiteDisponible: 0,
    quantiteMin:        0,
    etat:               'bon', // bon | usage | maintenance | rebut
    prixAchat:          0,
    notes:              '',
    updatedAt:          null,
  },

  /**
   * tickets/{ticketId}
   */
  ticket: {
    type:         'autre', // carburant | materiau | repas | autre
    chantierId:   '',
    ouvrierId:    '',
    date:         null,
    montant:      0,
    description:  '',
    photoUrl:     '',
    statut:       'en_attente', // en_attente | valide | rembourse | refuse
    createdAt:    null,
  },

  /**
   * invitations/{token}
   */
  invitation: {
    token:         '',
    telephone:     '',
    nom:           '',
    prenom:        '',
    role:          '',
    entrepriseNom: '',
    creePar:       '',
    statut:        'en_attente', // en_attente | accepte | expire
    expiresAt:     null,
    createdAt:     null,
  },

  /**
   * fiches_mensuelles/{ouvrierId_annee_mois}
   */
  ficheMensuelle: {
    ouvrierId:            '',
    mois:                 '', // "2025-06"
    nomOuvrier:           '',
    jours:                {},
    totalJoursTravailles: 0,
    totalJoursAbsents:    0,
    totalHeuresNormales:  0,
    totalHeuresSupp25:    0,
    totalHeuresSupp50:    0,
    bulletin: {
      salaireBase:       0,
      montantSupp25:     0,
      montantSupp50:     0,
      primes:            [],
      indemniteRepas:    0,
      indemniteTrajet:   0,
      acomptes:          [],
      ajustementsPatron: [],
      totalBrut:         0,
      totalAcomptes:     0,
      resteAVerser:      0,
      statut:            'brouillon', // brouillon | valide | paye
      datePaiement:      null,
      modePaiement:      'virement',
    },
    createdAt: null,
    updatedAt: null,
  },

  /**
   * parametres/societe (document unique)
   */
  parametresSociete: {
    raisonSociale:       '',
    siret:               '',
    tvaIntracom:         '',
    adresse:             { rue: '', cp: '', ville: '' },
    telephone:           '',
    email:               '',
    siteWeb:             '',
    logoUrl:             null,
    iban:                '',
    prefixeFactures:     'FAC',
    prefixeDevis:        'DEV',
    compteurFactures:    1,
    compteurDevis:       1,
    tauxJournauxDefaut:  { ouvrier: 220, chefEquipe: 280, technicien: 250 },
    delaiPaiementJours:  30,
    penalitesRetard:     'Pénalités de retard : 3 fois le taux légal en vigueur.',
    conditionsGenerales: '',
    tauxRepasJour:       10,
    tauxTrajetJour:      8,
    updatedAt:           null,
  },
}

export default SCHEMA
