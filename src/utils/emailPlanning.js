import emailjs from '@emailjs/browser'

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_PLANNING_TEMPLATE_ID
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

function formaterDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export async function envoyerEmailPlanning({
  ouvrierNom, ouvrierEmail,
  chantierNom, chantierAdresse,
  date, dates,
  action,
  chefNom, coequipiers,
}) {
  if (!TEMPLATE_ID || !ouvrierEmail) return false

  // Date ou plage de dates
  let datePlanifiee
  if (dates && dates.length > 1) {
    const d1 = formaterDate(dates[0])
    const d2 = formaterDate(dates[dates.length - 1])
    datePlanifiee = `Du ${d1} au ${d2}`
  } else {
    datePlanifiee = formaterDate(date || dates?.[0])
  }

  const actionLabel = action === 'modifie' ? 'modifié' : action === 'retire' ? 'retiré' : 'ajouté'

  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
      to_email:         ouvrierEmail,
      to_name:          ouvrierNom,
      chantier_nom:     chantierNom     || '—',
      chantier_adresse: chantierAdresse || '—',
      date_planifiee:   datePlanifiee,
      action:           actionLabel,
      chef_nom:         chefNom         || '',
      coequipiers:      coequipiers     || '',
      from_name:        'Scaffold-OS',
    }, PUBLIC_KEY)
    return true
  } catch (e) {
    console.warn('Email planning non envoyé:', e)
    return false
  }
}
