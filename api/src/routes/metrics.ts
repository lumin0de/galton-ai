import { Router, Request, Response } from 'express'
import { db as supabase } from '../db/supabase'

const router = Router()

// Métricas built-in (fallback quando a tabela não existe)
const DEFAULT_METRICS = [
  { id: 'builtin-1', name: 'getNearActiveAccounts', display_name: 'Próximos de conta ativa', description: 'Retorna médicos próximos de virar conta ativa, agrupados por segmentação (A→B→C→D→E→N/D). Cada grupo traz até 5 contas ordenadas por % atingido decrescente.', handler_type: 'builtin' as const, handler_config: {}, created_at: '', updated_at: '' },
  { id: 'builtin-2', name: 'getPlannedNotPurchased', display_name: 'Planejados sem compra', description: 'Retorna médicos da carteira que compraram no trimestre anterior mas não realizaram nenhuma compra no trimestre atual. Ordenados por segmentação A→E.', handler_type: 'builtin' as const, handler_config: {}, created_at: '', updated_at: '' },
  { id: 'builtin-3', name: 'getDropouts', display_name: 'Dropouts', description: 'Retorna contas que eram ativas no trimestre anterior mas não atingiram a meta no trimestre atual (dropouts do trimestre). Ordenados por segmentação.', handler_type: 'builtin' as const, handler_config: {}, created_at: '', updated_at: '' },
]

// ─── GET /api/metrics ───────────────────────────────────────────────────────

router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('metrics')
      .select('id, name, display_name, description, handler_type, handler_config, created_at, updated_at')
      .order('created_at', { ascending: true })

    if (error) {
      const msg = String((error as { message?: string }).message || error)
      const tableMissing = /does not exist|relation.*not found|table.*not found/i.test(msg)
      if (tableMissing) {
        console.warn('[metrics] Tabela galton.metrics não existe. Execute supabase/schema.sql no Supabase. Retornando métricas padrão.')
        return res.json(DEFAULT_METRICS)
      }
      throw error
    }
    res.json(data?.length ? data : DEFAULT_METRICS)
  } catch (err) {
    console.error('Metrics list error:', err)
    res.status(500).json({ error: 'Erro ao listar métricas', detail: err instanceof Error ? err.message : String(err) })
  }
})

// ─── POST /api/metrics/preview ───────────────────────────────────────────────

router.post('/metrics/preview', async (req: Request, res: Response) => {
  try {
    const { sql } = req.body as { sql?: string }
    const trimmed = sql?.trim()
    if (!trimmed) {
      return res.status(400).json({ error: 'Campo sql é obrigatório' })
    }
    if (!validateCustomSql(trimmed)) {
      return res.status(400).json({
        error: 'SQL inválido. Use apenas SELECT, referencie tabelas do schema galton (galton.tabela), sem comandos de alteração.',
      })
    }
    const { data, error } = await supabase.rpc('exec_select_sql', { query_text: trimmed })
    if (error) {
      return res.status(400).json({ error: error.message })
    }
    const rows = Array.isArray(data) ? data : (data ? [data] : [])
    res.json({ rows, count: rows.length })
  } catch (err) {
    console.error('Metrics preview error:', err)
    res.status(500).json({ error: 'Erro ao executar preview', detail: err instanceof Error ? err.message : String(err) })
  }
})

// ─── POST /api/metrics ───────────────────────────────────────────────────────

function toToolName(displayName: string): string {
  const words = displayName
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return 'getCustom'
  const camel = words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join('')
  return 'get' + camel
}

function validateCustomSql(sql: string): boolean {
  const trimmed = sql.trim()
  if (!trimmed.toUpperCase().startsWith('SELECT')) return false
  if (/;\s*$/.test(trimmed)) return false
  if (/\b(DROP|DELETE|UPDATE|INSERT|TRUNCATE|ALTER|CREATE)\b/i.test(trimmed)) return false
  if (!/\bFROM\s+galton\./i.test(trimmed)) return false
  return true
}

router.post('/metrics', async (req: Request, res: Response) => {
  try {
    const { display_name, description, handler_type, handler_config } = req.body as {
      display_name?: string
      description?: string
      handler_type?: 'builtin' | 'custom_sql'
      handler_config?: { sql?: string }
    }

    if (!display_name?.trim() || !description?.trim()) {
      return res.status(400).json({ error: 'display_name e description são obrigatórios' })
    }

    const handler = handler_type || 'custom_sql'
    if (handler !== 'builtin' && handler !== 'custom_sql') {
      return res.status(400).json({ error: 'handler_type deve ser builtin ou custom_sql' })
    }

    let name = toToolName(display_name)
    if (handler === 'custom_sql') {
      const sql = handler_config?.sql?.trim()
      if (!sql) return res.status(400).json({ error: 'Para métricas custom_sql, handler_config.sql é obrigatório' })
      if (!validateCustomSql(sql)) {
        return res.status(400).json({
          error: 'SQL inválido. Use apenas SELECT, referencie tabelas do schema galton (galton.tabela), sem comandos de alteração.',
        })
      }
      const baseName = name
      let suffix = 0
      while (true) {
        const candidate = suffix === 0 ? baseName : `${baseName}_${suffix}`
        const { data: existing } = await supabase.from('metrics').select('id').eq('name', candidate).maybeSingle()
        if (!existing) {
          name = candidate
          break
        }
        suffix++
      }
    }

    const { data, error } = await supabase
      .from('metrics')
      .insert({
        name,
        display_name: display_name.trim(),
        description: description.trim(),
        handler_type: handler,
        handler_config: handler_config ?? {},
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    console.error('Metrics create error:', err)
    res.status(500).json({ error: 'Erro ao criar métrica' })
  }
})

// ─── PATCH /api/metrics/:id ─────────────────────────────────────────────────

router.patch('/metrics/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { display_name, description, handler_config } = req.body as {
      display_name?: string
      description?: string
      handler_config?: { sql?: string }
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (display_name != null) updates.display_name = display_name.trim()
    if (description != null) updates.description = description.trim()
    if (handler_config != null) {
      const sql = handler_config?.sql?.trim()
      if (sql && !validateCustomSql(sql)) {
        return res.status(400).json({
          error: 'SQL inválido. Use apenas SELECT, referencie tabelas do schema galton (galton.tabela).',
        })
      }
      updates.handler_config = handler_config
    }

    const { data, error } = await supabase
      .from('metrics')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Métrica não encontrada' })
    res.json(data)
  } catch (err) {
    console.error('Metrics update error:', err)
    res.status(500).json({ error: 'Erro ao atualizar métrica' })
  }
})

// ─── DELETE /api/metrics/:id ─────────────────────────────────────────────────

router.delete('/metrics/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { error } = await supabase.from('metrics').delete().eq('id', id)
    if (error) throw error
    res.status(204).send()
  } catch (err) {
    console.error('Metrics delete error:', err)
    res.status(500).json({ error: 'Erro ao excluir métrica' })
  }
})

export default router
