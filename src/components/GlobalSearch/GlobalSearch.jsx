import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { globalSearch, highlight } from '../../utils/globalSearch'
import SearchIcon        from '@mui/icons-material/Search'
import CloseIcon         from '@mui/icons-material/Close'
import PersonIcon        from '@mui/icons-material/Person'
import DescriptionIcon   from '@mui/icons-material/Description'
import ConstructionIcon  from '@mui/icons-material/Construction'
import PeopleIcon        from '@mui/icons-material/People'
import { BADGES } from '../../constants/theme'
import { formatEuro }    from '../../utils/formatters'

export default function GlobalSearch() {
  const { role } = useAuth()
  if (role !== 'patron') return null
  return <GlobalSearchInner />
}

function GlobalSearchInner() {
  const navigate   = useNavigate()
  const [open, setOpen]     = useState(false)
  const [term, setTerm]     = useState('')
  const [results, setResults] = useState({})
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(-1)
  const inputRef   = useRef(null)
  const timerRef   = useRef(null)

  // Raccourci Ctrl+K / Cmd+K
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else { setTerm(''); setResults({}); setFocused(-1) }
  }, [open])

  // Debounce 300ms
  useEffect(() => {
    clearTimeout(timerRef.current)
    if (term.length < 2) { setResults({}); return }
    setLoading(true)
    timerRef.current = setTimeout(async () => {
      const r = await globalSearch(term)
      setResults(r)
      setLoading(false)
      setFocused(-1)
    }, 300)
    return () => clearTimeout(timerRef.current)
  }, [term])

  // Flatten items for keyboard nav
  const allItems = [
    ...(results.clients   || []).map(c => ({ type: 'client',   data: c, path: `/clients/${c.id}` })),
    ...(results.factures  || []).map(f => ({ type: 'facture',  data: f, path: `/factures/${f.id}` })),
    ...(results.chantiers || []).map(c => ({ type: 'chantier', data: c, path: `/chantiers/${c.id}` })),
    ...(results.ouvriers  || []).map(u => ({ type: 'ouvrier',  data: u, path: `/personnel/${u.id}` })),
  ]

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, allItems.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocused(f => Math.max(f - 1, -1)) }
    if (e.key === 'Enter' && focused >= 0) go(allItems[focused].path)
  }

  function go(path) { navigate(path); setOpen(false) }

  const HL = ({ text }) => {
    const marked = highlight(text, term)
    const parts  = marked.split(/(##MARK##.*?##\/MARK##)/)
    return (
      <span>
        {parts.map((p, i) => {
          if (p.startsWith('##MARK##')) {
            return <mark key={i} style={{ background: '#fef9c3', color: '#92400e', borderRadius: 2, padding: '0 1px' }}>{p.replace('##MARK##', '').replace('##/MARK##', '')}</mark>
          }
          return <span key={i}>{p}</span>
        })}
      </span>
    )
  }

  const hasResults = allItems.length > 0

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Recherche globale (Ctrl+K)"
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 8, padding: '6px 12px', color: 'rgba(255,255,255,0.7)',
          fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <SearchIcon style={{ fontSize: 16 }} />
        Recherche
        <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.15)', borderRadius: 4, padding: '1px 5px' }}>Ctrl K</span>
      </button>
    )
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        paddingTop: 80, padding: '80px 16px 16px',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 560,
        background: '#ffffff', borderRadius: 14,
        border: '1.5px solid #0d3580',
        boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}>
        {/* Champ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #e2e4ea' }}>
          <SearchIcon style={{ fontSize: 20, color: '#0d3580', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={term}
            onChange={e => setTerm(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Rechercher client, facture, chantier, ouvrier…"
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: 15, color: '#111111', background: 'transparent',
              fontFamily: 'inherit',
            }}
          />
          {loading && <span style={{ fontSize: 11, color: '#6b7280' }}>…</span>}
          <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
            <CloseIcon style={{ fontSize: 18, color: '#9ca3af' }} />
          </button>
        </div>

        {/* Résultats */}
        <div style={{ maxHeight: 440, overflowY: 'auto' }}>
          {term.length < 2 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              Tapez au moins 2 caractères pour rechercher
            </div>
          )}
          {term.length >= 2 && !loading && !hasResults && (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              Aucun résultat pour «&nbsp;{term}&nbsp;»
            </div>
          )}

          {results.clients?.length > 0 && (
            <Section label="Clients" icon={<PersonIcon style={{ fontSize: 14 }} />}>
              {results.clients.map((c, i) => {
                const idx = allItems.findIndex(a => a.data === c)
                return (
                  <ResultRow key={c.id} isFocused={focused === idx} onClick={() => go(`/clients/${c.id}`)}>
                    <Avatar nom={c.nom} />
                    <div style={{ flex: 1 }}>
                      <p style={nameS}><HL text={c.nom} /></p>
                      <p style={subS}>{c.adresse?.ville || '—'} · {c.telephone}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Badge>{c.type === 'pro' ? 'Pro' : 'Particulier'}</Badge>
                      {c.nbFactures > 0 && <Badge>{c.nbFactures} fact.</Badge>}
                    </div>
                  </ResultRow>
                )
              })}
            </Section>
          )}

          {results.factures?.length > 0 && (
            <Section label="Factures" icon={<DescriptionIcon style={{ fontSize: 14 }} />}>
              {results.factures.map(f => {
                const idx = allItems.findIndex(a => a.data === f)
                const badge = BADGES?.[f.statut] || { background: '#f3f4f6', color: '#374151' }
                return (
                  <ResultRow key={f.id} isFocused={focused === idx} onClick={() => go(`/factures/${f.id}`)}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#e8edf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <DescriptionIcon style={{ fontSize: 16, color: '#0d3580' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={nameS}><HL text={f.numero} /> · <HL text={f.clientNom || ''} /></p>
                      <p style={subS}><HL text={f.chantierNom || ''} /></p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <p style={{ fontSize: 13, fontWeight: '600', color: '#0d3580', margin: 0 }}>{formatEuro(f.totalTTC)}</p>
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, fontWeight: '600', ...badge }}>{f.statut}</span>
                    </div>
                  </ResultRow>
                )
              })}
            </Section>
          )}

          {results.chantiers?.length > 0 && (
            <Section label="Chantiers" icon={<ConstructionIcon style={{ fontSize: 14 }} />}>
              {results.chantiers.map(c => {
                const idx = allItems.findIndex(a => a.data === c)
                return (
                  <ResultRow key={c.id} isFocused={focused === idx} onClick={() => go(`/chantiers/${c.id}`)}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ConstructionIcon style={{ fontSize: 16, color: '#d97706' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={nameS}><HL text={c.nom} /></p>
                      <p style={subS}><HL text={c.clientNom || ''} /> · <HL text={c.adresse?.ville || ''} /></p>
                    </div>
                    <Badge>{c.statut}</Badge>
                  </ResultRow>
                )
              })}
            </Section>
          )}

          {results.ouvriers?.length > 0 && (
            <Section label="Ouvriers" icon={<PeopleIcon style={{ fontSize: 14 }} />}>
              {results.ouvriers.map(u => {
                const idx = allItems.findIndex(a => a.data === u)
                return (
                  <ResultRow key={u.id} isFocused={focused === idx} onClick={() => go(`/personnel/${u.id}`)}>
                    <Avatar nom={`${u.prenom || ''} ${u.nom || ''}`.trim()} />
                    <div style={{ flex: 1 }}>
                      <p style={nameS}><HL text={`${u.prenom || ''} ${u.nom || ''}`.trim()} /></p>
                      <p style={subS}><HL text={u.telephone || ''} /></p>
                    </div>
                    <Badge color={u.actif ? '#dcfce7' : '#fee2e2'} textColor={u.actif ? '#16a34a' : '#dc2626'}>
                      {u.actif ? 'Actif' : 'Inactif'}
                    </Badge>
                  </ResultRow>
                )
              })}
            </Section>
          )}

          {hasResults && (
            <div style={{ padding: '8px 16px', fontSize: 11, color: '#9ca3af', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 16 }}>
              <span>↑↓ Naviguer</span>
              <span>↵ Ouvrir</span>
              <span>Échap Fermer</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ label, icon, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px 4px', color: '#6b7280', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {icon}{label}
      </div>
      {children}
    </div>
  )
}

function ResultRow({ children, onClick, isFocused }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px', cursor: 'pointer',
        background: isFocused ? '#e8edf8' : 'transparent',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#f3f6ff' }}
      onMouseLeave={e => { e.currentTarget.style.background = isFocused ? '#e8edf8' : 'transparent' }}
    >
      {children}
    </div>
  )
}

function Avatar({ nom }) {
  const initiales = (nom || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0d3580', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: '700', color: '#fff', flexShrink: 0 }}>
      {initiales || '?'}
    </div>
  )
}

function Badge({ children, color = '#e8edf8', textColor = '#0d3580' }) {
  return (
    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: color, color: textColor, fontWeight: '600', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

const nameS = { fontSize: 13, fontWeight: '600', color: '#111111', margin: 0 }
const subS  = { fontSize: 11, color: '#6b7280', margin: '1px 0 0' }
