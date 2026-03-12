import { useState, useEffect } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { sql } from '@codemirror/lang-sql'

const API_URL = import.meta.env.VITE_API_URL || ''

interface Metric {
  id: string
  name: string
  display_name: string
  description: string
  handler_type: 'builtin' | 'custom_sql'
  handler_config: { sql?: string }
  created_at: string
  updated_at: string
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formDisplayName, setFormDisplayName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formSql, setFormSql] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewResult, setPreviewResult] = useState<{ rows: Record<string, unknown>[]; count: number } | null>(null)
  const [previewError, setPreviewError] = useState('')

  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchMetrics()
  }, [])

  async function fetchMetrics() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/metrics`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error || 'Erro ao carregar')
      setMetrics(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar métricas')
    } finally {
      setLoading(false)
    }
  }

  function startEdit(m: Metric) {
    setEditingId(m.id)
    setFormDisplayName(m.display_name)
    setFormDescription(m.description)
    setFormSql(m.handler_config?.sql ?? '')
    setFormError('')
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setFormDisplayName('')
    setFormDescription('')
    setFormSql('')
    setFormError('')
    setPreviewResult(null)
    setPreviewError('')
  }

  async function handlePreviewSql() {
    if (!formSql.trim()) return
    setPreviewLoading(true)
    setPreviewError('')
    setPreviewResult(null)
    try {
      const res = await fetch(`${API_URL}/api/metrics/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: formSql.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao executar')
      setPreviewResult({ rows: data.rows ?? [], count: data.count ?? 0 })
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : 'Erro ao executar preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleSubmitMetric(e: React.FormEvent) {
    e.preventDefault()
    if (!formDisplayName.trim() || !formDescription.trim()) return
    if (editingId && !formSql.trim() && metrics.find(m => m.id === editingId)?.handler_type === 'custom_sql') return
    if (!editingId && !formSql.trim()) return
    setFormSubmitting(true)
    setFormError('')
    try {
      if (editingId) {
        const res = await fetch(`${API_URL}/api/metrics/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            display_name: formDisplayName.trim(),
            description: formDescription.trim(),
            ...(metrics.find(m => m.id === editingId)?.handler_type === 'custom_sql' && { handler_config: { sql: formSql.trim() } }),
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao atualizar')
        cancelForm()
      } else {
        const res = await fetch(`${API_URL}/api/metrics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            display_name: formDisplayName.trim(),
            description: formDescription.trim(),
            handler_type: 'custom_sql',
            handler_config: { sql: formSql.trim() },
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao criar')
        cancelForm()
      }
      fetchMetrics()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erro ao salvar métrica')
    } finally {
      setFormSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta métrica? O agente não poderá mais usá-la.')) return
    setDeletingId(id)
    try {
      const res = await fetch(`${API_URL}/api/metrics/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao excluir')
      }
      fetchMetrics()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao excluir')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Métricas do agente</h2>
        <button
          type="button"
          onClick={() => { setEditingId(null); setFormDisplayName(''); setFormDescription(''); setFormSql(''); setShowForm(true); setFormError('') }}
          style={{
            padding: '8px 16px',
            background: 'var(--color-accent)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          + Nova métrica
        </button>
      </div>

      <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--color-text-secondary)' }}>
        Cada métrica é uma função que o agente pode usar para extrair dados e responder perguntas. As métricas built-in são pré-definidas; novas métricas podem ser criadas com consultas SQL personalizadas.
      </p>

      {showForm && (
        <form
          onSubmit={handleSubmitMetric}
          style={{
            marginBottom: 24,
            padding: 20,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
          }}
        >
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>{editingId ? 'Editar métrica' : 'Nova métrica'}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Nome exibido</label>
              <input
                type="text"
                value={formDisplayName}
                onChange={e => setFormDisplayName(e.target.value)}
                placeholder="Ex: Top clientes por produto"
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  fontSize: 14,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Descrição (para o agente)</label>
              <textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder="Descreva o que retorna e quando usar. Ex: 'Retorna os top 20 clientes por produto no trimestre atual. Use quando o usuário perguntar sobre ranking, melhores clientes ou top vendas por produto.'"
                required
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  fontSize: 14,
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>
            <div style={{ display: editingId && metrics.find(m => m.id === editingId)?.handler_type === 'builtin' ? 'none' : 'block' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Consulta SQL (apenas SELECT, schema galton)</label>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                <CodeMirror
                  value={formSql}
                  onChange={v => { setFormSql(v); setPreviewResult(null); setPreviewError('') }}
                  placeholder="SELECT one_name, brand, SUM(qty_equiv) as total FROM galton.sales WHERE quarter = 'Q4_2024' GROUP BY one_name, brand ORDER BY total DESC LIMIT 20"
                  height="280px"
                  theme="light"
                  extensions={[sql()]}
                  basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
                />
              </div>
              <button
                type="button"
                onClick={handlePreviewSql}
                disabled={!formSql.trim() || previewLoading}
                style={{
                  marginTop: 8,
                  padding: '6px 12px',
                  background: 'var(--color-accent-dim)',
                  color: 'var(--color-accent)',
                  border: '1px solid var(--color-accent-light)',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: previewLoading ? 'wait' : 'pointer',
                }}
              >
                {previewLoading ? 'Executando…' : 'Testar query'}
              </button>
              {previewError && (
                <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--color-danger)' }}>{previewError}</p>
              )}
              {previewResult && (
                <div style={{ marginTop: 12, padding: 12, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'auto', maxHeight: 280 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    {previewResult.count} linhas
                  </p>
                  {previewResult.rows.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>Nenhum resultado.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                          {Object.keys(previewResult.rows[0]!).map(k => (
                            <th key={k} style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewResult.rows.slice(0, 20).map((row, i) => (
                          <tr key={i} style={{ borderBottom: i < Math.min(19, previewResult.rows.length - 1) ? '1px solid var(--color-border)' : 'none' }}>
                            {Object.values(row).map((v, j) => (
                              <td key={j} style={{ padding: '6px 8px', color: 'var(--color-text-primary)' }}>{String(v ?? '—')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {previewResult.rows.length > 20 && (
                    <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
                      Mostrando 20 de {previewResult.count} linhas
                    </p>
                  )}
                </div>
              )}
            </div>
            {formError && <p style={{ margin: 0, fontSize: 13, color: 'var(--color-danger)' }}>{formError}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={formSubmitting} style={{ padding: '8px 16px', background: 'var(--color-accent)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                {formSubmitting ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Criar métrica'}
              </button>
              <button type="button" onClick={cancelForm} style={{ padding: '8px 16px', background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 8, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      {error && <p style={{ margin: '0 0 16px', color: 'var(--color-danger)', fontSize: 14 }}>{error}</p>}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Carregando métricas…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {metrics.map(m => (
            <div
              key={m.id}
              style={{
                padding: '14px 18px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 16,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{m.display_name}</p>
                  {m.handler_type === 'builtin' && (
                    <span style={{ fontSize: 10, letterSpacing: '0.05em', background: 'var(--color-accent-dim)', color: 'var(--color-accent)', padding: '2px 6px', borderRadius: 4 }}>Built-in</span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{m.description}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {!m.id.startsWith('builtin-') && (
                <button
                  type="button"
                  onClick={() => startEdit(m)}
                  style={{
                    padding: '6px 12px',
                    background: 'transparent',
                    color: 'var(--color-accent)',
                    border: '1px solid var(--color-accent)',
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Editar
                </button>
              )}
              {m.handler_type === 'custom_sql' && (
                <button
                  type="button"
                  onClick={() => handleDelete(m.id)}
                  disabled={deletingId === m.id}
                  style={{
                    padding: '6px 12px',
                    background: 'transparent',
                    color: 'var(--color-danger)',
                    border: '1px solid var(--color-danger)',
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {deletingId === m.id ? 'Excluindo…' : 'Excluir'}
                </button>
              )}
              </div>
            </div>
          ))}
          {metrics.length === 0 && !loading && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Nenhuma métrica cadastrada. Execute o schema SQL no Supabase para carregar as métricas built-in.</p>
          )}
        </div>
      )}
    </div>
  )
}
