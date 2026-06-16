export function formatEuro(n) {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style:                 'currency',
    currency:              'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

export function formatDate(timestamp) {
  if (!timestamp) return '—'
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)
  return new Intl.DateTimeFormat('fr-FR').format(date)
}

export function formatDateLong(timestamp) {
  if (!timestamp) return '—'
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(date)
}

export function formatNumero(compteur, prefix, annee) {
  return `${prefix}-${annee || new Date().getFullYear()}-${String(compteur).padStart(3, '0')}`
}

export function formatHeures(h) {
  if (h === null || h === undefined) return '—'
  const totalMin = Math.round(h * 60)
  const heures   = Math.floor(totalMin / 60)
  const minutes  = totalMin % 60
  return `${heures}h${minutes > 0 ? String(minutes).padStart(2, '0') : ''}`
}

export function formatTelephone(tel) {
  if (!tel) return '—'
  const digits = tel.replace(/\D/g, '')
  if (digits.length === 10) {
    return digits.match(/.{2}/g).join(' ')
  }
  return tel
}

export function formatTauxTVA(taux) {
  if (taux === 0) return 'Autoliquidation'
  return `${(taux * 100).toFixed(0)} %`
}

export function formatStatut(statut) {
  const labels = {
    brouillon:   'Brouillon',
    envoyee:     'Envoyée',
    envoye:      'Envoyé',
    payee:       'Payée',
    annulee:     'Annulée',
    avoir:       'Avoir',
    accepte:     'Accepté',
    refuse:      'Refusé',
    expire:      'Expiré',
    en_attente:  'En attente',
    en_cours:    'En cours',
    termine:     'Terminé',
    annule:      'Annulé',
    valide:      'Validé',
    rejete:      'Rejeté',
    a_verifier:  'À vérifier',
    rembourse:   'Remboursé',
    archivee:    'Archivée',
    archive:     'Archivé',
  }
  return labels[statut] || statut
}

export function formatRole(role) {
  const labels = {
    patron:      'Patron',
    chef_equipe: 'Chef d\'équipe',
    ouvrier:     'Ouvrier',
    comptable:   'Comptable',
  }
  return labels[role] || role
}

export function formatDateRelative(timestamp) {
  if (!timestamp) return '—'
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)
  const now  = new Date()
  const diff = now - date
  const jours = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (jours === 0) return 'Aujourd\'hui'
  if (jours === 1) return 'Hier'
  if (jours < 7)  return `Il y a ${jours} jours`
  return formatDate(timestamp)
}

export function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function dateToString(date) {
  return new Intl.DateTimeFormat('fr-CA').format(date) // "2025-06-04"
}
