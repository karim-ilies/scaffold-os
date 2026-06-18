export function LoadMoreButton({ hasMore, loading, onLoadMore, totalLoaded }) {
  if (!hasMore) return (
    <div style={{ textAlign: 'center', padding: 16, fontSize: 12, color: '#9ca3af' }}>
      {totalLoaded} élément(s) — tout est chargé
    </div>
  )

  return (
    <div style={{ textAlign: 'center', padding: 16 }}>
      <button
        onClick={onLoadMore}
        disabled={loading}
        style={{
          background: loading ? '#f0f2f7' : 'transparent',
          color: '#0d3580', border: '1.5px solid #0d3580',
          borderRadius: 10, padding: '10px 28px',
          fontSize: 13, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        {loading ? 'Chargement…' : 'Charger plus ↓'}
      </button>
    </div>
  )
}
