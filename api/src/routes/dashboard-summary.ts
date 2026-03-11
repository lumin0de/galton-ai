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

// ─── GET /api/dashboard-summary ───────────────────────────────────────────────

router.get('/dashboard-summary', async (_req: Request, res: Response) => {
  try {
    const currentQ = await getLatestQuarter()
    const previousQ = prevQuarter(currentQ)

    // ── 1. Fetch raw sales data for both quarters ─────────────────────────────
    const [{ data: prevSales }, { data: currSales }, nearActiveGroups] = await Promise.all([
      supabase
        .from('sales')
        .select('one_id, one_name, brand, qty_equiv, seg_dysport:doctors(seg_dysport), seg_restylane:doctors(seg_restylane)')
        .eq('quarter', previousQ)
        .in('brand', ['DYSPORT', 'RESTYLANE', 'SCULPTRA']),
      supabase
        .from('sales')
        .select('one_id, brand, qty_equiv')
        .eq('quarter', currentQ)
        .in('brand', ['DYSPORT', 'RESTYLANE', 'SCULPTRA']),
      getNearActiveAccounts(),
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

    const prompt = `Você é Galton AI, assistente de inteligência de vendas da Galderma.
Com base nos dados reais abaixo da carteira do representante Carlos Junior,
escreva um briefing executivo em exatamente 2-3 frases curtas e diretas em português.
Destaque as oportunidades mais urgentes. Seja específico com nomes e números.
NÃO use bullet points nem listas. Escreva como um parágrafo corrido.
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

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim()

    res.json({
      briefing: text,
      meta: {
        currentQuarter: currentQ,
        previousQuarter: previousQ,
        dropoutsTotal: dropouts.length,
        plannedNotPurchasedTotal: plannedNotPurchasedCount,
        nearActiveTotal: allNearActive.length,
      },
    })
  } catch (err) {
    console.error('Dashboard summary error:', err)
    res.status(500).json({ error: 'Erro ao gerar resumo', detail: String(err) })
  }
})

export default router
