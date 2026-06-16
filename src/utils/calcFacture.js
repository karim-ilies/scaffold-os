export function calculerLigne(ligne) {
  const { type, tauxTVA } = ligne
  let montantHT = 0

  if (type === 'regie') {
    montantHT = (ligne.nbOuvriers || 0)
              * (ligne.nbJours    || 0)
              * (ligne.tauxJournalier || 0)
  } else {
    montantHT = (ligne.quantite || 0) * (ligne.prixUnitaireHT || 0)
  }

  const taux       = tauxTVA ?? 0
  const montantTVA = taux === 0 ? 0 : Math.round(montantHT * taux * 100) / 100
  const montantTTC = Math.round((montantHT + montantTVA) * 100) / 100

  return {
    ...ligne,
    montantHT:  Math.round(montantHT * 100) / 100,
    montantTVA,
    montantTTC,
  }
}

export function calculerTotaux(lignes) {
  return lignes.reduce(
    (acc, l) => {
      const calc = calculerLigne(l)
      acc.totalHT  += calc.montantHT
      acc.totalTVA += calc.montantTVA
      acc.totalTTC += calc.montantTTC
      return acc
    },
    { totalHT: 0, totalTVA: 0, totalTTC: 0 },
  )
}

export function detecterTauxTVA({ typeClient, typeChantier, estSousTraitance }) {
  if (estSousTraitance && typeClient === 'pro') {
    return {
      tauxTVA:       0,
      regimeTVA:     'autoliquidation',
      mentionLegale: 'TVA autoliquidée par le preneur assujetti — art. 283-2 nonies du CGI',
    }
  }
  if (typeClient === 'particulier' && typeChantier === 'renovation') {
    return { tauxTVA: 0.10, regimeTVA: 'reduit', mentionLegale: null }
  }
  return { tauxTVA: 0.20, regimeTVA: 'normal', mentionLegale: null }
}

export function calculerSolde(totalTTC, paiements = []) {
  const totalPaye = paiements.reduce((s, p) => s + (p.montant || 0), 0)
  return {
    totalPaye: Math.round(totalPaye * 100) / 100,
    solde:     Math.round((totalTTC - totalPaye) * 100) / 100,
  }
}

export function estEnRetard(facture) {
  if (!facture.dateEcheance) return false
  if (facture.statut === 'payee' || facture.statut === 'annulee') return false
  const echeance = facture.dateEcheance?.toDate
    ? facture.dateEcheance.toDate()
    : new Date(facture.dateEcheance)
  return echeance < new Date()
}

export function joursDeRetard(facture) {
  if (!estEnRetard(facture)) return 0
  const echeance = facture.dateEcheance?.toDate
    ? facture.dateEcheance.toDate()
    : new Date(facture.dateEcheance)
  const diff = new Date() - echeance
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}
