import { useState, useRef, useEffect } from 'react'
import { useClients } from '../../hooks/useClients'
import ClientQuickCreate from './ClientQuickCreate'
import PersonIcon from '@mui/icons-material/Person'
import AddIcon    from '@mui/icons-material/Add'
import CloseIcon  from '@mui/icons-material/Close'

const TVA_BADGE = {
  normal:         { label: '20%',   bg: '#e8edf8', color: '#0d3580' },
  reduit:         { label: '10%',   bg: '#fef3c7', color: '#92400e' },
  autoliquidation:{ label: '0%',    bg: '#f3f4f6', color: '#374151' },
}

export default function ClientSelector({ value, onChange }) {
  const { clients } = useClients()
  const [search, setSearch]         = useState('')
  const [open,   setOpen]           = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const wrapRef = useRef(null)

  const selected = value ? clients.find(c => c.id === value) : null

  const filtered = clients.filter(c => {
    if (!c.actif) return false
    const s = search.toLowerCase()
    return !s || c.nom?.toLowerCase().includes(s) || c.telephone?.includes(s) || c.siret?.includes(s)
  })

  useEffect(() => {
    function onClickOut(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClickOut)
    return () => document.removeEventListener('mousedown', onClickOut)
  }, [])

  function select(client) {
    onChange(client)
    setOpen(false)
    setSearch('')
  }

  function handleCreated(client) {
    setShowCreate(false)
    onChange(client)
  }

  const tva = selected ? TVA_BADGE[selected.regimeTVADefaut] : null

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {/* Champ affiché */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F0F2F7', border: '1.5px solid transparent', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', minHeight: 44 }}
      >
        {selected ? (
          <>
            <Avatar nom={selected.nom} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: '500', color: '#111111', margin: 0 }}>{selected.nom}</p>
              <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{selected.adresse?.ville || ''} · {selected.telephone}</p>
            </div>
            {tva && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: tva.bg, color: tva.color, fontWeight: '600' }}>TVA {tva.label}</span>}
            <button type="button" onClick={e => { e.stopPropagation(); onChange(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
              <CloseIcon style={{ fontSize: 16, color: '#9ca3af' }} />
            </button>
          </>
        ) : (
          <span style={{ fontSize: 14, color: '#9ca3af' }}>Sélectionner un client…</span>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 500, background: '#fff', borderRadius: 10, border: '1.5px solid #0d3580', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', marginTop: 4, overflow: 'hidden' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher nom, tél, SIRET…"
              style={{ width: '100%', boxSizing: 'border-box', background: '#F0F2F7', border: 'none', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <p style={{ padding: '12px 16px', fontSize: 13, color: '#9ca3af', margin: 0 }}>Aucun client trouvé</p>
            )}
            {filtered.map(c => {
              const badge = TVA_BADGE[c.regimeTVADefaut]
              return (
                <div
                  key={c.id}
                  onClick={() => select(c)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f9fafb' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f3f6ff'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Avatar nom={c.nom} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: '600', color: '#111111', margin: 0 }}>{c.nom}</p>
                    <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{c.adresse?.ville || ''} · {c.telephone}</p>
                  </div>
                  {badge && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: badge.bg, color: badge.color, fontWeight: '600' }}>TVA {badge.label}</span>}
                </div>
              )
            })}
          </div>
          <div
            onClick={() => { setOpen(false); setShowCreate(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderTop: '1px solid #f3f4f6', cursor: 'pointer', color: '#0d3580', fontSize: 13, fontWeight: '600' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f3f6ff'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <AddIcon style={{ fontSize: 18 }} />Nouveau client
          </div>
        </div>
      )}

      {showCreate && <ClientQuickCreate onCreated={handleCreated} onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function Avatar({ nom }) {
  const i = (nom || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#0d3580', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: '700', color: '#fff', flexShrink: 0 }}>
      {i || <PersonIcon style={{ fontSize: 14 }} />}
    </div>
  )
}
