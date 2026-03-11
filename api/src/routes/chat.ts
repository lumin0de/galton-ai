import { Router, Request, Response } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { getNearActiveAccounts, NearActiveBySegGroup } from '../tools/getNearActiveAccounts'
import { getPlannedNotPurchased } from '../tools/getPlannedNotPurchased'
import { db as supabase } from '../db/supabase'

const router = Router()

let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

const SKILLS_DIR = path.resolve(__dirname, '../skills')

function loadSkill(filename: string): string {
  try {
    return fs.readFileSync(path.join(SKILLS_DIR, filename), 'utf-8')
  } catch {
    return ''
  }
}

// ─── Tool definitions for Claude ─────────────────────────────────────────────

const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'getNearActiveAccounts',
    description:
      'Retorna médicos próximos de virar conta ativa, agrupados por segmentação (A→B→C→D→E→N/D). Cada grupo traz até 5 contas ordenadas por % atingido decrescente. Apresente os resultados exatamente nessa estrutura: um bloco por segmentação.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'getPlannedNotPurchased',
    description:
      'Retorna médicos da carteira que compraram no trimestre anterior mas não realizaram nenhuma compra no trimestre atual. Ordenados por segmentação A→E.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'getDropouts',
    description:
      'Retorna contas que eram ativas no trimestre anterior mas não atingiram a meta no trimestre atual (dropouts do trimestre). Ordenados por segmentação.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
]

// ─── Tool executor ────────────────────────────────────────────────────────────

async function executeTool(name: string): Promise<string> {
  try {
    if (name === 'getNearActiveAccounts') {
      const result = await getNearActiveAccounts()
      return JSON.stringify(result)
    }

    if (name === 'getPlannedNotPurchased') {
      const result = await getPlannedNotPurchased()
      return JSON.stringify(result)
    }

    if (name === 'getDropouts') {
      const TARGETS: Record<string, number> = { DYSPORT: 10, RESTYLANE: 10, SCULPTRA: 6 }

      const { data: latestRow } = await supabase
        .from('sales')
        .select('year_ref, month_ref')
        .not('year_ref', 'is', null)
        .not('month_ref', 'is', null)
        .order('year_ref', { ascending: false })
        .order('month_ref', { ascending: false })
        .limit(1)

      const lr = (latestRow || [])[0] as { year_ref: number; month_ref: number } | undefined
      const currentQ = lr ? `Q${Math.ceil(lr.month_ref / 3)}_${lr.year_ref}` : 'Q4_2024'
      const [qNum, yr] = [parseInt(currentQ[1]!), parseInt(currentQ.split('_')[1]!)]
      const previousQ = qNum === 1 ? `Q4_${yr - 1}` : `Q${qNum - 1}_${yr}`

      const { data: prevData } = await supabase
        .from('sales')
        .select('one_id, one_name, brand, qty_equiv')
        .eq('quarter', previousQ)
        .in('brand', ['DYSPORT', 'RESTYLANE', 'SCULPTRA'])

      const { data: currData } = await supabase
        .from('sales')
        .select('one_id, brand, qty_equiv')
        .eq('quarter', currentQ)
        .in('brand', ['DYSPORT', 'RESTYLANE', 'SCULPTRA'])

      const prevAgg: Record<string, { one_name: string; brand: string; qty: number }> = {}
      for (const row of (prevData || []) as Array<{ one_id: string; one_name: string; brand: string; qty_equiv: number }>) {
        const key = `${row.one_id}||${row.brand}`
        if (!prevAgg[key]) prevAgg[key] = { one_name: row.one_name, brand: row.brand, qty: 0 }
        prevAgg[key]!.qty += Number(row.qty_equiv)
      }

      const currAgg: Record<string, number> = {}
      for (const row of (currData || []) as Array<{ one_id: string; brand: string; qty_equiv: number }>) {
        const key = `${row.one_id}||${row.brand}`
        currAgg[key] = (currAgg[key] || 0) + Number(row.qty_equiv)
      }

      const dropouts = Object.entries(prevAgg)
        .filter(([key, val]) => {
          const target = TARGETS[val.brand] ?? 10
          if (val.qty < target) return false
          return (currAgg[key] || 0) < target
        })
        .map(([key, val]) => ({
          one_name: val.one_name,
          brand: val.brand,
          prev_qty: Math.round(val.qty * 10) / 10,
          curr_qty: Math.round((currAgg[key] || 0) * 10) / 10,
          meta: TARGETS[val.brand] ?? 10,
          currentQ,
          previousQ,
        }))
        .slice(0, 20)

      return JSON.stringify(dropouts)
    }

    return JSON.stringify({ error: `Ferramenta desconhecida: ${name}` })
  } catch (err) {
    return JSON.stringify({ error: String(err) })
  }
}

// ─── POST /api/chat — streaming SSE ──────────────────────────────────────────

router.post('/chat', async (req: Request, res: Response) => {
  const { message, history = [] } = req.body as {
    message: string
    history?: Array<{ role: 'user' | 'assistant'; content: string }>
  }

  if (!message) {
    res.status(400).json({ error: 'Campo "message" é obrigatório' })
    return
  }

  const persona = loadSkill('agent-persona.md')
  const rules = loadSkill('business-rules.md')

  const now = new Date()
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' })
  const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}_${now.getFullYear()}`
  const context = `## Contexto temporal\nHoje é ${dateStr}, ${timeStr}. Trimestre atual: ${quarter}.`

  const systemPrompt = `${persona}\n\n---\n\n${rules}\n\n---\n\n${context}`

  const messages: Anthropic.MessageParam[] = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ]

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  // Track structured data from tool calls
  let nearActiveData: NearActiveBySegGroup[] | null = null

  try {
    // Agentic loop: stream each call, execute tools if needed, stream final response
    while (true) {
      const stream = getClient().messages.stream({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        tools: TOOL_DEFINITIONS,
        messages,
      })

      // Stream text chunks to client in real-time
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
        }
      }

      const finalMessage = await stream.finalMessage()

      if (finalMessage.stop_reason === 'tool_use') {
        // Execute all requested tools and capture structured data if applicable
        const toolUseBlocks = finalMessage.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
        )
        const toolResults: Anthropic.ToolResultBlockParam[] = []
        for (const toolCall of toolUseBlocks) {
          console.log(`[chat] Executing tool: ${toolCall.name}`)
          const result = await executeTool(toolCall.name)

          // Capture nearActive data for structured_data SSE event
          if (toolCall.name === 'getNearActiveAccounts') {
            try { nearActiveData = JSON.parse(result) as NearActiveBySegGroup[] } catch { /* ignore */ }
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: result,
          })
        }

        messages.push({ role: 'assistant', content: finalMessage.content })
        messages.push({ role: 'user', content: toolResults })
      } else {
        // Final text response was streamed — send structured_data if available, then done
        if (nearActiveData) {
          const items = nearActiveData.flatMap(group =>
            group.contas.map(c => ({
              name: c.one_name,
              brand: c.brand,
              qty_atual: c.qty_atual,
              meta: c.meta,
              pct_atingido: c.pct_atingido,
              segmentacao: c.segmentacao,
            }))
          )
          res.write(`data: ${JSON.stringify({ structured_data: { type: 'near_active', items } })}\n\n`)
        }

        res.write('data: [DONE]\n\n')
        res.end()
        break
      }
    }
  } catch (err) {
    console.error('Chat error:', err)
    const detail = String(err)
    if (detail.includes('credit balance is too low')) {
      res.write(`data: ${JSON.stringify({ error: 'billing', detail: 'Saldo Anthropic insuficiente. Acesse console.anthropic.com → Billing para adicionar créditos.' })}\n\n`)
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Erro ao processar mensagem', detail })}\n\n`)
    }
    res.write('data: [DONE]\n\n')
    res.end()
  }
})

export default router
