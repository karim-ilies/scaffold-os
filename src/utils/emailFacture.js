import emailjs from '@emailjs/browser'
import { formatEuro, formatDate } from './formatters'

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

export const EMAILJS_FACTURE_CONFIGURE = !!(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY)

export async function envoyerEmailRelance({ facture, client, joursRetard, societeNom }) {
  if (!EMAILJS_FACTURE_CONFIGURE) throw new Error('EmailJS non configuré.')
  if (!client?.email)             throw new Error('Email client manquant.')

  const montant  = formatEuro(facture.solde || facture.totalTTC || 0)
  const echeance = facture.dateEcheance ? formatDate(facture.dateEcheance) : '—'
  const numero   = facture.numero || ''
  const nom      = societeNom || 'Scaffold-OS'

  await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
    to_email:  client.email,
    to_name:   client.nom || '',
    from_name: nom,
    sujet:     `⚠️ Relance — Facture ${numero} en retard de ${joursRetard} jour(s)`,
    corps:     `Sauf erreur de notre part, la facture n°${numero} d'un montant de ${montant} TTC était due le ${echeance}.\n\nElle est actuellement en retard de ${joursRetard} jour(s).\n\nMerci de bien vouloir procéder au règlement dans les meilleurs délais.`,
  }, PUBLIC_KEY)
}

export async function envoyerEmailFacture({ facture, client, pdfUrl, societeNom }) {
  if (!EMAILJS_FACTURE_CONFIGURE) throw new Error('EmailJS non configuré.')
  if (!client?.email)             throw new Error('Email client manquant.')

  const montant  = formatEuro(facture.totalTTC || 0)
  const echeance = facture.dateEcheance ? formatDate(facture.dateEcheance) : '—'
  const numero   = facture.numero || ''
  const nom      = societeNom || 'Scaffold-OS'

  await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
    to_email:  client.email,
    to_name:   client.nom || '',
    from_name: nom,
    sujet:     `Facture ${numero} — ${nom}`,
    corps:     `Veuillez trouver ci-joint votre facture n°${numero}.\n\nMontant TTC : ${montant}\nÉchéance : ${echeance}\n\nTélécharger la facture :\n${pdfUrl || '(lien non disponible)'}`,
  }, PUBLIC_KEY)
}
