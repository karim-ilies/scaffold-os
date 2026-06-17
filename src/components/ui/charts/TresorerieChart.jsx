import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatEuro } from '../../../utils/formatters'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1c1c1e', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
      <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 6, fontWeight: 500 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600, marginBottom: 2 }}>{p.name} : {formatEuro(p.value)}</div>
      ))}
    </div>
  )
}

export function TresorerieChart({ data }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)' }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 16 }}>Trésorerie — 6 derniers mois</div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradEnc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradDec" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#dc2626" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f7" vertical={false} />
          <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="encaisse" name="Encaissé" stroke="#16a34a" strokeWidth={2} fill="url(#gradEnc)" />
          <Area type="monotone" dataKey="decaisse" name="Décaissé" stroke="#dc2626" strokeWidth={2} fill="url(#gradDec)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
