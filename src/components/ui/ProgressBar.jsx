import { useState, useEffect } from 'react'

export function ProgressBar({ value = 0, color, height = 6, showLabel = false }) {
  const [displayed, setDisplayed] = useState(0)

  useEffect(() => {
    let current = 0
    const target = Math.min(100, Math.max(0, value))
    const steps = 30
    const increment = target / steps
    const timer = setInterval(() => {
      current += increment
      if (current >= target) { setDisplayed(target); clearInterval(timer) }
      else setDisplayed(Math.round(current))
    }, 16)
    return () => clearInterval(timer)
  }, [value])

  const autoColor = value < 30 ? '#0d3580' : value < 70 ? '#d97706' : '#16a34a'
  const barColor = color || autoColor

  return (
    <div>
      {showLabel && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>
          <span>Avancement</span>
          <span style={{ color: barColor, fontWeight: 600 }}>{Math.round(displayed)} %</span>
        </div>
      )}
      <div style={{ background: '#f0f2f7', borderRadius: height, height, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${displayed}%`, background: barColor,
          borderRadius: height, transition: 'width 0.03s linear',
        }} />
      </div>
    </div>
  )
}
