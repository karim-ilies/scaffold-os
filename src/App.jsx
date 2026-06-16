import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import AuthGuard        from './components/AuthGuard'
import Layout           from './components/Layout'

import LoginPage          from './pages/Auth/LoginPage'
import Page403            from './pages/Auth/Page403'
import RejoindreToken     from './pages/Auth/RejoindreToken'
import PermissionGPS      from './pages/Auth/PermissionGPS'
import DashboardPage      from './pages/Dashboard/DashboardPage'
import ChantiersPage      from './pages/Chantiers/ChantiersPage'
import ChantierDetail     from './pages/Chantiers/ChantierDetail'
import FacturesPage       from './pages/Factures/FacturesPage'
import FactureDetail      from './pages/Factures/FactureDetail'
import DevisPage          from './pages/Devis/DevisPage'
import DevisDetail        from './pages/Devis/DevisDetail'
import PersonnelPage      from './pages/Personnel/PersonnelPage'
import PointagePage       from './pages/Pointage/PointagePage'
import StockPage          from './pages/Stock/StockPage'
import TicketsPage        from './pages/Tickets/TicketsPage'
import ComptabilitePage   from './pages/Comptabilite/ComptabilitePage'
import ParametresPage     from './pages/Parametres/ParametresPage'
import TresoreriePage     from './pages/Tresorerie/TresoreriePage'
import ClientsPage        from './pages/Clients/ClientsPage'
import ClientDetail       from './pages/Clients/ClientDetail'
import PersonnelDetail    from './pages/Personnel/PersonnelDetail'
import InviterPage        from './pages/Personnel/InviterPage'
import FichesMensuelles   from './pages/Personnel/FichesMensuelles'
import PlanningPage       from './pages/Personnel/PlanningPage'
import EquipesPage        from './pages/Personnel/EquipesPage'
import SeedPage           from './pages/Seed/SeedPage'

function PL({ children, allowedRoles = [] }) {
  return (
    <AuthGuard allowedRoles={allowedRoles}>
      <Layout>{children}</Layout>
    </AuthGuard>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login"              element={<LoginPage />} />
          <Route path="/403"                element={<Page403 />} />
          <Route path="/rejoindre/:token"   element={<RejoindreToken />} />
          <Route path="/permission-gps"     element={<PermissionGPS />} />
          <Route path="/"                   element={<Navigate to="/dashboard" replace />} />

          {/* Dashboard — tous */}
          <Route path="/dashboard" element={
            <PL allowedRoles={['patron', 'chef_equipe', 'comptable', 'ouvrier']}>
              <DashboardPage />
            </PL>
          } />

          {/* Clients — patron */}
          <Route path="/clients" element={
            <PL allowedRoles={['patron']}>
              <ClientsPage />
            </PL>
          } />
          <Route path="/clients/:id" element={
            <PL allowedRoles={['patron']}>
              <ClientDetail />
            </PL>
          } />

          {/* Chantiers — tous */}
          <Route path="/chantiers" element={
            <PL allowedRoles={['patron', 'chef_equipe', 'ouvrier', 'comptable']}>
              <ChantiersPage />
            </PL>
          } />
          <Route path="/chantiers/:id" element={
            <PL allowedRoles={['patron', 'chef_equipe', 'ouvrier', 'comptable']}>
              <ChantierDetail />
            </PL>
          } />

          {/* Factures — patron + comptable */}
          <Route path="/factures" element={
            <PL allowedRoles={['patron', 'comptable']}>
              <FacturesPage />
            </PL>
          } />
          <Route path="/factures/:id" element={
            <PL allowedRoles={['patron', 'comptable']}>
              <FactureDetail />
            </PL>
          } />

          {/* Devis — patron */}
          <Route path="/devis" element={
            <PL allowedRoles={['patron']}>
              <DevisPage />
            </PL>
          } />
          <Route path="/devis/:id" element={
            <PL allowedRoles={['patron']}>
              <DevisDetail />
            </PL>
          } />

          {/* Personnel — patron */}
          <Route path="/personnel" element={
            <PL allowedRoles={['patron']}>
              <PersonnelPage />
            </PL>
          } />
          <Route path="/personnel/nouveau" element={
            <PL allowedRoles={['patron']}>
              <InviterPage />
            </PL>
          } />
          <Route path="/personnel/:id" element={
            <PL allowedRoles={['patron']}>
              <PersonnelDetail />
            </PL>
          } />
          <Route path="/personnel/:id/fiches" element={
            <PL allowedRoles={['patron']}>
              <FichesMensuelles />
            </PL>
          } />
          <Route path="/planning" element={
            <PL allowedRoles={['patron', 'chef_equipe']}>
              <PlanningPage />
            </PL>
          } />
          <Route path="/equipes" element={
            <PL allowedRoles={['patron']}>
              <EquipesPage />
            </PL>
          } />

          {/* Pointage — tous sauf comptable */}
          <Route path="/pointage" element={
            <PL allowedRoles={['patron', 'chef_equipe', 'ouvrier']}>
              <PointagePage />
            </PL>
          } />

          {/* Stock — patron + chef_equipe */}
          <Route path="/stock" element={
            <PL allowedRoles={['patron', 'chef_equipe']}>
              <StockPage />
            </PL>
          } />

          {/* Tickets — tous sauf comptable */}
          <Route path="/tickets" element={
            <PL allowedRoles={['patron', 'chef_equipe', 'ouvrier']}>
              <TicketsPage />
            </PL>
          } />

          {/* Trésorerie — patron + comptable */}
          <Route path="/tresorerie" element={
            <PL allowedRoles={['patron', 'comptable']}>
              <TresoreriePage />
            </PL>
          } />

          {/* Comptabilité — patron + comptable */}
          <Route path="/comptabilite" element={
            <PL allowedRoles={['patron', 'comptable']}>
              <ComptabilitePage />
            </PL>
          } />

          {/* Paramètres — patron */}
          <Route path="/parametres" element={
            <PL allowedRoles={['patron']}>
              <ParametresPage />
            </PL>
          } />

          {/* Seed — dev only, non protégé */}
          <Route path="/seed-test" element={<SeedPage />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
