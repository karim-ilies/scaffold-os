export default function Skeleton({ width = '100%', height = '16px', borderRadius = '6px', style = {} }) {
  return (
    <div style={{
      width, height, borderRadius,
      background: 'linear-gradient(90deg, #f0f2f7 25%, #e2e4ea 50%, #f0f2f7 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      ...style,
    }} />
  )
}

export function SkeletonCard({ height = 80 }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '16px 18px',
      boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)',
    }}>
      <Skeleton width="40%" height="10px" style={{ marginBottom: 10 }} />
      <Skeleton width="60%" height="22px" style={{ marginBottom: 8 }} />
      <Skeleton width="30%" height="10px" />
    </div>
  )
}
