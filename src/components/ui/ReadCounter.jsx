import { useState, useEffect } from 'react'

let readCount = 0
let sessionStart = Date.now()

export function trackRead(count = 1) {
  readCount += count
}

export function getReadStats() {
  const duration = Math.round((Date.now() - sessionStart) / 1000)
  return {
    total: readCount,
    duration,
    perMinute: duration > 0 ? Math.round(readCount / (duration / 60)) : 0,
  }
}

export function ReadCounter() {
  const [stats, setStats] = useState(getReadStats())

  useEffect(() => {
    const timer = setInterval(() => setStats(getReadStats()), 3000)
    return () => clearInterval(timer)
  }, [])

  if (import.meta.env.PROD) return null

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: 8,
      background: 'rgba(0,0,0,0.8)', color: '#fff',
      borderRadius: 8, padding: '6px 10px',
      fontSize: 10, fontFamily: 'monospace',
      zIndex: 9999, lineHeight: 1.6,
      pointerEvents: 'none',
    }}>
      📊 {stats.total} reads | ⏱ {stats.duration}s | 📈 {stats.perMinute}/min
    </div>
  )
}
