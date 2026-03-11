import { useState, useEffect } from 'react'

export interface NearActiveItem {
  name: string
  brand: string
  qty_atual: number
  meta: number
  pct_atingido: number
  segmentacao: string | null
}

function getBarColor(pct: number): string {
  if (pct >= 90) return '#16A34A'
  if (pct >= 70) return '#D97706'
  return '#6B7280'
}

const SEG_COLORS: Record<string, { bg: string; color: string }> = {
  A: { bg: '#DBEAFE', color: '#2563EB' },
  B: { bg: '#DBEAFE', color: '#2563EB' },
  C: { bg: '#FEF3C7', color: '#D97706' },
  D: { bg: '#F3F4F6', color: '#6B7280' },
  E: { bg: '#F9FAFB', color: '#9CA3AF' },
}

function SegBadge({ seg }: { seg: string | null }) {
  const c = seg ? (SEG_COLORS[seg] ?? { bg: '#F3F4F6', color: '#6B7280' }) : { bg: '#EEF1F8', color: '#9CA3AF' }
  return (
    <span
      title={seg ? `Segmentação ${seg}` : 'Sem segmentação'}
      aria-label={seg ? `Segmentação ${seg}` : 'Sem segmentação'}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 18, height: 18, borderRadius: 4,
        background: c.bg, color: c.color,
        fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, flexShrink: 0,
      }}
    >
      {seg ?? '—'}
    </span>
  )
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 50)
    return () => clearTimeout(t)
  }, [pct])

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${pct}% atingido`}
      style={{ background: '#E5E7EB', borderRadius: 3, height: 6, overflow: 'hidden', flex: 1 }}
    >
      <div style={{
        width: `${width}%`, height: '100%',
        background: color, borderRadius: 3,
        transition: 'width 600ms ease-out',
      }} />
    </div>
  )
}

function AccountCard({ item }: { item: NearActiveItem }) {
  const [hover, setHover] = useState(false)
  const color = getBarColor(item.pct_atingido)
  const faltam = Math.round((item.meta - item.qty_atual) * 10) / 10

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderLeft: `3px solid ${color}`,
        borderRadius: '0 8px 8px 0',
        padding: '10px 14px',
        background: hover ? '#F5F5F5' : 'white',
        border: `1px solid #E5E7EB`,
        borderLeftColor: color,
        borderLeftWidth: 3,
        transition: 'background 150ms ease',
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.name}
          </span>
          <SegBadge seg={item.segmentacao} />
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: '#6B7280', background: '#F3F4F6', padding: '2px 6px', borderRadius: 4, flexShrink: 0, marginLeft: 8 }}>
          {item.brand}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <ProgressBar pct={item.pct_atingido} color={color} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>
          {item.pct_atingido}%
        </span>
      </div>

      <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-muted)' }}>
        {item.qty_atual.toLocaleString('pt-BR')} de {item.meta} unidades · Faltam {faltam.toLocaleString('pt-BR')} un.
      </p>
    </div>
  )
}

export default function ProgressMessage({ items }: { items: NearActiveItem[] }) {
  if (!items.length) return null
  return (
    <div style={{ marginTop: 12 }} role="list" aria-label="Contas próximas de meta">
      {items.map((item, i) => (
        <div key={i} role="listitem">
          <AccountCard item={item} />
        </div>
      ))}
    </div>
  )
}
