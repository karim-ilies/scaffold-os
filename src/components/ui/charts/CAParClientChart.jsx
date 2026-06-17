import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatEuro } from '../../../utils/formatters'

const COLORS = ['#0d3580', '#1a4ba0', '#2458b8', '#16a34a', '#d97706', '#dc2626']

export function CAParClientChart({ data }) {
  if (!data || data.length === 0) return null

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)' }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 16 }}>CA par client</div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" outerRadius={75} innerRadius={40} dataKey="ca" nameKey="nom" labelLine={false}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={v => formatEuro(v)} contentStyle={{ background: '#1c1c1e', border: 'none', borderRadius: 10, fontSize: 12, color: '#fff' }} />
          <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize: 11, color: '#6b7280' }}>{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
