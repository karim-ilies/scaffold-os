import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatEuro, formatDate, formatDateLong } from './formatters'
import { ref, uploadBytes, getDownloadURL, getBytes } from 'firebase/storage'
import { storage } from '../firebase/config'

// jsPDF ne sait pas afficher l'espace insécable (U+202F / U+00A0) utilisé par fr-FR
function fEuro(n) {
  return formatEuro(n).replace(/[  ]/g, ' ')
}

async function loadLogo(logoBase64) {
  if (!logoBase64) return null
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image()
      i.onload  = () => res(i)
      i.onerror = rej
      i.src = logoBase64
    })
    const w = img.naturalWidth  || 200
    const h = img.naturalHeight || 200
    const canvas = document.createElement('canvas')
    canvas.width  = w
    canvas.height = h
    canvas.getContext('2d').drawImage(img, 0, 0)
    return { dataUrl: canvas.toDataURL('image/png'), ratio: w / h }
  } catch(e) {
    console.warn('[PDF] logo échec:', e.message)
    return null
  }
}

function enteteDocument(doc, societe, document, mode, logo) {
  const pageW = doc.internal.pageSize.getWidth()

  // Fond bleu header
  doc.setFillColor(13, 53, 128)
  doc.rect(0, 0, pageW, 38, 'F')

  // Logo (optionnel) — affiché à gauche, centré verticalement dans le header
  let textX = 14
  if (logo) {
    const maxW = 32, maxH = 28
    let w = maxW, h = maxW / logo.ratio
    if (h > maxH) { h = maxH; w = maxH * logo.ratio }
    try { doc.addImage(logo.dataUrl, 'PNG', 14, (38 - h) / 2, w, h) } catch {}
    textX = 14 + w + 5
  }

  // Nom société
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(societe.raisonSociale || 'Scaffold-OS', textX, 14)

  // Infos société
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  const infos = [
    societe.adresse ? `${societe.adresse.rue} — ${societe.adresse.cp} ${societe.adresse.ville}` : '',
    `Tél : ${societe.telephone || ''}   Email : ${societe.email || ''}`,
    `SIRET : ${societe.siret || ''}   TVA : ${societe.tvaIntracom || ''}`,
  ].filter(Boolean)
  infos.forEach((line, i) => doc.text(line, textX, 22 + i * 5))

  // Numéro + type document
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  const label = mode === 'devis' ? 'DEVIS' : 'FACTURE'
  doc.text(`${label} ${document.numero || ''}`, pageW - 14, 20, { align: 'right' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(255, 255, 255)
  doc.text(`Émis le : ${formatDate(document.dateEmission)}`, pageW - 14, 30, { align: 'right' })
  if (mode === 'devis') {
    doc.text(`Valide jusqu'au : ${formatDate(document.dateValidite)}`, pageW - 14, 35, { align: 'right' })
  } else {
    doc.text(`Échéance : ${formatDate(document.dateEcheance)}`, pageW - 14, 35, { align: 'right' })
  }
}

function blocClient(doc, client, chantier) {
  const pageW = doc.internal.pageSize.getWidth()

  // Fond gris léger
  doc.setFillColor(247, 248, 252)
  doc.rect(0, 40, pageW, 36, 'F')

  // Filets séparateurs
  doc.setDrawColor(220, 224, 234)
  doc.setLineWidth(0.3)
  doc.line(0, 40, pageW, 40)
  doc.line(0, 76, pageW, 76)

  // Séparateur vertical CLIENT / CHANTIER
  doc.line(pageW / 2, 42, pageW / 2, 74)

  // Reset explicite après les opérations de dessin
  doc.setDrawColor(0)
  doc.setLineWidth(0.2)

  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(13, 53, 128)
  doc.text('CLIENT', 14, 47)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  const lignesClient = [
    client.nom || '',
    client.adresse ? `${client.adresse.rue}` : '',
    client.adresse ? `${client.adresse.cp} ${client.adresse.ville}` : '',
    client.siret ? `SIRET : ${client.siret}` : '',
  ].filter(Boolean)
  lignesClient.forEach((line, i) => doc.text(line, 14, 53 + i * 5))

  if (chantier) {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(13, 53, 128)
    doc.text('CHANTIER', pageW / 2 + 6, 47)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    const lignesChantier = [
      chantier.nom || '',
      chantier.adresse ? `${chantier.adresse.rue}` : '',
      chantier.adresse ? `${chantier.adresse.cp} ${chantier.adresse.ville}` : '',
    ].filter(Boolean)
    lignesChantier.forEach((line, i) => doc.text(line, pageW / 2 + 6, 53 + i * 5))
  }
}

function tableauLignes(doc, lignes, startY) {
  const rows = lignes.map(l => {
    if (l.type === 'regie') {
      return [
        l.description || 'Prestation régie',
        l.nbOuvriers || '',
        l.nbJours || '',
        l.tauxJournalier ? fEuro(l.tauxJournalier) : '',
        fEuro(l.montantHT),
        `${((l.tauxTVA || 0) * 100).toFixed(0)} %`,
        fEuro(l.montantTTC),
      ]
    }
    return [
      l.description || '',
      '',
      l.quantite || '',
      l.prixUnitaireHT ? fEuro(l.prixUnitaireHT) : '',
      fEuro(l.montantHT),
      `${((l.tauxTVA || 0) * 100).toFixed(0)} %`,
      fEuro(l.montantTTC),
    ]
  })

  autoTable(doc, {
    startY,
    head: [['Description', 'Ouvriers', 'Jours/Qté', 'Taux/Prix U.', 'HT', 'TVA', 'TTC']],
    body: rows,
    headStyles: { fillColor: [13, 53, 128], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [30, 30, 30] },
    columnStyles: {
      0: { cellWidth: 56 },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 14, halign: 'center' },
      6: { cellWidth: 24, halign: 'right' },
    },
    theme: 'grid',
  })

  return doc.lastAutoTable.finalY
}

function blocTotaux(doc, document, societe, finalY) {
  const pageW  = doc.internal.pageSize.getWidth()
  const startX = pageW - 80
  let   y      = finalY + 8

  const lignesTotal = [
    ['Total HT',  fEuro(document.totalHT)],
    [`TVA (${document.regimeTVA === 'autoliquidation' ? '0%' : document.regimeTVA === 'reduit' ? '10%' : '20%'})`, fEuro(document.totalTVA)],
    ['Total TTC', fEuro(document.totalTTC)],
  ]

  // Bloc paiement à gauche, aligné avec les lignes de totaux
  const yPaiement = y
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(13, 53, 128)
  doc.text('MODALITÉS DE PAIEMENT', 14, yPaiement)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(50, 50, 50)
  doc.setFontSize(8)
  if (societe?.iban) {
    doc.text(`IBAN : ${societe.iban}`, 14, yPaiement + 6)
  }
  const condPaiement = societe?.conditionsGenerales || 'Paiement par virement à réception de facture.'
  doc.text(condPaiement, 14, yPaiement + (societe?.iban ? 12 : 6), { maxWidth: startX - 20 })

  // Totaux à droite
  doc.setFontSize(9)
  lignesTotal.forEach(([label, valeur], i) => {
    const isLast = i === lignesTotal.length - 1
    if (isLast) {
      doc.setFillColor(13, 53, 128)
      doc.rect(startX - 2, y - 4, pageW - startX - 12, 8, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
    } else {
      doc.setTextColor(50, 50, 50)
      doc.setFont('helvetica', 'normal')
    }
    doc.text(label, startX + 2, y)
    doc.text(valeur, pageW - 14, y, { align: 'right' })
    y += 9
  })

  if (document.mentionLegale) {
    y += 4
    doc.setTextColor(150, 80, 0)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.text(document.mentionLegale, 14, y, { maxWidth: pageW - 28 })
    y += 8
  }

  return y
}

function blocConditions(doc, societe, finalY) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const y = finalY + 14

  // Ne pas déborder sur le pied de page
  if (y > pageH - 30) return

  doc.setDrawColor(220, 224, 234)
  doc.setLineWidth(0.3)
  doc.line(14, y, pageW - 14, y)

  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 100, 100)
  doc.text('CONDITIONS GÉNÉRALES', 14, y + 6)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 120, 120)
  const lignes = [
    societe?.penalitesRetard,
    societe?.conditionsGenerales || 'Paiement par virement bancaire à réception de facture.',
  ].filter(Boolean)
  let yLine = y + 12
  lignes.forEach(txt => {
    const split = doc.splitTextToSize(txt, pageW - 28)
    doc.text(split, 14, yLine)
    yLine += split.length * 4 + 3
  })
}

function piedPage(doc, societe) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  doc.setFillColor(240, 242, 248)
  doc.rect(0, pageH - 12, pageW, 12, 'F')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(130, 130, 130)

  const mentions = [
    societe.raisonSociale || '',
    societe.siret ? `SIRET : ${societe.siret}` : '',
    societe.tvaIntracom ? `TVA : ${societe.tvaIntracom}` : '',
  ].filter(Boolean).join('   ·   ')

  doc.text(mentions, pageW / 2, pageH - 4, { align: 'center' })
}

export async function generateFacturePDF(facture, client, chantier, societe = {}) {
  const doc  = new jsPDF({ unit: 'mm', format: 'a4' })
  const logo = await loadLogo(societe.logoBase64)

  enteteDocument(doc, societe, facture, 'facture', logo)
  blocClient(doc, client, chantier)
  const afterLignes = tableauLignes(doc, facture.lignes || [], 78)
  const afterTotaux = blocTotaux(doc, facture, societe, afterLignes)
  blocConditions(doc, societe, afterTotaux)
  piedPage(doc, societe)

  return doc.output('blob')
}

export async function generateDevisPDF(devis, client, chantier, societe = {}) {
  const doc  = new jsPDF({ unit: 'mm', format: 'a4' })
  const logo = await loadLogo(societe.logoBase64)

  enteteDocument(doc, societe, devis, 'devis', logo)
  blocClient(doc, client, chantier)
  const afterLignes = tableauLignes(doc, devis.lignes || [], 78)
  const afterTotaux = blocTotaux(doc, devis, societe, afterLignes)
  blocConditions(doc, societe, afterTotaux)
  piedPage(doc, societe)

  return doc.output('blob')
}

export async function uploadAndGetPdfUrl(blob, path) {
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, blob, { contentType: 'application/pdf' })
  return getDownloadURL(storageRef)
}
