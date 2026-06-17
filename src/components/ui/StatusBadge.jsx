const CONFIG = {
  en_cours:       { bg: '#dcfce7', color: '#16a34a', dot: true,  label: 'En cours' },
  termine:        { bg: '#e8edf8', color: '#0d3580', dot: false, label: 'Terminé' },
  en_attente:     { bg: '#fef9c3', color: '#a16207', dot: false, label: 'En attente' },
  envoyee:        { bg: '#dbeafe', color: '#1d4ed8', dot: false, label: 'Envoyée' },
  payee:          { bg: '#dcfce7', color: '#16a34a', dot: false, label: 'Payée' },
  paye:           { bg: '#dcfce7', color: '#16a34a', dot: false, label: 'Payée' },
  en_retard:      { bg: '#fee2e2', color: '#dc2626', dot: true,  pulse: true, label: 'En retard' },
  brouillon:      { bg: '#f3f4f6', color: '#6b7280', dot: false, label: 'Brouillon' },
  annulee:        { bg: '#fee2e2', color: '#dc2626', dot: false, label: 'Annulée' },
  valide:         { bg: '#dcfce7', color: '#16a34a', dot: false, label: 'Validé' },
  a_verifier:     { bg: '#fef9c3', color: '#a16207', dot: true,  label: 'À vérifier' },
  rejete:         { bg: '#fee2e2', color: '#dc2626', dot: false, label: 'Rejeté' },
  refuse:         { bg: '#fee2e2', color: '#dc2626', dot: false, label: 'Refusé' },
  accepte:        { bg: '#e8edf8', color: '#0d3580', dot: false, label: 'Accepté' },
  expire:         { bg: '#f3f4f6', color: '#6b7280', dot: false, label: 'Expiré' },
  en_maintenance: { bg: '#fef9c3', color: '#a16207', dot: false, label: 'Maintenance' },
  archivee:       { bg: '#f3f4f6', color: '#6b7280', dot: false, label: 'Archivée' },
  archive:        { bg: '#f3f4f6', color: '#6b7280', dot: false, label: 'Archivée' },
}

export function StatusBadge({ statut, label: customLabel }) {
  const c = CONFIG[statut] || { bg: '#f3f4f6', color: '#374151', dot: false, label: statut || '—' }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: c.bg, color: c.color,
      padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {c.dot && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: c.color, flexShrink: 0,
          animation: c.pulse ? 'pulse-dot 1.5s infinite' : 'none',
        }} />
      )}
      {customLabel || c.label}
    </span>
  )
}
