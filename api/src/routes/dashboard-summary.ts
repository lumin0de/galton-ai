import { Router, Request, Response } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { db as supabase } from '../db/supabase'
import { getNearActiveAccounts } from '../tools/getNearActiveAccounts'

const router = Router()

let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

const TARGETS: Record<string, number> = { DYSPORT: 10, RESTYLANE: 10, SCULPTRA: 6 }

async function getLatestQuarter(): Promise<string> {
  const { data } = await supabase
    .from('sales')
    .select('year_ref, month_ref')
    .not('year_ref', 'is', null)
    .not('month_ref', 'is', null)
    .order('year_ref', { ascending: false })
    .order('month_ref', { ascending: false })
    .limit(1)

  const row = (data || [])[0] as { year_ref: number; month_ref: number } | undefined
  if (!row) return 'Q4_2024'
  return `Q${Math.ceil(row.month_ref / 3)}_${row.year_ref}`
}

function prevQuarter(q: string): string {
  const m = q.match(/Q(\d)_(\d{4})/)
  if (!m) return q
  const qn = parseInt(m[1]!), yr = parseInt(m[2]!)
  return qn === 1 ? `Q4_${yr - 1}` : `Q${qn - 1}_${yr}`
}

async function getRepTerritory(repName: string): Promise<string | null> {
  const { data } = await supabase.from('representatives').select('territory_code').eq('name', repName).single()
  return (data as { territory_code: string | null } | null)?.territory_code ?? null
}

function todayDate(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

// ─── GET /api/dashboard-summary ───────────────────────────────────────────────

router.get('/dashboard-summary', async (req: Request, res: Response) => {
  try {
    const rep = (req.query.rep as string)?.trim()
    const repKey = rep || '__global__'
    const today = todayDate()

    // ── 1. Verificar cache do briefing do dia ─────────────────────────────────
    try {
      const { data: cached } = await supabase
        .from('daily_briefings')
        .select('briefing, highlighted_clients, meta')
        .eq('rep_key', repKey)
        .eq('briefing_date', today)
        .maybeSingle()

      if (cached) {
        return res.json({
          briefing: cached.briefing,
          highlightedClients: cached.highlighted_clients ?? [],
          meta: cached.meta ?? {},
        })
      }
    } catch {
      // Tabela pode não existir ainda
    }

    const territoryCode = rep ? await getRepTerritory(rep) : null

    const currentQ = await getLatestQuarter()
    const previousQ = prevQuarter(currentQ)

    let prevQ = supabase.from('sales').select('one_id, one_name, brand, qty_equiv, seg_dysport:doctors(seg_dysport), seg_restylane:doctors(seg_restylane)').eq('quarter', previousQ).in('brand', ['DYSPORT', 'RESTYLANE', 'SCULPTRA'])
    let currQ = supabase.from('sales').select('one_id, brand, qty_equiv').eq('quarter', currentQ).in('brand', ['DYSPORT', 'RESTYLANE', 'SCULPTRA'])
    if (territoryCode) {
      prevQ = prevQ.eq('territory_code', territoryCode)
      currQ = currQ.eq('territory_code', territoryCode)
    }

    const [{ data: prevSales }, { data: currSales }, nearActiveGroups] = await Promise.all([
      prevQ,
      currQ,
      getNearActiveAccounts(territoryCode ?? undefined),
    ])

    // ── 2. Aggregate prev quarter by one_id+brand ─────────────────────────────
    const prevAgg: Record<string, { one_name: string; brand: string; qty: number }> = {}
    for (const row of (prevSales || []) as Array<{ one_id: string; one_name: string; brand: string; qty_equiv: number }>) {
      const key = `${row.one_id}||${row.brand}`
      if (!prevAgg[key]) prevAgg[key] = { one_name: row.one_name, brand: row.brand, qty: 0 }
      prevAgg[key]!.qty += Number(row.qty_equiv)
    }

    // ── 3. Aggregate curr quarter ─────────────────────────────────────────────
    const currAgg: Record<string, number> = {}
    for (const row of (currSales || []) as Array<{ one_id: string; brand: string; qty_equiv: number }>) {
      const key = `${row.one_id}||${row.brand}`
      currAgg[key] = (currAgg[key] || 0) + Number(row.qty_equiv)
    }

    // ── 4. Compute dropouts: were active prev Q, below target this Q ──────────
    const dropouts: Array<{ name: string; brand: string; prevQty: number; currQty: number; meta: number }> = []
    for (const [key, val] of Object.entries(prevAgg)) {
      const meta = TARGETS[val.brand] ?? 10
      if (val.qty < meta) continue                     // wasn't active last quarter
      const curr = currAgg[key] || 0
      if (curr >= meta) continue                        // still active
      dropouts.push({ name: val.one_name, brand: val.brand, prevQty: val.qty, currQty: curr, meta })
    }
    // Sort by biggest fall (prevQty descending) and take top 3
    dropouts.sort((a, b) => b.prevQty - a.prevQty)
    const topDropouts = dropouts.slice(0, 3)

    // ── 5. Planned not purchased: bought prev Q, zero purchases curr Q ────────
    const prevOneIds = new Set(Object.keys(prevAgg).map(k => k.split('||')[0]!))
    const currOneIds = new Set(Object.keys(currAgg).map(k => k.split('||')[0]!))
    const plannedNotPurchasedCount = [...prevOneIds].filter(id => !currOneIds.has(id)).length

    // ── 6. Top near-active accounts ───────────────────────────────────────────
    // Flatten groups and sort by pct_atingido desc, take top 3
    const allNearActive = nearActiveGroups.flatMap(g => g.contas)
    allNearActive.sort((a, b) => b.pct_atingido - a.pct_atingido)
    const topNearActive = allNearActive.slice(0, 3)

    // ── 7. Build context string for Claude ────────────────────────────────────
    const nearActiveLines = topNearActive.length
      ? topNearActive.map(a =>
          `  • ${a.one_name} — ${a.brand}: ${a.pct_atingido}% da meta (${a.qty_atual} de ${a.meta} un., faltam ${Math.round((a.meta - a.qty_atual) * 10) / 10} un.)` +
          (a.segmentacao ? ` [seg. ${a.segmentacao}]` : '')
        ).join('\n')
      : '  • Nenhum médico próximo de conta ativa no momento.'

    const dropoutLines = topDropouts.length
      ? topDropouts.map(d =>
          `  • ${d.name} — ${d.brand}: tinha ${d.prevQty} un. no trimestre anterior, agora tem ${d.currQty} un. (meta: ${d.meta})`
        ).join('\n')
      : '  • Nenhum dropout identificado.'

    const context = [
      `Trimestre atual: ${currentQ} | Trimestre anterior: ${previousQ}`,
      ``,
      `Dropouts (${dropouts.length} total — top 3):`,
      dropoutLines,
      ``,
      `Planejados sem compra este trimestre: ${plannedNotPurchasedCount} médicos`,
      ``,
      `Mais perto de conta ativa (${allNearActive.length} total — top 3):`,
      nearActiveLines,
    ].join('\n')

    const repLabel = rep || 'Carlos Junior'
    const prompt = `Você é Galton AI, assistente de inteligência de vendas da Galderma.
Com base nos dados reais abaixo da carteira do representante ${repLabel},
escreva um briefing em exatamente 2-3 frases curtas e diretas em português.
Destaque as oportunidades mais urgentes. Seja específico com nomes e números.
NÃO use bullet points nem listas. Escreva como um parágrafo corrido.
NÃO inclua título, cabeçalho ou rótulo (ex: "Briefing executivo", nome do representante). Apenas o texto do briefing.
Tom: analista de vendas experiente falando diretamente com o representante.
Use linguagem humana e ativa, não robótica.

Dados reais da carteira:
${context}

Gere o briefing agora:`

    // ── 8. Call Claude for the briefing ──────────────────────────────────────
    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })

    let text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim()

    // Remove título/cabeçalho que o modelo às vezes adiciona (ex: "BRIEFING EXECUTIVO - Carlos Junior")
    text = text.replace(/^briefing\s+executivo\s*[-–—:\s].*\n?/im, '').trim()

    function extractSnippet(briefingText: string, clientName: string): string {
      if (!briefingText || !clientName) return ''
      const name = clientName.trim()
      if (name.length < 3) return ''
      const idx = briefingText.toLowerCase().indexOf(name.toLowerCase())
      if (idx < 0) return ''
      const before = briefingText.slice(0, idx)
      const after = briefingText.slice(idx)
      const start = Math.max(0, (Math.max(before.lastIndexOf('.'), before.lastIndexOf(',')) + 1) || 0)
      let end = idx + after.length
      for (const sep of ['.', ',', '\n']) {
        const pos = after.indexOf(sep)
        if (pos >= 0) end = Math.min(end, idx + pos + 1)
      }
      end = Math.min(end, idx + 150)
      let snippet = briefingText.slice(start, end).trim()
      if (snippet.length > 120) snippet = snippet.slice(0, 117) + '…'
      return snippet
    }

    const highlightedClients = [
      ...topDropouts.map(d => ({
        name: d.name,
        brand: d.brand,
        type: 'dropout' as const,
        snippet: extractSnippet(text, d.name),
      })),
      ...topNearActive.map(a => ({
        name: a.one_name,
        brand: a.brand,
        type: 'near_active' as const,
        snippet: extractSnippet(text, a.one_name),
      })),
    ]

    const meta = {
      currentQuarter: currentQ,
      previousQuarter: previousQ,
      dropoutsTotal: dropouts.length,
      plannedNotPurchasedTotal: plannedNotPurchasedCount,
      nearActiveTotal: allNearActive.length,
    }

    // Salvar no cache para o dia
    try {
      await supabase.from('daily_briefings').upsert(
        {
          rep_key: repKey,
          briefing_date: today,
          briefing: text,
          highlighted_clients: highlightedClients,
          meta,
        },
        { onConflict: 'rep_key,briefing_date' }
      )
    } catch (e) {
      console.warn('[dashboard-summary] cache save failed:', e)
    }

    res.json({
      briefing: text,
      highlightedClients,
      meta,
    })
  } catch (err) {
    console.error('Dashboard summary error:', err)
    res.status(500).json({ error: 'Erro ao gerar resumo', detail: String(err) })
  }
})

export default router
