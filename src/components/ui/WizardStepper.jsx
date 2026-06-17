export function WizardStepper({ steps, currentStep }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '16px 24px',
      background: '#fff',
      borderBottom: '0.5px solid #f0f2f7',
    }}>
      {steps.map((step, index) => {
        const isDone   = index < currentStep
        const isActive = index === currentStep

        return (
          <div key={index} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              fontSize: 12, fontWeight: 600,
              transition: 'all 0.3s ease',
              background: isDone ? '#16a34a' : isActive ? '#0d3580' : '#f0f2f7',
              color: isDone || isActive ? '#fff' : '#9ca3af',
              boxShadow: isActive ? '0 0 0 4px rgba(13,53,128,0.15)' : 'none',
            }}>
              {isDone ? '✓' : index + 1}
            </div>
            <div style={{ marginLeft: 8, marginRight: 8 }}>
              <div style={{
                fontSize: 11, fontWeight: isActive ? 600 : 400,
                color: isActive ? '#0d3580' : isDone ? '#16a34a' : '#9ca3af',
                transition: 'color 0.3s ease', whiteSpace: 'nowrap',
              }}>
                {step.label}
              </div>
              {step.subtitle && (
                <div style={{ fontSize: 9, color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>
                  {step.subtitle}
                </div>
              )}
            </div>
            {index < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, marginRight: 8,
                background: isDone ? '#16a34a' : '#f0f2f7',
                transition: 'background 0.3s ease', borderRadius: 1,
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
