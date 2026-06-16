import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate } from './formatters'
import { formatEuro } from './formatters'
import { STORAGE_ENABLED } from '../firebase/config'

// jsPDF ne sait pas afficher l'espace insécable utilisé par fr-FR
function fEuro(n) {
  return formatEuro(n).replace(/[  ]/g, ' ')
}

function loadImageAsDataUrl(url) {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width  = img.naturalWidth
        canvas.height = img.naturalHeight
        canvas.getContext('2d').drawImage(img, 0, 0)
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.8), ratio: img.naturalWidth / img.naturalHeight })
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

async function loadLogo(logoBase64) {
  if (!logoBase64) return null
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      resolve({ dataUrl: canvas.toDataURL('image/png'), ratio: img.naturalWidth / img.naturalHeight })
    }
    img.onerror = () => resolve(null)
    img.src = logoBase64
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
  const txt = [
    societe?.raisonSociale || '',
    societe?.siret ? `SIRET : ${societe.siret}` : '',
    societe?.tvaIntracom ? `TVA : ${societe.tvaIntracom}` : '',
  ].filter(Boolean).join('   ·   ')
  doc.text(txt, pageW / 2, pageH - 4, { align: 'center' })
}

function bandeSection(doc, titre, y) {
  const pageW = doc.internal.pageSize.getWidth()
  doc.setFillColor(13, 53, 128)
  doc.rect(0, y, pageW, 10, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(titre, 14, y + 7)
  return y + 10
}

// ── Page 1 : Garde ────────────────────────────────────────────────────────────
function pageGarde(doc, chantier, client, chef, societe, logo) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  // Bande bleue supérieure
  doc.setFillColor(13, 53, 128)
  doc.rect(0, 0, pageW, pageH * 0.38, 'F')

  // Logo en haut à gauche
  let nextY = 18
  if (logo) {
    const lH = 14
    const lW = Math.min(lH * logo.ratio, 40)
    doc.addImage(logo.dataUrl, 'PNG', 14, nextY, lW, lH)
    nextY += lH + 4
  }

  // Nom société
  if (societe?.raisonSociale) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(societe.raisonSociale, 14, nextY)
  }

  // Titre central
  const midY = pageH * 0.38 + 24
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(13, 53, 128)
  doc.text('RAPPORT DE CHANTIER', pageW / 2, midY, { align: 'center' })

  doc.setFontSize(13)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(50, 50, 50)
  doc.text(chantier.nom || '—', pageW / 2, midY + 10, { align: 'center' })

  // Badge Terminé
  const badgeX = pageW / 2 - 18
  doc.setFillColor(232, 237, 248)
  doc.roundedRect(badgeX, midY + 16, 36, 8, 2, 2, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(13, 53, 128)
  doc.text('TERMINÉ', pageW / 2, midY + 21.5, { align: 'center' })

  // Infos chantier
  const infoY = midY + 36
  const lignes = [
    ['Client',          client?.nom || '—'],
    ['Adresse',         chantier.adresse ? `${chantier.adresse.rue || ''}  ${chantier.adresse.cp || ''} ${chantier.adresse.ville || ''}`.trim() : '—'],
    ['Chef d\'équipe',  chef ? `${chef.prenom || ''} ${chef.nom || ''}`.trim() || '—' : '—'],
    ['Début travaux',   formatDate(chantier.dateDebut)],
    ['Fin travaux',     formatDate(chantier.dateFin_reelle || chantier.dateFin)],
  ].filter(([, v]) => v && v !== '—' && v.trim() !== '')

  const colLabel = pageW / 2 - 10
  lignes.forEach(([l, v], i) => {
    const y = infoY + i * 9
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(120, 120, 120)
    doc.text(l, colLabel, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 30, 30)
    doc.text(v, colLabel + 6, y)
  })

  // Date de génération
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(160, 160, 160)
  doc.text(`Rapport généré le ${new Date().toLocaleDateString('fr-FR')}`, pageW / 2, pageH - 22, { align: 'center' })
}

// ── Page 2 : Infos + Résumé estimatif ────────────────────────────────────────
function pageInfosResume(doc, chantier, client, factures, societe) {
  doc.addPage()
  let y = 16

  y = bandeSection(doc, 'INFORMATIONS CHANTIER', y) + 8

  autoTable(doc, {
    startY: y,
    body: [
      ['Client',         client?.nom || '—',       'Type',     chantier.typeChantier || '—'],
      ['Adresse',        chantier.adresse ? `${chantier.adresse.rue || ''}  ${chantier.adresse.cp || ''} ${chantier.adresse.ville || ''}`.trim() : '—',
       'Début',          formatDate(chantier.dateDebut)],
      ['SIRET client',   client?.siret || '—',      'Fin',      formatDate(chantier.dateFin_reelle || chantier.dateFin)],
    ],
    bodyStyles:   { fontSize: 8, textColor: [30, 30, 30] },
    columnStyles: {
      0: { cellWidth: 30, fontStyle: 'bold', textColor: [100, 100, 100] },
      1: { cellWidth: 60 },
      2: { cellWidth: 30, fontStyle: 'bold', textColor: [100, 100, 100] },
      3: { cellWidth: 60 },
    },
    theme: 'plain',
    tableLineColor: [230, 232, 238],
    tableLineWidth: 0.2,
  })

  y = doc.lastAutoTable.finalY + 6

  if (chantier.description) {
    y = bandeSection(doc, 'DESCRIPTION DES TRAVAUX', y) + 8
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(50, 50, 50)
    const lines = doc.splitTextToSize(chantier.description, doc.internal.pageSize.getWidth() - 28)
    doc.text(lines, 14, y)
    y += lines.length * 5 + 8
  }

  // Calcul stats estimées depuis lignes de facture
  const allLignes   = factures.flatMap(f => f.lignes || [])
  const lignesRegie = allLignes.filter(l => l.type === 'regie')
  const totalJours  = lignesRegie.reduce((s, l) => s + ((l.nbOuvriers || 0) * (l.nbJours || 0)), 0)
  const totalHT     = factures.reduce((s, f) => s + (f.totalHT  || 0), 0)
  const totalTVA    = factures.reduce((s, f) => s + (f.totalTVA || 0), 0)
  const totalTTC    = factures.reduce((s, f) => s + (f.totalTTC || 0), 0)

  y = bandeSection(doc, 'RÉSUMÉ ESTIMATIF', y) + 8

  const pageW = doc.internal.pageSize.getWidth()
  const metrics = [
    ['Jours-ouvriers estimés', totalJours > 0 ? `${totalJours} j.` : '—'],
    ['Montant HT',             fEuro(totalHT)],
    ['TVA',                    fEuro(totalTVA)],
    ['Montant TTC',            fEuro(totalTTC)],
    ['Nombre de factures',     String(factures.length)],
    ['Prestations régie',      String(lignesRegie.length)],
  ]
  const cellW   = (pageW - 28) / 2
  const cellH   = 16
  metrics.forEach(([label, val], i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const mx  = 14 + col * (cellW + 4)
    const my  = y + row * (cellH + 4)
    doc.setFillColor(247, 248, 252)
    doc.roundedRect(mx, my, cellW, cellH, 2, 2, 'F')
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 100)
    doc.text(label.toUpperCase(), mx + 6, my + 5.5)
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(13, 53, 128)
    doc.text(val, mx + 6, my + 12.5)
  })

  piedPage(doc, societe)
}

// ── Page 3 : Prestations réalisées ───────────────────────────────────────────
function pagePrestations(doc, factures, societe) {
  doc.addPage()
  let y = 16
  y = bandeSection(doc, 'PRESTATIONS RÉALISÉES', y) + 4

  doc.setFontSize(7)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(110, 110, 110)
  doc.text('Les jours indiqués correspondent aux estimations contractuelles (devis / facturation).', 14, y + 6)
  y += 14

  const allLignes = factures.flatMap(f => (f.lignes || []).map(l => ({ ...l, factureNum: f.numero || '—' })))

  if (allLignes.length === 0) {
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(130, 130, 130)
    doc.text('Aucune prestation enregistrée.', 14, y + 10)
  } else {
    const rows = allLignes.map(l => {
      if (l.type === 'regie') {
        return [
          l.factureNum,
          l.description || 'Prestation régie',
          l.nbOuvriers != null ? String(l.nbOuvriers) : '—',
          l.nbJours     != null ? String(l.nbJours)    : '—',
          l.tauxJournalier ? fEuro(l.tauxJournalier) : '—',
          fEuro(l.montantHT),
        ]
      }
      return [
        l.factureNum,
        l.description || 'Fourniture',
        '—',
        l.quantite != null ? String(l.quantite) : '—',
        l.prixUnitaireHT ? fEuro(l.prixUnitaireHT) : '—',
        fEuro(l.montantHT),
      ]
    })
    autoTable(doc, {
      startY: y,
      head: [['Facture', 'Description', 'Ouvriers est.', 'Jours est.', 'Tarif u.', 'Montant HT']],
      body: rows,
      headStyles:   { fillColor: [13, 53, 128], fontSize: 8, fontStyle: 'bold' },
      bodyStyles:   { fontSize: 8, textColor: [30, 30, 30] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 64 },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 26, halign: 'right' },
        5: { cellWidth: 28, halign: 'right' },
      },
      theme: 'striped',
    })
  }

  piedPage(doc, societe)
}

// ── Page 4 : Matériel utilisé ─────────────────────────────────────────────────
function pageMateriel(doc, materielAffecte, societe) {
  doc.addPage()
  let y = 16
  y = bandeSection(doc, 'MATÉRIEL UTILISÉ', y) + 8

  if (!materielAffecte || materielAffecte.length === 0) {
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(130, 130, 130)
    doc.text('Aucun matériel affecté à ce chantier.', 14, y + 10)
  } else {
    const rows = materielAffecte.map(m => [
      m.nomArticle  || m.stockItemId || '—',
      m.categorie   || '—',
      String(m.quantite != null ? m.quantite : '—'),
    ])
    autoTable(doc, {
      startY: y,
      head:   [['Article', 'Catégorie', 'Quantité']],
      body:   rows,
      headStyles:   { fillColor: [13, 53, 128], fontSize: 8, fontStyle: 'bold' },
      bodyStyles:   { fontSize: 8, textColor: [30, 30, 30] },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 60 },
        2: { cellWidth: 20, halign: 'center' },
      },
      theme: 'striped',
    })
  }

  piedPage(doc, societe)
}

// ── Pages photos ──────────────────────────────────────────────────────────────
async function pagesPhotos(doc, photos, societe) {
  if (!STORAGE_ENABLED || !photos || photos.length === 0) return

  const photoSlice = photos.slice(0, 12)
  const loaded = await Promise.all(photoSlice.map(p => loadImageAsDataUrl(p.photoUrl).catch(() => null)))
  const valid  = photoSlice.map((p, i) => ({ ...p, img: loaded[i] })).filter(p => p.img)
  if (valid.length === 0) return

  const pageW   = doc.internal.pageSize.getWidth()
  const pageH   = doc.internal.pageSize.getHeight()
  const maxPhW  = (pageW - 42) / 2
  const maxPhH  = 68

  doc.addPage()
  let y   = 16
  let col = 0
  y = bandeSection(doc, 'PHOTOS DU CHANTIER', y) + 8

  for (const p of valid) {
    if (y + maxPhH + 14 > pageH - 16) {
      piedPage(doc, societe)
      doc.addPage()
      y   = 16
      col = 0
      y = bandeSection(doc, 'PHOTOS DU CHANTIER (suite)', y) + 8
    }

    const x = col === 0 ? 14 : 14 + maxPhW + 14
    const w = maxPhW
    const h = Math.min(w / p.img.ratio, maxPhH)

    doc.addImage(p.img.dataUrl, 'JPEG', x, y, w, h)

    // Légende sous la photo
    doc.setFontSize(7); doc.setFont('helvetica', 'italic'); doc.setTextColor(130, 130, 130)
    const caption = [p.auteurNom, p.createdAt ? formatDate(p.createdAt) : null].filter(Boolean).join(' — ')
    if (caption) doc.text(caption, x, y + h + 4, { maxWidth: w })

    col++
    if (col === 2) {
      col = 0
      y  += maxPhH + 14
    }
  }

  piedPage(doc, societe)
}

// ── Page récap financier ──────────────────────────────────────────────────────
function pageRecapFinancier(doc, factures, societe) {
  doc.addPage()
  let y = 16
  y = bandeSection(doc, 'RÉCAPITULATIF FINANCIER', y) + 8

  if (factures.length === 0) {
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(130, 130, 130)
    doc.text('Aucune facture rattachée à ce chantier.', 14, y + 10)
    piedPage(doc, societe)
    return
  }

  const rows = factures.map(f => [
    f.numero  || '—',
    formatDate(f.dateEmission),
    formatDate(f.dateEcheance),
    fEuro(f.totalHT),
    fEuro(f.totalTTC),
    f.statut === 'payee' ? 'Payée' : f.statut === 'envoyee' ? 'Envoyée' : (f.statut || '—'),
  ])

  autoTable(doc, {
    startY: y,
    head:   [['N° Facture', 'Émission', 'Échéance', 'Total HT', 'Total TTC', 'Statut']],
    body:   rows,
    headStyles:   { fillColor: [13, 53, 128], fontSize: 8, fontStyle: 'bold' },
    bodyStyles:   { fontSize: 8, textColor: [30, 30, 30] },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 24 },
      2: { cellWidth: 24 },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 24, halign: 'center' },
    },
    theme: 'grid',
  })

  // Bloc totaux
  const pageW   = doc.internal.pageSize.getWidth()
  const startX  = pageW - 80
  let ty        = doc.lastAutoTable.finalY + 10

  const totalHT  = factures.reduce((s, f) => s + (f.totalHT  || 0), 0)
  const totalTVA = factures.reduce((s, f) => s + (f.totalTVA || 0), 0)
  const totalTTC = factures.reduce((s, f) => s + (f.totalTTC || 0), 0)

  const totaux = [
    ['Total HT', fEuro(totalHT)],
    ['TVA',      fEuro(totalTVA)],
    ['Total TTC', fEuro(totalTTC)],
  ]
  totaux.forEach(([l, v], i) => {
    const isLast = i === totaux.length - 1
    doc.setFontSize(9)
    if (isLast) {
      doc.setFillColor(13, 53, 128)
      doc.rect(startX - 2, ty - 4, pageW - startX - 12, 9, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
    } else {
      doc.setTextColor(50, 50, 50)
      doc.setFont('helvetica', 'normal')
    }
    doc.text(l, startX + 2, ty)
    doc.text(v, pageW - 14, ty, { align: 'right' })
    ty += 10
  })

  // Conditions générales
  if (societe?.conditionsGenerales) {
    ty += 6
    const pageH = doc.internal.pageSize.getHeight()
    if (ty < pageH - 30) {
      doc.setDrawColor(220, 224, 234); doc.setLineWidth(0.3)
      doc.line(14, ty, pageW - 14, ty)
      ty += 8
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 100)
      doc.text('CONDITIONS GÉNÉRALES', 14, ty)
      ty += 6
      doc.setFont('helvetica', 'normal'); doc.setTextColor(130, 130, 130)
      const lines = doc.splitTextToSize(societe.conditionsGenerales, pageW - 28)
      doc.text(lines, 14, ty)
    }
  }

  piedPage(doc, societe)
}

// ── Export principal ──────────────────────────────────────────────────────────
export async function generateRapportChantierPDF(chantier, { client, chef, photos, factures, materielAffecte, parametres }) {
  const societe = parametres?.societe || {}
  const doc     = new jsPDF({ unit: 'mm', format: 'a4' })
  const logo    = await loadLogo(societe.logoBase64)

  pageGarde(doc, chantier, client, chef, societe, logo)
  piedPage(doc, societe)

  pageInfosResume(doc, chantier, client, factures, societe)

  pagePrestations(doc, factures, societe)

  pageMateriel(doc, materielAffecte, societe)

  if (photos && photos.length > 0) {
    await pagesPhotos(doc, photos, societe)
  }

  pageRecapFinancier(doc, factures, societe)

  // Numérotation finale
  const nbPages = doc.getNumberOfPages()
  for (let i = 1; i <= nbPages; i++) {
    doc.setPage(i)
    const pw = doc.internal.pageSize.getWidth()
    const ph = doc.internal.pageSize.getHeight()
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(180, 180, 180)
    doc.text(`Page ${i} / ${nbPages}`, pw - 14, ph - 4, { align: 'right' })
  }

  return doc.output('blob')
}
