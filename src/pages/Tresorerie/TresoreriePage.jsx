import { useState, useEffect, useMemo } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  doc, getDoc, setDoc, addDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth }    from '../../hooks/useAuth'
import { useClients } from '../../hooks/useClients'
import { formatEuro, formatDate } from '../../utils/formatters'
import { useResponsive } from '../../hooks/useResponsive'
import AddIcon           from '@mui/icons-material/Add'
import ArrowUpwardIcon   from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import DownloadIcon      from '@mui/icons-material/Download'
import CloseIcon         from '@mui/icons-material/Close'
import DeleteIcon        from '@mui/icons-material/Delete'

const CATEGORIES = {
  facture:        { label: 'Paiement client',   color: '#16a34a', bg: '#dcfce7' },
  salaire:        { label: 'Salaire',            color: '#dc2626', bg: '#fee2e2' },
  achat_materiel: { label: 'Achat matériel',     color: '#c2410c', bg: '#fef3c7' },
  acompte:        { label: 'Acompte',            color: '#d97706', bg: '#fef3c7' },
  charges:        { label: 'Charges',            color: '#7c3aed', bg: '#ede9fe' },
  autre:          { label: 'Autre',              color: '#374151', bg: '#f3f4f6' },
}
const MODES = ['virement', 'cheque', 'especes', 'prelevement']
const MODE_LABELS = { virement: 'Virement', cheque: 'Chèque', especes: 'Espèces', prelevement: 'Prélèvement' }

export default function TresoreriePage() {
  const { isPatron } = useAuth()
  const { isMobile } = useResponsive()
  const [mouvements, setMouvements] = useState([])
  const [soldeDoc,   setSoldeDoc]   = useState(null)
  const [onglet,     setOnglet]     = useState('encaissements')
  const [moisFiltre, setMoisFiltre] = useState(new Date().toISOString().slice(0, 7))
  const [catFiltre,  setCatFiltre]  = useState('')
  const [search,     setSearch]     = useState('')
  const [modalOpen,  setModalOpen]  = useState(false)
  const [loading,    setLoading]    = useState(true)

  // Listener mouvements
  useEffect(() => {
    const q = query(collection(db, 'tresorerie'), orderBy('date', 'desc'))
    return onSnapshot(q, snap => {
      setMouvements(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
  }, [])

  // Listener solde
  useEffect(() => {
    const ref = doc(db, 'tresorerie_solde', 'current')
    return onSnapshot(ref, snap => {
      setSoldeDoc(snap.exists() ? snap.data() : { solde: 0, totalEncaisseMonth: 0, totalDecaisseMonth: 0 })
    })
  }, [])

  // Filtrés
  const filtered = useMemo(() => {
    return mouvements.filter(m => {
      if (m.type !== (onglet === 'encaissements' ? 'encaissement' : 'decaissement')) return false
      if (moisFiltre && m.date && !m.date.startsWith(moisFiltre)) return false
      if (catFiltre  && m.categorie !== catFiltre) return false
      if (search) {
        const s = search.toLowerCase()
        if (!m.label?.toLowerCase().includes(s) && !m.referenceId?.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [mouvements, onglet, moisFiltre, catFiltre, search])

  // Graphique 6 mois
  const graphData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d  = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const mois = d.toISOString().slice(0, 7)
      const label = d.toLocaleDateString('fr-FR', { month: 'short' })
      const enc = mouvements.filter(m => m.type === 'encaissement' && m.date?.startsWith(mois)).reduce((s, m) => s + m.montant, 0)
      const dec = mouvements.filter(m => m.type === 'decaissement' && m.date?.startsWith(mois)).reduce((s, m) => s + m.montant, 0)
      return { mois, label, solde: enc - dec, enc, dec, isCurrent: mois === now.toISOString().slice(0, 7) }
    })
  }, [mouvements])

  async function ajouterMouvement(data) {
    const montant  = parseFloat(data.montant) || 0
    const isEnc    = data.type === 'encaissement'
    const delta    = isEnc ? montant : -montant
    const nowMois  = new Date().toISOString().slice(0, 7)
    const isCurMois = data.date.startsWith(nowMois)

    await addDoc(collection(db, 'tresorerie'), {
      ...data,
      montant,
      source:    'manuel',
      createdAt: serverTimestamp(),
    })

    const soldeRef = doc(db, 'tresorerie_solde', 'current')
    const cur      = (await getDoc(soldeRef)).data() || { solde: 0, totalEncaisseMonth: 0, totalDecaisseMonth: 0 }
    await setDoc(soldeRef, {
      solde:               (cur.solde || 0) + delta,
      dernierMouvement:    serverTimestamp(),
      totalEncaisseMonth:  isCurMois ? (cur.totalEncaisseMonth || 0) + (isEnc ? montant : 0) : cur.totalEncaisseMonth || 0,
      totalDecaisseMonth:  isCurMois ? (cur.totalDecaisseMonth || 0) + (!isEnc ? montant : 0) : cur.totalDecaisseMonth || 0,
    })
    setModalOpen(false)
  }

  async function supprimerMouvement(m) {
    if (!window.confirm(`Supprimer "${m.label}" ?`)) return
    const isEnc  = m.type === 'encaissement'
    const delta  = isEnc ? -m.montant : m.montant
    const nowMois = new Date().toISOString().slice(0, 7)
    const isCurMois = m.date?.startsWith(nowMois)

    await deleteDoc(doc(db, 'tresorerie', m.id))

    const soldeRef = doc(db, 'tresorerie_solde', 'current')
    const cur      = (await getDoc(soldeRef)).data() || { solde: 0, totalEncaisseMonth: 0, totalDecaisseMonth: 0 }
    await setDoc(soldeRef, {
      solde:              (cur.solde || 0) + delta,
      dernierMouvement:   serverTimestamp(),
      totalEncaisseMonth: isCurMois ? (cur.totalEncaisseMonth || 0) - (isEnc ? m.montant : 0) : cur.totalEncaisseMonth || 0,
      totalDecaisseMonth: isCurMois ? (cur.totalDecaisseMonth || 0) - (!isEnc ? m.montant : 0) : cur.totalDecaisseMonth || 0,
    })
  }

  function exportCSV() {
    const lines = [
      ['Date', 'Type', 'Catégorie', 'Label', 'Montant', 'Mode'],
      ...mouvements
        .filter(m => !moisFiltre || m.date?.startsWith(moisFiltre))
        .map(m => [
          m.date, m.type,
          CATEGORIES[m.categorie]?.label || m.categorie,
          m.label, m.montant, m.modePaiement || '',
        ]),
    ]
    const csv  = lines.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `tresorerie_${moisFiltre || 'complet'}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const maxBar = Math.max(...graphData.map(d => Math.max(Math.abs(d.solde), 1)), 1)

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0d3580', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: '700', color: '#fff', margin: 0 }}>Trésorerie</h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0' }}>Flux financiers en temps réel</p>
          </div>
          {isPatron && (
            <button onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#E8A838', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: '600', cursor: 'pointer' }}>
              <AddIcon style={{ fontSize: 18 }} />
              Mouvement
            </button>
          )}
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <KPI icon={<AccountBalanceWalletIcon style={{ fontSize: 20, color: '#34d399' }} />}
               label="Solde actuel"
               value={formatEuro(soldeDoc?.solde || 0)}
               valueColor="#34d399" />
          <KPI icon={<ArrowUpwardIcon style={{ fontSize: 20, color: '#60a5fa' }} />}
               label="Encaissé (mois)"
               value={formatEuro(soldeDoc?.totalEncaisseMonth || 0)}
               valueColor="#60a5fa" />
          <KPI icon={<ArrowDownwardIcon style={{ fontSize: 20, color: '#f87171' }} />}
               label="Décaissé (mois)"
               value={formatEuro(soldeDoc?.totalDecaisseMonth || 0)}
               valueColor="#f87171" />
        </div>
      </div>

      <div style={{ padding: isMobile ? '16px 12px' : '20px 24px' }}>
        {/* Graphique SVG 6 mois */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #0d3580', padding: '16px 20px', marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: '600', color: '#111111', margin: '0 0 16px' }}>Solde mensuel — 6 derniers mois</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
            {graphData.map(d => {
              const barH = Math.max(4, Math.abs(d.solde / maxBar) * 90)
              const color = d.isCurrent ? '#0d3580' : '#c8d3ee'
              return (
                <div key={d.mois} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 9, color: '#6b7280', fontWeight: d.isCurrent ? '700' : '400' }}>
                    {d.solde >= 0 ? '+' : ''}{Math.round(d.solde / 1000)}k
                  </span>
                  <div style={{ width: '100%', height: barH, background: d.solde < 0 ? '#fca5a5' : color, borderRadius: '4px 4px 0 0', minHeight: 4 }} />
                  <span style={{ fontSize: 9, color: d.isCurrent ? '#0d3580' : '#9ca3af', fontWeight: d.isCurrent ? '700' : '400' }}>{d.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Onglets + filtres */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap', rowGap: 8 }}>
          {['encaissements', 'decaissements'].map(tab => (
            <button key={tab} onClick={() => setOnglet(tab)} style={{
              padding: '7px 14px', borderRadius: 20, border: 'none',
              fontSize: 12, fontWeight: onglet === tab ? '600' : '400',
              background: onglet === tab ? '#0d3580' : '#fff',
              color: onglet === tab ? '#fff' : '#6b7280',
              border: onglet === tab ? 'none' : '1px solid #e2e4ea',
              cursor: 'pointer',
            }}>
              {tab === 'encaissements' ? '↑ Encaissements' : '↓ Décaissements'}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: '1px solid #e2e4ea', borderRadius: 20, background: '#fff', fontSize: 12, color: '#374151', cursor: 'pointer' }}>
            <DownloadIcon style={{ fontSize: 14 }} />CSV
          </button>
        </div>

        {/* Barre de recherche + filtres */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher…"
            style={{ flex: 1, minWidth: 140, background: '#fff', border: '1.5px solid #e2e4ea', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', color: '#111111' }}
          />
          <input
            type="month" value={moisFiltre} onChange={e => setMoisFiltre(e.target.value)}
            style={{ background: '#fff', border: '1.5px solid #e2e4ea', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', color: '#111111' }}
          />
          <select
            value={catFiltre} onChange={e => setCatFiltre(e.target.value)}
            style={{ background: '#fff', border: '1.5px solid #e2e4ea', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', color: '#111111' }}
          >
            <option value="">Toutes catégories</option>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {/* Total période */}
        {!loading && filtered.length > 0 && (() => {
          const total = filtered.reduce((s, m) => s + m.montant, 0)
          const isEnc = onglet === 'encaissements'
          return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1.5px solid #0d3580', borderRadius: 10, padding: '10px 16px', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: '600', color: '#6b7280' }}>
                Total {moisFiltre ? `— ${new Date(moisFiltre + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}` : ''}
                <span style={{ marginLeft: 8, color: '#9ca3af', fontWeight: '400' }}>({filtered.length} mouvement{filtered.length > 1 ? 's' : ''})</span>
              </span>
              <span style={{ fontSize: 16, fontWeight: '700', color: isEnc ? '#16a34a' : '#dc2626' }}>
                {isEnc ? '+' : '-'}{formatEuro(total)}
              </span>
            </div>
          )
        })()}

        {/* Liste */}
        {loading
          ? <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>Chargement…</div>
          : filtered.length === 0
          ? <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: 14 }}>Aucun mouvement</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(m => {
                const cat   = CATEGORIES[m.categorie] || CATEGORIES.autre
                const isEnc = m.type === 'encaissement'
                return (
                  <div key={m.id} style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #e2e4ea', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isEnc
                        ? <ArrowUpwardIcon style={{ fontSize: 18, color: cat.color }} />
                        : <ArrowDownwardIcon style={{ fontSize: 18, color: cat.color }} />
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: '600', color: '#111111', margin: 0 }}>{m.label}</p>
                      <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>
                        {cat.label} · {formatDate(m.date)} · {MODE_LABELS[m.modePaiement] || m.modePaiement || ''}
                        {m.source === 'auto' && <span style={{ marginLeft: 6, fontSize: 10, background: '#e8edf8', color: '#0d3580', padding: '1px 6px', borderRadius: 10, fontWeight: '600' }}>Auto</span>}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <p style={{ fontSize: 16, fontWeight: '700', color: isEnc ? '#16a34a' : '#dc2626', margin: 0, whiteSpace: 'nowrap' }}>
                        {isEnc ? '+' : '-'}{formatEuro(m.montant)}
                      </p>
                      {isPatron && (
                        <button onClick={() => supprimerMouvement(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', opacity: 0.4, transition: 'opacity 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.opacity = 1}
                          onMouseLeave={e => e.currentTarget.style.opacity = 0.4}>
                          <DeleteIcon style={{ fontSize: 17, color: '#dc2626' }} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        }
      </div>

      {/* Modal ajout */}
      {modalOpen && isPatron && <ModalAjout onClose={() => setModalOpen(false)} onSave={ajouterMouvement} />}
    </div>
  )
}

function KPI({ icon, label, value, valueColor }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>{icon}<span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>{label}</span></div>
      <p style={{ fontSize: 16, fontWeight: '700', color: valueColor, margin: 0 }}>{value}</p>
    </div>
  )
}

function ModalAjout({ onClose, onSave }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ type: 'decaissement', categorie: 'autre', label: '', montant: '', date: today, modePaiement: 'virement', note: '' })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    if (!form.label || !form.montant) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <form onSubmit={submit} style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 17, fontWeight: '600', color: '#111111', margin: 0 }}>Nouveau mouvement</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><CloseIcon style={{ fontSize: 20, color: '#9ca3af' }} /></button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['encaissement', 'decaissement'].map(t => (
            <button type="button" key={t} onClick={() => set('type', t)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: '600', background: form.type === t ? (t === 'encaissement' ? '#dcfce7' : '#fee2e2') : '#f3f4f6', color: form.type === t ? (t === 'encaissement' ? '#16a34a' : '#dc2626') : '#6b7280', cursor: 'pointer' }}>
              {t === 'encaissement' ? '↑ Encaissement' : '↓ Décaissement'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Catégorie">
            <select value={form.categorie} onChange={e => set('categorie', e.target.value)} style={inpS}>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Description *">
            <input value={form.label} onChange={e => set('label', e.target.value)} placeholder="Ex: Paiement Dupont SAS" style={inpS} required />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Montant (€) *">
              <input type="number" step="0.01" min="0" value={form.montant} onChange={e => set('montant', e.target.value)} placeholder="0.00" style={inpS} inputMode="decimal" required />
            </Field>
            <Field label="Date">
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inpS} />
            </Field>
          </div>
          <Field label="Mode de paiement">
            <select value={form.modePaiement} onChange={e => set('modePaiement', e.target.value)} style={inpS}>
              {MODES.map(m => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
            </select>
          </Field>
          <Field label="Note">
            <input value={form.note} onChange={e => set('note', e.target.value)} placeholder="Optionnel" style={inpS} />
          </Field>
        </div>

        <button type="submit" disabled={saving} style={{ width: '100%', marginTop: 20, background: saving ? '#c8d3ee' : '#0d3580', color: '#fff', border: 'none', borderRadius: 10, padding: 13, fontSize: 15, fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Enregistrement…' : 'Ajouter le mouvement'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

const inpS = { width: '100%', boxSizing: 'border-box', background: '#F0F2F7', border: '1.5px solid transparent', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: '#111111', outline: 'none', fontFamily: 'inherit' }
