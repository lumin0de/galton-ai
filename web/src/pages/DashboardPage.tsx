import React, { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { getApiBaseUrl } from '@/lib/apiBaseUrl'

const API_URL = getApiBaseUrl()

interface Dropout {
  one_name: string
  brand: string
  prev_qty: number
  curr_qty: number
  meta: number
  segmentacao: string | null
}

interface CrossSell {
  one_name: string
  has: string
  missing: string
  segmentacao: string | null
}

interface PlannedNotPurchased {
  one_name: string
  segmentacao: string | null
  last_product: string | null
  last_purchase_date: string | null
}

interface AlertsData {
  currentQuarter: string
  previousQuarter: string
  dropouts: Dropout[]
  crossSell: CrossSell[]
  plannedNotPurchased: PlannedNotPurchased[]
}

interface HighlightedClient {
  name: string
  brand: string
  type: 'dropout' | 'near_active'
  snippet?: string
}

interface SummaryData {
  briefing: string
  highlightedClients: HighlightedClient[]
  meta: {
    currentQuarter: string
    previousQuarter: string
    dropoutsTotal: number
    plannedNotPurchasedTotal: number
    nearActiveTotal: number
  }
}

const SEG_COLORS: Record<string, { bg: string; color: string }> = {
  A: { bg: '#DBEAFE', color: 'var(--color-seg-a)' },
  B: { bg: '#DBEAFE', color: '#2563EB' },
  C: { bg: '#FEF3C7', color: '#D97706' },
  D: { bg: '#F3F4F6', color: 'var(--color-seg-d)' },
  E: { bg: '#F9FAFB', color: 'var(--color-text-muted)' },
}

function SegBadge({ seg }: { seg: string | null }) {
  if (!seg) return (
    <span
      title="Sem segmentação"
      aria-label="Sem segmentação"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 20, height: 20, borderRadius: 5,
        background: '#EEF1F8', color: 'var(--color-text-muted)',
        fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
      }}
    >—</span>
  )
  const c = SEG_COLORS[seg] ?? { bg: '#F3F4F6', color: 'var(--color-text-muted)' }
  return (
    <span
      title={`Segmentação ${seg}`}
      aria-label={`Segmentação ${seg}`}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 20, height: 20, borderRadius: 5,
        background: c.bg, color: c.color,
        fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
        flexShrink: 0,
      }}
    >{seg}</span>
  )
}

function KpiCard({ value, label, color, index }: { value: number | string; label: string; color: string; index: number }) {
  return (
    <div
      role="status"
      aria-label={`${label}: ${value}`}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: '18px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        display: 'flex', alignItems: 'center', gap: 16, flex: 1,
        position: 'relative', overflow: 'hidden',
        animation: 'fadeUp 0.35s ease both',
        animationDelay: `${index * 70}ms`,
      }}
    >
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 3, background: color, borderRadius: '12px 0 0 12px',
      }} aria-hidden="true" />
      <div style={{ marginLeft: 4 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 28, color: 'var(--color-text-primary)', lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 5 }}>
          {label}
        </div>
      </div>
    </div>
  )
}

function ListCard({
  title, accentColor, count, loading, children, index,
  tooltipLabel, tooltipVisible, onTooltipClose,
}: {
  title: string; accentColor: string; count: number; loading: boolean; children: React.ReactNode; index: number
  tooltipLabel?: string; tooltipVisible?: boolean; onTooltipClose?: () => void
}) {
  return (
    <section
      aria-label={title}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        animation: 'fadeUp 0.35s ease both',
        animationDelay: `${180 + index * 70}ms`,
        position: 'relative',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <h2 style={{
          margin: 0,
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--font-body)', fontWeight: 600,
          fontSize: 13, color: 'var(--color-text-primary)',
        }}>
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor, display: 'inline-block', flexShrink: 0 }} />
          {title}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {tooltipVisible && tooltipLabel && onTooltipClose && (
            <div
              role="status"
              aria-label={tooltipLabel}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'rgba(29,78,53,0.12)',
                border: '1px solid rgba(29,78,53,0.25)',
                borderRadius: 8,
                padding: '4px 8px',
                fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 500,
                color: 'var(--color-success)',
              }}
            >
              <span>{tooltipLabel}</span>
              <button
                type="button"
                onClick={onTooltipClose}
                aria-label="Fechar"
                style={{
                  width: 18, height: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent', border: 'none', borderRadius: 4,
                  cursor: 'pointer', color: 'inherit', fontSize: 14, lineHeight: 1,
                  transition: 'background 120ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(29,78,53,0.2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                ×
              </button>
            </div>
          )}
          <span
            aria-label={`${count} itens`}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
              background: accentColor, color: 'white',
              padding: '2px 8px', borderRadius: 20,
            }}
          >{count}</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <div
              role="status"
              aria-label="Carregando..."
              style={{
                width: 18, height: 18,
                border: '2px solid var(--color-border)',
                borderTopColor: 'var(--color-accent)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          </div>
        ) : children}
      </div>
    </section>
  )
}

function norm(s: string) {
  return (s || '').trim().toLowerCase()
}

function ListItem({
  children,
  isHighlighted,
  tooltipText,
}: {
  children: React.ReactNode
  isHighlighted?: boolean
  tooltipText?: string
}) {
  const [hover, setHover] = useState(false)
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)

  const bg = hover
    ? (isHighlighted ? 'rgba(29,78,53,0.1)' : 'var(--color-bg)')
    : (isHighlighted ? 'rgba(29,78,53,0.06)' : 'transparent')

  const showTooltip = isHighlighted && hover
  const content = (tooltipText && tooltipText.trim()) || 'Destacado no briefing.'

  const handleMouseEnter = () => {
    setHover(true)
    if (rowRef.current) {
      setTooltipRect(rowRef.current.getBoundingClientRect())
    }
  }

  const handleMouseLeave = () => {
    setHover(false)
    setTooltipRect(null)
  }

  const tooltipEl = showTooltip && tooltipRect && typeof document !== 'undefined' && (
    createPortal(
      <div
        role="tooltip"
        aria-live="polite"
        style={{
          position: 'fixed',
          left: tooltipRect.left + tooltipRect.width / 2,
          top: tooltipRect.top,
          transform: 'translate(-50%, -100%)',
          marginTop: -10,
          zIndex: 99999,
          maxWidth: 300,
          padding: '12px 14px',
          background: '#1D4E35',
          color: 'white',
          fontSize: 13,
          fontFamily: 'var(--font-body)',
          lineHeight: 1.5,
          borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: -8,
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid #1D4E35',
          }}
          aria-hidden="true"
        />
        {content}
      </div>,
      document.body
    )
  )

  return (
    <div
      ref={rowRef}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '10px 18px',
        borderBottom: '1px solid var(--color-border)',
        background: bg,
        borderLeft: isHighlighted ? '3px solid var(--color-success)' : undefined,
        transition: 'background 120ms ease',
        cursor: 'default',
        position: 'relative',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {tooltipEl}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: '24px 18px', fontSize: 13, color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
      {message}
    </div>
  )
}

// ─── Briefing Panel ────────────────────────────────────────────────────────────

function BriefingPanel({ briefing, loading }: { briefing: string | null; loading: boolean }) {
  return (
    <div
      role="region"
      aria-label="Briefing do dia"
      aria-busy={loading}
      style={{
        background: '#F0F7F3',
        border: '1px solid #C6DDD3',
        borderLeft: '3px solid #1D4E35',
        borderRadius: '0 10px 10px 0',
        padding: '14px 18px',
        marginBottom: 20,
        display: 'flex', gap: 14, alignItems: 'flex-start',
        animation: 'fadeUp 0.35s ease',
      }}
    >
      <div aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D4E35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: '0 0 6px',
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
          letterSpacing: '0.08em', textTransform: 'uppercase', color: '#1D4E35',
        }}>
          Briefing do dia
        </p>

        {loading ? (
          <div aria-label="Carregando briefing..." style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[92, 75].map((w, i) => (
              <div key={i} style={{
                height: 14, borderRadius: 4,
                background: 'linear-gradient(90deg, #C6DDD3 25%, #E0EDE8 50%, #C6DDD3 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.4s infinite',
                animationDelay: `${i * 200}ms`,
                width: `${w}%`,
              }} />
            ))}
          </div>
        ) : (
          <div className="prose prose-sm max-w-none" style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, color: '#1A1A1A', lineHeight: 1.6 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{briefing ?? ''}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

interface DashboardPageProps {
  repName?: string
}

export default function DashboardPage({ repName }: DashboardPageProps) {
  const [data, setData] = useState<AlertsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [briefing, setBriefing] = useState<string | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(true)
  const [highlightedClients, setHighlightedClients] = useState<HighlightedClient[]>([])
  const [tooltipDismissed, setTooltipDismissed] = useState(false)

  const repParam = repName ? `?rep=${encodeURIComponent(repName)}` : ''

  useEffect(() => {
    axios
      .get<AlertsData>(`${API_URL}/api/alerts${repParam}`)
      .then(r => setData(r.data))
      .catch(() => setError('Erro ao carregar alertas. Verifique se a API está rodando.'))
      .finally(() => setLoading(false))

    axios
      .get<SummaryData>(`${API_URL}/api/dashboard-summary${repParam}`)
      .then(r => {
        setBriefing(r.data.briefing)
        setHighlightedClients(r.data.highlightedClients ?? [])
      })
      .catch(err => console.error('[dashboard-summary] falhou:', err))
      .finally(() => setBriefingLoading(false))
  }, [repName])

  if (error) {
    return (
      <div role="alert" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: 'var(--color-danger)', borderRadius: 8, padding: '12px 16px', fontSize: 13, fontFamily: 'var(--font-body)' }}>
        {error}
      </div>
    )
  }

  const currentQ = data?.currentQuarter ?? '...'
  const previousQ = data?.previousQuarter ?? '...'

  const highlightedDropoutsMap = new Map<string, string>()
  const highlightedDropoutsList: { name: string; brand: string; snippet: string }[] = []
  for (const c of highlightedClients.filter(x => x.type === 'dropout')) {
    const key = `${norm(c.name)}|${norm(c.brand)}`
    const snippet = c.snippet || 'Destacado no briefing.'
    highlightedDropoutsMap.set(key, snippet)
    highlightedDropoutsList.push({ name: norm(c.name), brand: norm(c.brand), snippet })
  }
  const hasHighlightedDropouts = highlightedDropoutsList.length > 0

  function getDropoutSnippet(d: Dropout, index: number): string | undefined {
    const key = `${norm(d.one_name)}|${norm(d.brand)}`
    let s = highlightedDropoutsMap.get(key)
    if (s) return s
    const dn = norm(d.one_name)
    const db = norm(d.brand)
    for (const h of highlightedDropoutsList) {
      if (h.brand !== db) continue
      if (dn === h.name || dn.includes(h.name) || h.name.includes(dn)) return h.snippet
    }
    if (index < highlightedDropoutsList.length) {
      return highlightedDropoutsList[index].snippet
    }
    return briefing ? briefing.slice(0, 150) + '…' : 'Destacado no briefing.'
  }

  function isDropoutHighlighted(d: Dropout, index: number): boolean {
    const key = `${norm(d.one_name)}|${norm(d.brand)}`
    if (highlightedDropoutsMap.has(key)) return true
    const dn = norm(d.one_name)
    const db = norm(d.brand)
    for (const h of highlightedDropoutsList) {
      if (h.brand !== db) continue
      if (dn === h.name || dn.includes(h.name) || h.name.includes(dn)) return true
    }
    if (hasHighlightedDropouts && index < 3) return true
    return false
  }

  return (
    <div>
      {/* Subtitle */}
      <p style={{ margin: '0 0 16px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-secondary)' }}>
        Comparativo{' '}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{previousQ}</span>
        {' → '}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{currentQ}</span>
      </p>

      {(briefingLoading || briefing) && (
        <BriefingPanel briefing={briefing} loading={briefingLoading} />
      )}

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20 }} role="group" aria-label="Indicadores">
        <KpiCard value={loading ? '—' : (data?.dropouts.length ?? 0)} label="Dropouts este trimestre" color="#DC2626" index={0} />
        <KpiCard value={loading ? '—' : (data?.crossSell.length ?? 0)} label="Oportunidades cross-sell" color="#D97706" index={1} />
        <KpiCard value={loading ? '—' : (data?.plannedNotPurchased.length ?? 0)} label="Planejados sem compra" color="#2563EB" index={2} />
      </div>

      {/* Colunas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <ListCard
          title="Dropouts"
          accentColor="#DC2626"
          count={data?.dropouts.length ?? 0}
          loading={loading}
          index={0}
          tooltipLabel="Destaques do briefing"
          tooltipVisible={!tooltipDismissed && hasHighlightedDropouts}
          onTooltipClose={() => setTooltipDismissed(true)}
        >
          {data?.dropouts.length === 0 ? (
            <EmptyState message="Nenhum dropout encontrado." />
          ) : (
            data?.dropouts.slice(0, 10).map((d, i) => (
              <ListItem
                key={i}
                isHighlighted={isDropoutHighlighted(d, i)}
                tooltipText={getDropoutSnippet(d, i)}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {d.one_name}
                  </p>
                  <p style={{ margin: '2px 0 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {d.brand} · {previousQ}: {d.prev_qty} → {currentQ}: {d.curr_qty}
                  </p>
                </div>
                <SegBadge seg={d.segmentacao} />
              </ListItem>
            ))
          )}
        </ListCard>

        <ListCard title="Cross-sell" accentColor="#D97706" count={data?.crossSell.length ?? 0} loading={loading} index={1}>
          {data?.crossSell.length === 0 ? (
            <EmptyState message="Nenhuma oportunidade encontrada." />
          ) : (
            data?.crossSell.slice(0, 10).map((c, i) => (
              <ListItem key={i}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.one_name}
                  </p>
                  <p style={{ margin: '2px 0 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-muted)' }}>
                    Tem: {c.has} · Falta: {c.missing}
                  </p>
                </div>
                <SegBadge seg={c.segmentacao} />
              </ListItem>
            ))
          )}
        </ListCard>

        <ListCard title="Planejados sem compra" accentColor="#2563EB" count={data?.plannedNotPurchased.length ?? 0} loading={loading} index={2}>
          {data?.plannedNotPurchased.length === 0 ? (
            <EmptyState message="Todos já compraram este período." />
          ) : (
            data?.plannedNotPurchased.slice(0, 10).map((p, i) => (
              <ListItem key={i}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.one_name}
                  </p>
                  <p style={{ margin: '2px 0 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {p.last_product ?? '—'} · {p.last_purchase_date ?? '—'}
                  </p>
                </div>
                <SegBadge seg={p.segmentacao} />
              </ListItem>
            ))
          )}
        </ListCard>
      </div>
    </div>
  )
}
