import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth }       from '../hooks/useAuth'
import { useResponsive } from '../hooks/useResponsive'
import { logout }        from '../firebase/auth'
import GlobalSearch      from './GlobalSearch/GlobalSearch'
import { PageTransition } from './ui/PageTransition'
import { ReadCounter } from './ui/ReadCounter'
import DashboardIcon        from '@mui/icons-material/Dashboard'
import ConstructionIcon     from '@mui/icons-material/Construction'
import DescriptionIcon      from '@mui/icons-material/Description'
import RequestQuoteIcon     from '@mui/icons-material/RequestQuote'
import PeopleIcon           from '@mui/icons-material/People'
import InventoryIcon        from '@mui/icons-material/Inventory'
import AccountBalanceIcon   from '@mui/icons-material/AccountBalance'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import SettingsIcon         from '@mui/icons-material/Settings'
import AccessTimeIcon       from '@mui/icons-material/AccessTime'
import ReceiptIcon          from '@mui/icons-material/Receipt'
import CalendarMonthIcon    from '@mui/icons-material/CalendarMonth'
import GroupsIcon           from '@mui/icons-material/Groups'
import LogoutIcon           from '@mui/icons-material/Logout'
import PersonIcon           from '@mui/icons-material/Person'
import MenuIcon             from '@mui/icons-material/Menu'
import CloseIcon            from '@mui/icons-material/Close'
import NotificationPanel    from './NotificationPanel'
import GetAppIcon           from '@mui/icons-material/GetApp'

const NAV_ITEMS = {
  patron: [
    { to: '/dashboard',    icon: <DashboardIcon />,              label: 'Dashboard' },
    { to: '/bons-commande', icon: <DescriptionIcon />,           label: 'Bons de commande' },
    { to: '/chantiers',    icon: <ConstructionIcon />,           label: 'Chantiers' },
    { to: '/clients',      icon: <PersonIcon />,                 label: 'Clients' },
    { to: '/factures',     icon: <DescriptionIcon />,            label: 'Factures' },
    { to: '/devis',        icon: <RequestQuoteIcon />,           label: 'Devis' },
    { to: '/personnel',    icon: <PeopleIcon />,                 label: 'Personnel' },
    { to: '/planning',     icon: <CalendarMonthIcon />,          label: 'Planning' },
    { to: '/equipes',      icon: <GroupsIcon />,                 label: 'Équipes' },
    { to: '/pointage',     icon: <AccessTimeIcon />,             label: 'Pointage' },
    { to: '/stock',        icon: <InventoryIcon />,              label: 'Stock' },
    { to: '/tickets',      icon: <ReceiptIcon />,                label: 'Tickets' },
    { to: '/tresorerie',   icon: <AccountBalanceWalletIcon />,   label: 'Trésorerie' },
    { to: '/comptabilite', icon: <AccountBalanceIcon />,         label: 'Comptabilité' },
    { to: '/parametres',   icon: <SettingsIcon />,               label: 'Paramètres' },
  ],
  chef_equipe: [
    { to: '/chantiers',    icon: <ConstructionIcon />,  label: 'Chantiers' },
    { to: '/pointage',     icon: <AccessTimeIcon />,    label: 'Pointage' },
    { to: '/planning',     icon: <CalendarMonthIcon />, label: 'Planning' },
    { to: '/stock',        icon: <InventoryIcon />,     label: 'Stock' },
    { to: '/tickets',      icon: <ReceiptIcon />,       label: 'Tickets' },
  ],
  ouvrier: [
    { to: '/pointage',     icon: <AccessTimeIcon />,   label: 'Mon jour' },
    { to: '/chantiers',    icon: <ConstructionIcon />, label: 'Chantiers' },
    { to: '/tickets',      icon: <ReceiptIcon />,      label: 'Tickets' },
  ],
  comptable: [
    { to: '/dashboard',    icon: <DashboardIcon />,              label: 'Dashboard' },
    { to: '/factures',     icon: <DescriptionIcon />,            label: 'Factures' },
    { to: '/tresorerie',   icon: <AccountBalanceWalletIcon />,   label: 'Trésorerie' },
    { to: '/comptabilite', icon: <AccountBalanceIcon />,         label: 'Comptabilité' },
  ],
}

// Bottom nav par rôle (mobile — max 4 items)
const MOBILE_NAV = {
  patron:      ['/factures', '/chantiers', '/pointage', '/tickets'],
  chef_equipe: ['/chantiers', '/pointage', '/tickets', '/planning'],
  ouvrier:     ['/pointage', '/chantiers', '/tickets'],
  comptable:   ['/factures', '/tresorerie', '/comptabilite'],
}

export default function Layout({ children }) {
  const { user, role } = useAuth()
  const { isMobile, isTablet } = useResponsive()
  const navigate = useNavigate()

  const items       = NAV_ITEMS[role] || []
  const mobileKeys  = MOBILE_NAV[role] || []
  const mobileItems = mobileKeys.map(k => items.find(i => i.to === k)).filter(Boolean)

  async function handleLogout() { await logout(); navigate('/login') }

  if (isMobile || isTablet) return <MobileLayout items={mobileItems} allItems={items} onLogout={handleLogout} user={user}>{children}</MobileLayout>
  return <DesktopLayout items={items} onLogout={handleLogout} user={user} role={role}>{children}</DesktopLayout>
}

function DesktopLayout({ children, items, onLogout, user, role }) {
  const linkStyle = ({ isActive }) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 16px', borderRadius: 10, textDecoration: 'none',
    fontSize: 13, fontWeight: isActive ? '600' : '400',
    color:      isActive ? '#ffffff'              : 'rgba(255,255,255,0.6)',
    background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
    transition: 'background 0.15s ease, color 0.15s ease',
  })

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F7F8FA' }}>
      <aside style={{ width: 220, background: '#0d3580', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
        <div style={{ padding: '20px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <p style={{ color: '#fff', fontWeight: '700', fontSize: 17, margin: 0 }}>🏗 Scaffold-OS</p>
            <NotificationPanel placement="sidebar" />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, margin: 0 }}>{user?.prenom} {user?.nom}</p>
          {/* Recherche globale — patron uniquement */}
          {role === 'patron' && (
            <div style={{ marginTop: 12 }}>
              <GlobalSearch />
            </div>
          )}
        </div>

        <nav style={{ flex: 1, padding: '0 8px' }}>
          {items.map(item => (
            <NavLink key={item.to} to={item.to} style={linkStyle}>
              <span style={{ fontSize: 18, display: 'flex' }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: 12 }}>
          <button
            onClick={onLogout}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '10px 12px', color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer' }}
          >
            <LogoutIcon style={{ fontSize: 18 }} />Déconnexion
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, overflowY: 'auto' }}><PageTransition>{children}</PageTransition></main>
      <ReadCounter />
    </div>
  )
}

function MobileLayout({ children, items, allItems, onLogout, user }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F7F8FA' }}>
      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: 72 }}><PageTransition>{children}</PageTransition></main>
      <NotificationPanel placement="mobile" />
      <InstallBanner />

      {/* Barre du bas */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#ffffff', borderTop: '0.5px solid #e2e4ea',
        display: 'flex', alignItems: 'stretch', height: 64,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: 1000,
      }}>
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              textDecoration: 'none', gap: 2, padding: '6px 4px',
              color:      isActive ? '#0d3580' : '#9ca3af',
              background: isActive ? '#e8edf8' : 'transparent',
              borderRadius: 10, margin: '4px 3px',
              fontSize: 10, fontWeight: isActive ? '600' : '400',
            })}
          >
            <span style={{ fontSize: 22, display: 'flex' }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        {/* Bouton Menu */}
        <button
          onClick={() => setMenuOpen(true)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 2, padding: '6px 4px', border: 'none',
            background: menuOpen ? '#e8edf8' : 'transparent',
            cursor: 'pointer',
            color: menuOpen ? '#0d3580' : '#9ca3af',
            fontSize: 10, fontWeight: menuOpen ? '600' : '400',
            borderRadius: 10, margin: '4px 3px',
          }}
        >
          <MenuIcon style={{ fontSize: 22 }} />
          Menu
        </button>
      </nav>

      {/* Overlay menu plein écran */}
      {menuOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: '#F7F8FA', display: 'flex', flexDirection: 'column',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          {/* Header */}
          <div style={{ background: '#0d3580', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <p style={{ color: '#fff', fontWeight: '700', fontSize: 17, margin: 0 }}>🏗 Scaffold-OS</p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, margin: '2px 0 0' }}>{user?.prenom} {user?.nom}</p>
            </div>
            <button onClick={() => setMenuOpen(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '8px', cursor: 'pointer', display: 'flex', color: '#fff' }}>
              <CloseIcon style={{ fontSize: 22 }} />
            </button>
          </div>

          {/* Grille de navigation */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {allItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: isActive ? '#0d3580' : '#ffffff',
                    color:      isActive ? '#ffffff' : '#111111',
                    borderRadius: 12, padding: '14px 16px',
                    textDecoration: 'none', fontSize: 14, fontWeight: '500',
                    border: `1.5px solid ${isActive ? '#0d3580' : '#e2e4ea'}`,
                  })}
                >
                  <span style={{ fontSize: 22, display: 'flex', opacity: 0.85 }}>{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>

          {/* Déconnexion */}
          <div style={{ padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid #e2e4ea', background: '#ffffff', flexShrink: 0 }}>
            <button
              onClick={() => { setMenuOpen(false); onLogout() }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: '#fee2e2', border: 'none', borderRadius: 10, padding: '13px 16px', color: '#dc2626', fontSize: 14, fontWeight: '600', cursor: 'pointer' }}
            >
              <LogoutIcon style={{ fontSize: 20 }} />Déconnexion
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const LS_PWA_KEY = 'scaffold_pwa_dismissed'

function InstallBanner() {
  const [prompt,    setPrompt]    = useState(null)
  const [visible,   setVisible]   = useState(false)

  useEffect(() => {
    if (localStorage.getItem(LS_PWA_KEY)) return
    const handler = e => {
      e.preventDefault()
      setPrompt(e)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setVisible(false)
    setPrompt(null)
  }

  function handleDismiss() {
    setVisible(false)
    localStorage.setItem(LS_PWA_KEY, '1')
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 72,   /* au-dessus de la nav bar */
      left: 12, right: 12,
      background: '#0d3580',
      borderRadius: 12,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      zIndex: 1100,
      boxShadow: '0 4px 20px rgba(13,53,128,0.35)',
    }}>
      <GetAppIcon style={{ color: '#fff', fontSize: 22, flexShrink: 0 }} />
      <p style={{ flex: 1, fontSize: 13, color: '#fff', margin: 0, lineHeight: 1.4 }}>
        📲 Installer <strong>Scaffold-OS</strong> sur votre téléphone
      </p>
      <button
        onClick={handleInstall}
        style={{ background: '#fff', color: '#0d3580', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: '700', cursor: 'pointer', flexShrink: 0 }}
      >
        Installer
      </button>
      <button
        onClick={handleDismiss}
        style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 18, lineHeight: 1, cursor: 'pointer', flexShrink: 0 }}
        title="Fermer"
      >
        ×
      </button>
    </div>
  )
}
