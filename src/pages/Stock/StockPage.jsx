import { useState, useMemo, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { useStock } from '../../hooks/useStock'
import { CATEGORIES_STOCK_LABELS, ETAT_STOCK } from '../../constants/statuts'
import AddIcon         from '@mui/icons-material/Add'
import InventoryIcon   from '@mui/icons-material/Inventory'
import WarningIcon     from '@mui/icons-material/Warning'
import QrCodeIcon      from '@mui/icons-material/QrCode'
import DownloadIcon    from '@mui/icons-material/Download'
import CloseIcon       from '@mui/icons-material/Close'
import EditIcon        from '@mui/icons-material/Edit'
import DeleteIcon      from '@mui/icons-material/Delete'

const ETATS_LABELS = { bon: 'Bon état', usage: 'Usagé', maintenance: 'Maintenance', rebut: 'Rebut' }

export default function StockPage() {
  const { stock, loading, creerArticle, mettreAJourArticle, supprimerArticle } = useStock()
  const [formOpen,   setFormOpen]   = useState(false)
  const [filtreCat,  setFiltreCat]  = useState('')
  const [filtreEtat, setFiltreEtat] = useState('')
  const [editArticle, setEditArticle] = useState(null)

  const alertes = useMemo(() => stock.filter(s => s.quantiteDisponible < s.quantiteMin), [stock])
  const [qrArticle, setQrArticle] = useState(null)

  const stockFiltre = useMemo(() => stock.filter(s => {
    const matchCat  = !filtreCat  || s.categorie === filtreCat
    const matchEtat = !filtreEtat || s.etat       === filtreEtat
    return matchCat && matchEtat
  }), [stock, filtreCat, filtreEtat])

  if (formOpen) return <ArticleForm onClose={() => setFormOpen(false)} onSave={creerArticle} />

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#0d3580', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: '700', color: '#fff', margin: 0 }}>Stock matériel</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0' }}>{stock.length} article(s) · {alertes.length} alerte(s)</p>
        </div>
        <button onClick={() => setFormOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#E8A838', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: '600', cursor: 'pointer' }}>
          <AddIcon style={{ fontSize: 18 }} />Ajouter
        </button>
      </div>

      {alertes.length > 0 && (
        <div style={{ margin: '14px 24px 0', background: '#ffedd5', borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <WarningIcon style={{ fontSize: 18, color: '#c2410c' }} />
            <span style={{ fontSize: 13, fontWeight: '600', color: '#c2410c' }}>Stock bas — {alertes.length} article(s)</span>
          </div>
          {alertes.map(a => (
            <p key={a.id} style={{ fontSize: 12, color: '#c2410c', margin: '2px 0 0' }}>
              {a.nom} : {a.quantiteDisponible}/{a.quantiteMin} (min)
            </p>
          ))}
        </div>
      )}

      <div style={{ padding: '14px 24px', display: 'flex', gap: 10 }}>
        <select value={filtreCat} onChange={e => setFiltreCat(e.target.value)} style={{ background: '#FFFFFF', border: '1.5px solid #e2e4ea', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }}>
          <option value="">Toutes catégories</option>
          {Object.entries(CATEGORIES_STOCK_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={filtreEtat} onChange={e => setFiltreEtat(e.target.value)} style={{ background: '#FFFFFF', border: '1.5px solid #e2e4ea', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }}>
          <option value="">Tous états</option>
          {Object.entries(ETATS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #0d3580', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0d3580' }}>
                {['Article', 'Catégorie', 'Disponible', 'Total', 'Min', 'État', ''].map(h => (
                  <th key={h} style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)', padding: '10px 14px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Chargement…</td></tr>
                : stockFiltre.length === 0
                ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}><InventoryIcon style={{ fontSize: 40, color: '#c8d3ee' }} /><p style={{ color: '#6b7280', margin: '8px 0 0' }}>Aucun article</p></td></tr>
                : stockFiltre.map((s, i) => {
                    const alertStock = s.quantiteDisponible < s.quantiteMin
                    return (
                      <tr key={s.id} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F7F8FA', borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: '500', color: '#111111' }}>{s.nom}</td>
                        <td style={{ padding: '12px 14px', fontSize: 13, color: '#6b7280' }}>{CATEGORIES_STOCK_LABELS[s.categorie] || s.categorie}</td>
                        <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: '600', color: alertStock ? '#c2410c' : '#16a34a' }}>
                          {s.quantiteDisponible}
                          {alertStock && <WarningIcon style={{ fontSize: 14, marginLeft: 4, verticalAlign: 'middle', color: '#c2410c' }} />}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 13, color: '#3d3d3d' }}>{s.quantiteTotale}</td>
                        <td style={{ padding: '12px 14px', fontSize: 13, color: '#6b7280' }}>{s.quantiteMin}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: '600', padding: '2px 8px', borderRadius: 20, background: s.etat === 'bon' ? '#dcfce7' : s.etat === 'maintenance' ? '#fef9c3' : '#fee2e2', color: s.etat === 'bon' ? '#16a34a' : s.etat === 'maintenance' ? '#a16207' : '#dc2626' }}>
                            {ETATS_LABELS[s.etat] || s.etat}
                          </span>
                        </td>
                        <td style={{ padding: '8px 14px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => setQrArticle(s)} title="QR code" style={{ background: '#e8edf8', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: '#0d3580', display: 'flex' }}>
                              <QrCodeIcon style={{ fontSize: 16 }} />
                            </button>
                            <button onClick={() => setEditArticle(s)} title="Modifier" style={{ background: '#e8edf8', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: '#0d3580', display: 'flex' }}>
                              <EditIcon style={{ fontSize: 16 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
        </div>
      </div>

      {qrArticle   && <QRModal article={qrArticle} onClose={() => setQrArticle(null)} />}
      {editArticle && (
        <ArticleEditModal
          article={editArticle}
          onClose={() => setEditArticle(null)}
          onSave={async (data) => { await mettreAJourArticle(editArticle.id, data); setEditArticle(null) }}
          onDelete={async () => {
            if (!window.confirm(`Supprimer "${editArticle.nom}" définitivement ?`)) return
            await supprimerArticle(editArticle.id)
            setEditArticle(null)
          }}
        />
      )}
    </div>
  )
}

function QRModal({ article, onClose }) {
  const canvasRef = useRef(null)
  const [dataUrl, setDataUrl] = useState('')

  const qrContent = `scaffold-os:stock:${article.id}\nArticle: ${article.nom}\nDisponible: ${article.quantiteDisponible}/${article.quantiteTotale}\nÉtat: ${article.etat}`

  useEffect(() => {
    QRCode.toDataURL(qrContent, { width: 240, margin: 2, color: { dark: '#0d3580', light: '#ffffff' } })
      .then(url => setDataUrl(url))
      .catch(console.error)
  }, [qrContent])

  function telecharger() {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `qr-${article.nom.replace(/\s+/g, '-').toLowerCase()}.png`
    a.click()
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}
    >
      <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '24px 28px', textAlign: 'center', maxWidth: 320, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: '600', color: '#111111', margin: 0 }}>QR Code</h2>
          <button onClick={onClose} style={{ background: '#F0F2F7', border: 'none', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: '#6b7280', display: 'flex' }}>
            <CloseIcon style={{ fontSize: 18 }} />
          </button>
        </div>

        <p style={{ fontSize: 15, fontWeight: '600', color: '#111111', margin: '0 0 4px' }}>{article.nom}</p>
        <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 16px' }}>
          {CATEGORIES_STOCK_LABELS[article.categorie] || article.categorie}
          {' · '}
          {article.quantiteDisponible} disponible(s) / {article.quantiteTotale} total
        </p>

        {dataUrl ? (
          <img src={dataUrl} alt="QR Code" style={{ width: 200, height: 200, borderRadius: 12, border: '1.5px solid #e2e4ea', margin: '0 auto', display: 'block' }} />
        ) : (
          <div style={{ width: 200, height: 200, background: '#F0F2F7', borderRadius: 12, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <QrCodeIcon style={{ fontSize: 48, color: '#c8d3ee' }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, background: '#F0F2F7', color: '#111111', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, cursor: 'pointer' }}>
            Fermer
          </button>
          <button onClick={telecharger} disabled={!dataUrl} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#0d3580', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: '500', cursor: 'pointer' }}>
            <DownloadIcon style={{ fontSize: 16 }} />PNG
          </button>
        </div>
      </div>
    </div>
  )
}

function ArticleEditModal({ article, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    nom:               article.nom               || '',
    categorie:         article.categorie         || 'cadres',
    quantiteTotale:    article.quantiteTotale    ?? 0,
    quantiteDisponible:article.quantiteDisponible?? 0,
    quantiteMin:       article.quantiteMin       ?? 5,
    etat:              article.etat              || 'bon',
    prixAchat:         article.prixAchat         ?? 0,
    notes:             article.notes             || '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try { await onSave(form) } catch (err) { alert(err.message); setSaving(false) }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '24px 26px', maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: '600', color: '#111111', margin: 0 }}>Modifier l'article</h2>
          <button onClick={onClose} style={{ background: '#F0F2F7', border: 'none', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: '#6b7280', display: 'flex' }}>
            <CloseIcon style={{ fontSize: 18 }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={lblS}>Nom</label>
            <input value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))} required style={inpS} />
          </div>
          <div>
            <label style={lblS}>Catégorie</label>
            <select value={form.categorie} onChange={e => setForm(p => ({ ...p, categorie: e.target.value }))} style={inpS}>
              {Object.entries(CATEGORIES_STOCK_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={lblS}>État</label>
            <select value={form.etat} onChange={e => setForm(p => ({ ...p, etat: e.target.value }))} style={inpS}>
              {Object.entries(ETATS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>

          <div style={{ background: '#F7F8FA', borderRadius: 10, padding: '12px 14px' }}>
            <label style={{ ...lblS, marginBottom: 10 }}>Quantité disponible</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="button" onClick={() => setForm(p => ({ ...p, quantiteDisponible: Math.max(0, p.quantiteDisponible - 1) }))} style={{ width: 36, height: 36, borderRadius: 8, border: '1.5px solid #e2e4ea', background: '#fff', fontSize: 20, cursor: 'pointer', color: '#dc2626', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
              <input type="number" value={form.quantiteDisponible} onChange={e => setForm(p => ({ ...p, quantiteDisponible: parseInt(e.target.value) || 0 }))} style={{ ...inpS, textAlign: 'center', width: 80, fontWeight: '700', fontSize: 18 }} />
              <button type="button" onClick={() => setForm(p => ({ ...p, quantiteDisponible: p.quantiteDisponible + 1 }))} style={{ width: 36, height: 36, borderRadius: 8, border: '1.5px solid #e2e4ea', background: '#fff', fontSize: 20, cursor: 'pointer', color: '#16a34a', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lblS}>Quantité totale</label>
              <input type="number" value={form.quantiteTotale} onChange={e => setForm(p => ({ ...p, quantiteTotale: parseInt(e.target.value) || 0 }))} style={inpS} />
            </div>
            <div>
              <label style={lblS}>Quantité minimum</label>
              <input type="number" value={form.quantiteMin} onChange={e => setForm(p => ({ ...p, quantiteMin: parseInt(e.target.value) || 0 }))} style={inpS} />
            </div>
          </div>

          <div>
            <label style={lblS}>Prix d'achat (€)</label>
            <input type="number" value={form.prixAchat} onChange={e => setForm(p => ({ ...p, prixAchat: parseFloat(e.target.value) || 0 }))} style={inpS} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button type="button" onClick={onDelete} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: '600', cursor: 'pointer' }}>
              <DeleteIcon style={{ fontSize: 16 }} />Supprimer
            </button>
            <button type="submit" disabled={saving} style={{ flex: 1, background: '#0d3580', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: '600', cursor: 'pointer' }}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ArticleForm({ onClose, onSave }) {
  const [form, setForm] = useState({ nom: '', categorie: 'cadres', quantiteTotale: 0, quantiteMin: 5, etat: 'bon', prixAchat: 0, notes: '' })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try { await onSave(form); onClose() } catch (err) { alert(err.message) } finally { setSaving(false) }
  }

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', padding: 24 }}>
      <button onClick={onClose} style={{ marginBottom: 16, background: 'transparent', border: 'none', color: '#0d3580', fontSize: 14, cursor: 'pointer', fontWeight: '500' }}>← Retour</button>
      <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1.5px solid #0d3580', padding: 24, maxWidth: 500 }}>
        <h2 style={{ fontSize: 17, fontWeight: '600', color: '#111111', margin: '0 0 20px' }}>Nouvel article</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[['Nom de l\'article', 'nom', 'text'], ['Prix d\'achat (€)', 'prixAchat', 'number']].map(([l, k, t]) => (
            <div key={k}>
              <label style={lblS}>{l}</label>
              <input type={t} value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: t === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))} required={k === 'nom'} style={inpS} />
            </div>
          ))}
          <div>
            <label style={lblS}>Catégorie</label>
            <select value={form.categorie} onChange={e => setForm(p => ({ ...p, categorie: e.target.value }))} style={inpS}>
              {Object.entries(CATEGORIES_STOCK_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lblS}>Quantité totale</label><input type="number" value={form.quantiteTotale} onChange={e => setForm(p => ({ ...p, quantiteTotale: parseInt(e.target.value) || 0 }))} style={inpS} /></div>
            <div><label style={lblS}>Quantité minimum</label><input type="number" value={form.quantiteMin} onChange={e => setForm(p => ({ ...p, quantiteMin: parseInt(e.target.value) || 0 }))} style={inpS} /></div>
          </div>
          <button type="submit" disabled={saving} style={{ background: '#0d3580', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 14, fontWeight: '600', cursor: 'pointer', marginTop: 8 }}>
            {saving ? 'Enregistrement…' : 'Créer l\'article'}
          </button>
        </form>
      </div>
    </div>
  )
}

const lblS = { fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }
const inpS = { width: '100%', boxSizing: 'border-box', background: '#F0F2F7', border: '1.5px solid transparent', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: '#111111', outline: 'none' }
