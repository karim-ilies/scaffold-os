function parseHeure(str) {
  if (!str) return 0
  const [h, m] = str.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function calculerHeuresJour(heureDebut, heureFin, pauseMin = 60) {
  const debut  = parseHeure(heureDebut)
  const fin    = parseHeure(heureFin)
  const duree  = (fin - debut - pauseMin) / 60

  if (duree <= 0) return { heuresTravaillees: 0, heuresNormales: 0, heuresSupp25: 0, heuresSupp50: 0 }

  const heuresNormales = Math.min(duree, 8)
  const extra          = Math.max(duree - 8, 0)
  const heuresSupp25   = Math.min(extra, 8)
  const heuresSupp50   = Math.max(extra - 8, 0)

  return {
    heuresTravaillees: Math.round(duree      * 100) / 100,
    heuresNormales:    Math.round(heuresNormales * 100) / 100,
    heuresSupp25:      Math.round(heuresSupp25   * 100) / 100,
    heuresSupp50:      Math.round(heuresSupp50   * 100) / 100,
  }
}

export function calculerBulletin(fiche, ouvrier, parametres) {
  const jours       = Object.values(fiche.jours || {})
  const joursActifs = jours.filter(j => j.heuresTravaillees > 0)
  const nbJours     = joursActifs.length
  const nbJoursNuit = joursActifs.filter(j => j.typeHoraire === 'nuit').length
  const nbJoursJour = nbJours - nbJoursNuit

  const salaireBase = ouvrier.modePaiement === 'journalier'
    ? nbJoursJour * (ouvrier.salaireBrut     || 0)
    + nbJoursNuit * (ouvrier.salaireBrutNuit || ouvrier.salaireBrut || 0)
    : (ouvrier.salaireBrut || 0)

  const tauxHoraire = ouvrier.modePaiement === 'journalier'
    ? (ouvrier.salaireBrut || 0) / 8
    : (ouvrier.salaireBrut || 0) / 151.67
  const montantSupp25 = (fiche.totalHeuresSupp25 || 0) * tauxHoraire * 1.25
  const montantSupp50 = (fiche.totalHeuresSupp50 || 0) * tauxHoraire * 1.50

  const indemniteRepas  = nbJours * (parametres?.tauxRepasJour  || 0)
  const indemniteTrajet = nbJours * (parametres?.tauxTrajetJour || 0)

  const bulletin       = fiche.bulletin || {}
  const totalPrimes    = (bulletin.primes            || []).reduce((s, p) => s + (p.montant || 0), 0)
  const totalAjust     = (bulletin.ajustementsPatron || []).reduce((s, a) => s + (a.montant || 0), 0)
  const totalAcomptes  = (bulletin.acomptes          || []).reduce((s, a) => s + (a.montant || 0), 0)

  const totalBrut = salaireBase + montantSupp25 + montantSupp50
                  + indemniteRepas + indemniteTrajet
                  + totalPrimes + totalAjust

  return {
    salaireBase:       Math.round(salaireBase       * 100) / 100,
    montantSupp25:     Math.round(montantSupp25     * 100) / 100,
    montantSupp50:     Math.round(montantSupp50     * 100) / 100,
    indemniteRepas:    Math.round(indemniteRepas    * 100) / 100,
    indemniteTrajet:   Math.round(indemniteTrajet   * 100) / 100,
    totalBrut:         Math.round(totalBrut         * 100) / 100,
    totalAcomptes:     Math.round(totalAcomptes     * 100) / 100,
    resteAVerser:      Math.round((totalBrut - totalAcomptes) * 100) / 100,
  }
}
