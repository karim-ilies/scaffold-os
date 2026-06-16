import { formatDate } from './formatters'

function fmtFEC(n) {
  return n ? n.toFixed(2).replace('.', ',') : '0,00'
}

function fmtDateFEC(timestamp) {
  if (!timestamp) return ''
  const d = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

export function generateFEC(factures = [], dateDebut, dateFin) {
  const BOM = '﻿'
  const SEP = '|'
  const COLS = [
    'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum',
    'CompteLib', 'CompAuxNum', 'CompAuxLib', 'PieceRef', 'PieceDate',
    'EcritureLib', 'Debit', 'Credit', 'EcritureLet', 'DateLet',
    'ValidDate', 'Montantdevise', 'Idevise',
  ]

  const lignes = [COLS.join(SEP)]
  let ecritureNum = 1

  factures.forEach(facture => {
    if (facture.statut === 'annulee') return
    const dateStr  = fmtDateFEC(facture.dateEmission)
    const pieceRef = facture.numero || ''

    // 411 — Clients (débit)
    lignes.push([
      'VT', 'Ventes', String(ecritureNum).padStart(6, '0'), dateStr,
      '411', 'Clients', facture.clientId || '', facture.clientNom || '',
      pieceRef, dateStr,
      `Facture ${pieceRef}`,
      fmtFEC(facture.totalTTC), '0,00',
      '', '', dateStr, '', '',
    ].join(SEP))

    // 706 — Prestations de services (crédit)
    lignes.push([
      'VT', 'Ventes', String(ecritureNum).padStart(6, '0'), dateStr,
      '706', 'Prestations de services', '', '',
      pieceRef, dateStr,
      `Facture ${pieceRef}`,
      '0,00', fmtFEC(facture.totalHT),
      '', '', dateStr, '', '',
    ].join(SEP))

    // 44571 — TVA collectée (si non autoliquidation)
    if (facture.totalTVA > 0) {
      lignes.push([
        'VT', 'Ventes', String(ecritureNum).padStart(6, '0'), dateStr,
        '44571', 'TVA collectée', '', '',
        pieceRef, dateStr,
        `TVA ${pieceRef}`,
        '0,00', fmtFEC(facture.totalTVA),
        '', '', dateStr, '', '',
      ].join(SEP))
    }

    ecritureNum++

    // Paiements — 512 Banque / 411 Clients
    ;(facture.paiements || []).forEach(paiement => {
      const pDateStr = fmtDateFEC(paiement.date)
      lignes.push([
        'BQ', 'Banque', String(ecritureNum).padStart(6, '0'), pDateStr,
        '512', 'Banque', '', '',
        pieceRef, pDateStr,
        `Règlement ${pieceRef}`,
        fmtFEC(paiement.montant), '0,00',
        '', '', pDateStr, '', '',
      ].join(SEP))
      lignes.push([
        'BQ', 'Banque', String(ecritureNum).padStart(6, '0'), pDateStr,
        '411', 'Clients', facture.clientId || '', facture.clientNom || '',
        pieceRef, pDateStr,
        `Règlement ${pieceRef}`,
        '0,00', fmtFEC(paiement.montant),
        '', '', pDateStr, '', '',
      ].join(SEP))
      ecritureNum++
    })
  })

  return BOM + lignes.join('\r\n')
}

export function downloadFEC(content, dateDebut) {
  const d    = dateDebut?.toDate ? dateDebut.toDate() : new Date(dateDebut || new Date())
  const nom  = `FEC_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.txt`
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = nom
  a.click()
  URL.revokeObjectURL(url)
}
