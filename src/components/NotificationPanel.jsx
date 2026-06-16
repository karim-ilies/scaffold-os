import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useNotifications } from '../hooks/useNotifications'
import { useResponsive } from '../hooks/useResponsive'
import { envoyerEmailRelance, EMAILJS_FACTURE_CONFIGURE } from '../utils/emailFacture'
import { useParametres } from '../hooks/useParametres'
import NotificationsIcon       from '@mui/icons-material/Notifications'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import CloseIcon               from '@mui/icons-material/Close'
import DoneAllIcon             from '@mui/icons-material/DoneAll'
import WarningIcon             from '@mui/icons-material/Warning'
import AccessTimeIcon          from '@mui/icons-material/AccessTime'
import CheckCircleIcon         from '@mui/icons-material/CheckCircle'
import InventoryIcon           from '@mui/icons-material/Inventory'
import ReceiptIcon             from '@mui/icons-material/Receipt'
import DescriptionIcon         from '@mui/icons-material/Description'
import PersonIcon              from '@mui/icons-material/Person'

// ── Config par type ──────────────────────────────────────────────────────────
const TYPE_CFG = {
  retard_facture:    { color: '#dc2626', bg: '#fee2e2', Icon: WarningIcon      },
  stock_bas:         { color: '#dc2626', bg: '#fee2e2', Icon: InventoryIcon    },
  pointage_verifier: { color: '#d97706', bg: '#fef9c3', Icon: AccessTimeIcon   },
  document_expire:   { color: '#d97706', bg: '#fef9c3', Icon: PersonIcon       },
  devis_expire:      { color: '#d97706', bg: '#fef9c3', Icon: DescriptionIcon  },
  ticket_attente:    { color: '#0d3580', bg: '#e8edf8', Icon: ReceiptIcon      },
  pointage_valide:   { color: '#16a34a', bg: '#dcfce7', Icon: CheckCircleIcon  },
  pointage_rejete:   { color: '#dc2626', bg: '#fee2e2', Icon: WarningIcon      },
  ticket_approuve:   { color: '#16a34a', bg: '#dcfce7', Icon: CheckCircleIcon  },
  ticket_refuse:     { color: '#dc2626', bg: '#fee2e2', Icon: WarningIcon      },
}
const DEFAULT_CFG = { color: '#6b7280', bg: '#f3f4f6', Icon: NotificationsIcon }

function tempsRelatif(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const min  = Math.floor(diff / 60000)
  if (min < 2)  return 'à l\'instant'
  if (min < 60) return `il y a ${min}min`
  const h = Math.floor(diff / 3600000)
  if (h < 24)   return `il y a ${h}h`
  const d = Math.floor(diff / 86400000)
  if (d === 1)  return 'hier'
  if (d < 7)    return `il y a ${d} jours`
  return new Date(ts).toLocaleDateString('fr-FR')
}

function grouperNotifs(notifs) {
  const auj    = new Date(); auj.setHours(0, 0, 0, 0)
  const semaine = new Date(auj); semaine.setDate(semaine.getDate() - 7)
  return [
    { label: "Aujourd'hui",   items: notifs.filter(n => n._ts >= auj.getTime()) },
    { label: 'Cette semaine', items: notifs.filter(n => n._ts >= semaine.getTime() && n._ts < auj.getTime()) },
    { label: 'Plus ancien',   items: notifs.filter(n => n._ts < semaine.getTime()) },
  ].filter(g => g.items.length > 0)
}

// ── Composant principal ──────────────────────────────────────────────────────
// placement = 'sidebar'  → cloche inline dans la sidebar desktop (fond bleu, icône blanche)
// placement = 'mobile'   → cloche fixed bottom-right (fond blanc, icône bleue)
export default function NotificationPanel({ placement = 'mobile' }) {
  const { notifications, nbNonLues, marquerLue, marquerToutesLues, supprimerNotification } = useNotifications()
  const { isMobile } = useResponsive()
  const { parametres } = useParametres()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [relancingId, setRelancingId] = useState(null)
  const [relanceStatut, setRelanceStatut] = useState({}) // { [notifId]: 'ok' | 'err' }

  async function handleRelance(notif) {
    if (relancingId) return
    setRelancingId(notif.id)
    try {
      const clientSnap = await getDoc(doc(db, 'clients', notif.clientId))
      const client = clientSnap.exists() ? { id: clientSnap.id, ...clientSnap.data() } : null
      if (!client?.email) throw new Error('Email client manquant')
      const societeNom = parametres?.nom || 'Scaffold-OS'
      await envoyerEmailRelance({ facture: notif.factureData, client, joursRetard: notif.joursRetard, societeNom })
      setRelanceStatut(prev => ({ ...prev, [notif.id]: 'ok' }))
    } catch (e) {
      setRelanceStatut(prev => ({ ...prev, [notif.id]: 'err' }))
    } finally {
      setRelancingId(null)
    }
  }

  const panelW = isMobile ? '100vw' : '340px'

  function handleClick(notif) {
    marquerLue(notif.id)
    setOpen(false)
    navigate(notif.lien)
  }

  // ── Style du bouton selon le placement ──────────────────────────────────
  const isSidebar = placement === 'sidebar'

  const bellWrapperStyle = isSidebar
    ? { position: 'relative', display: 'inline-flex' }          // inline dans la sidebar
    : { position: 'fixed', bottom: 76, right: 16, zIndex: 10000 } // flottant mobile

  const bellBtnStyle = {
    position:     'relative',
    background:   isSidebar
      ? (open ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)')
      : (open ? '#0d3580' : '#ffffff'),
    border:       'none',
    borderRadius: 10,
    padding:      '6px 8px',
    cursor:       'pointer',
    display:      'flex',
    alignItems:   'center',
    color:        isSidebar ? '#ffffff' : (open ? '#fff' : '#0d3580'),
    boxShadow:    isSidebar ? 'none' : '0 2px 12px rgba(0,0,0,0.18)',
    transition:   'background 0.15s',
  }

  const groupes = grouperNotifs(notifications)

  return (
    <>
      {/* Bouton cloche */}
      <div style={bellWrapperStyle}>
        <button onClick={() => setOpen(o => !o)} style={bellBtnStyle} title="Notifications">
          {nbNonLues > 0
            ? <NotificationsActiveIcon style={{ fontSize: 20 }} />
            : <NotificationsIcon style={{ fontSize: 20 }} />
          }
          {nbNonLues > 0 && (
            <span style={{
              position:   'absolute',
              top: -5, right: -5,
              background: '#dc2626',
              color:      '#fff',
              fontSize:   9,
              fontWeight: '700',
              lineHeight: 1,
              padding:    '2px 4px',
              borderRadius: 10,
              minWidth:   14,
              textAlign:  'center',
              border:     isSidebar ? '2px solid #0d3580' : '2px solid #F7F8FA',
              animation:  'pulse-badge 1.5s ease infinite',
            }}>
              {nbNonLues > 99 ? '99+' : nbNonLues}
            </span>
          )}
        </button>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 10001 }}
        />
      )}

      {/* Panneau slide-in depuis la droite */}
      <div style={{
        position:   'fixed',
        top: 0, right: 0, bottom: 0,
        width:      panelW,
        background: '#fff',
        boxShadow:  '-4px 0 24px rgba(0,0,0,0.15)',
        zIndex:     10002,
        display:    'flex',
        flexDirection: 'column',
        transform:  open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        {/* Header panneau */}
        <div style={{ background: '#0d3580', padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NotificationsIcon style={{ color: '#fff', fontSize: 20 }} />
            <span style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Notifications</span>
            {nbNonLues > 0 && (
              <span style={{ background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: '700', padding: '1px 6px', borderRadius: 10 }}>
                {nbNonLues}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {nbNonLues > 0 && (
              <button onClick={marquerToutesLues} title="Tout marquer comme lu"
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center' }}>
                <DoneAllIcon style={{ fontSize: 18 }} />
              </button>
            )}
            <button onClick={() => setOpen(false)}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center' }}>
              <CloseIcon style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          {notifications.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 40 }}>
              <CheckCircleIcon style={{ fontSize: 48, color: '#c8d3ee', marginBottom: 12 }} />
              <p style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', margin: 0 }}>Aucune notification</p>
              <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', margin: '4px 0 0' }}>Tout est en ordre ✓</p>
            </div>
          ) : (
            groupes.map(g => (
              <div key={g.label}>
                <p style={{ fontSize: 10, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 18px 4px', margin: 0 }}>
                  {g.label}
                </p>
                {g.items.map(notif => (
                  <NotifItem
                    key={notif.id}
                    notif={notif}
                    onClick={handleClick}
                    onDelete={supprimerNotification}
                    onRelance={EMAILJS_FACTURE_CONFIGURE && notif.type === 'retard_facture' && notif.clientId ? handleRelance : null}
                    relancingId={relancingId}
                    relanceStatut={relanceStatut[notif.id]}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse-badge { 0%,100% { transform: scale(1); } 50% { transform: scale(1.2); } }
      `}</style>
    </>
  )
}

function NotifItem({ notif, onClick, onDelete, onRelance, relancingId, relanceStatut }) {
  const cfg = TYPE_CFG[notif.type] || DEFAULT_CFG
  const { Icon } = cfg
  const isRelancing = relancingId === notif.id

  return (
    <div
      style={{ display: 'flex', gap: 12, padding: '10px 18px', cursor: 'pointer', background: notif.lue ? 'transparent' : '#f7f8ff', borderLeft: notif.lue ? '3px solid transparent' : '3px solid #0d3580', transition: 'background 0.12s' }}
      onClick={() => onClick(notif)}
    >
      <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon style={{ fontSize: 18, color: cfg.color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: '600', color: '#111111', margin: '0 0 2px', lineHeight: 1.3 }}>{notif.titre}</p>
        <p style={{ fontSize: 11, color: '#6b7280', margin: 0, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notif.message}</p>
        <p style={{ fontSize: 10, color: '#9ca3af', margin: '3px 0 0' }}>{tempsRelatif(notif._ts)}</p>

        {/* Bouton Relancer — factures en retard uniquement */}
        {onRelance && (
          <div style={{ marginTop: 6 }} onClick={e => e.stopPropagation()}>
            {relanceStatut === 'ok' ? (
              <span style={{ fontSize: 10, fontWeight: '600', color: '#16a34a' }}>✓ Email envoyé</span>
            ) : relanceStatut === 'err' ? (
              <span style={{ fontSize: 10, fontWeight: '600', color: '#dc2626' }}>✗ Échec — vérifier l'email client</span>
            ) : (
              <button
                onClick={() => onRelance(notif)}
                disabled={!!relancingId}
                style={{
                  background: isRelancing ? '#e2e4ea' : '#fee2e2',
                  color:      isRelancing ? '#9ca3af' : '#dc2626',
                  border: 'none', borderRadius: 6,
                  padding: '4px 10px', fontSize: 10, fontWeight: '700',
                  cursor: relancingId ? 'not-allowed' : 'pointer',
                }}
              >
                {isRelancing ? '⏳ Envoi…' : '📧 Relancer'}
              </button>
            )}
          </div>
        )}
      </div>
      <button onClick={e => { e.stopPropagation(); onDelete(notif.id) }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: '2px 0', display: 'flex', alignSelf: 'flex-start', flexShrink: 0 }}
        title="Supprimer">
        <CloseIcon style={{ fontSize: 14 }} />
      </button>
    </div>
  )
}
