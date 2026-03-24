import Anthropic from "@anthropic-ai/sdk"
import { corsHeaders } from "../lib/http.ts"
import { db } from "../lib/supabase.ts"
import { loadSkill } from "../lib/skills.ts"
import { getNearActiveAccounts, type NearActiveBySegGroup } from "../tools/getNearActiveAccounts.ts"
import { getPlannedNotPurchased } from "../tools/getPlannedNotPurchased.ts"

let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) {
    const key = Deno.env.get("ANTHROPIC_API_KEY")
    if (!key) throw new Error("Missing ANTHROPIC_API_KEY")
    _client = new Anthropic({ apiKey: key })
  }
  return _client
}

async function loadToolDefinitions(): Promise<Anthropic.Tool[]> {
  const sb = db()
  const { data: metrics, error } = await sb
    .from("metrics")
    .select("name, display_name, description")
    .order("created_at", { ascending: true })

  if (error) {
    console.warn("[chat] loadToolDefinitions error:", error)
    return getDefaultToolDefinitions()
  }
  if (!metrics?.length) {
    return getDefaultToolDefinitions()
  }

  return metrics.map((m) => {
    const desc = (m as { display_name?: string }).display_name
      ? `[${(m as { display_name: string }).display_name}] ${m.description}`
      : m.description
    return {
      name: m.name,
      description: desc,
      input_schema: { type: "object" as const, properties: {} as Record<string, never>, required: [] as string[] },
    }
  })
}

function getDefaultToolDefinitions(): Anthropic.Tool[] {
  return [
    {
      name: "getNearActiveAccounts",
      description:
        "Retorna médicos próximos de virar conta ativa, agrupados por segmentação (A→B→C→D→E→N/D). Cada grupo traz até 5 contas ordenadas por % atingido decrescente. Apresente os resultados exatamente nessa estrutura: um bloco por segmentação.",
      input_schema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "getPlannedNotPurchased",
      description:
        "Retorna médicos da carteira que compraram no trimestre anterior mas não realizaram nenhuma compra no trimestre atual. Ordenados por segmentação A→E.",
      input_schema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "getDropouts",
      description:
        "Retorna contas que eram ativas no trimestre anterior mas não atingiram a meta no trimestre atual (dropouts do trimestre). Ordenados por segmentação.",
      input_schema: { type: "object" as const, properties: {}, required: [] },
    },
  ]
}

async function executeTool(name: string): Promise<string> {
  const sb = db()
  try {
    if (name === "getNearActiveAccounts") {
      const result = await getNearActiveAccounts()
      return JSON.stringify(result)
    }

    if (name === "getPlannedNotPurchased") {
      const result = await getPlannedNotPurchased()
      return JSON.stringify(result)
    }

    if (name === "getDropouts") {
      const TARGETS: Record<string, number> = { DYSPORT: 10, RESTYLANE: 10, SCULPTRA: 6 }

      const { data: latestRow } = await sb
        .from("sales")
        .select("year_ref, month_ref")
        .not("year_ref", "is", null)
        .not("month_ref", "is", null)
        .order("year_ref", { ascending: false })
        .order("month_ref", { ascending: false })
        .limit(1)

      const lr = (latestRow || [])[0] as { year_ref: number; month_ref: number } | undefined
      const currentQ = lr ? `Q${Math.ceil(lr.month_ref / 3)}_${lr.year_ref}` : "Q4_2024"
      const [qNum, yr] = [parseInt(currentQ[1]!), parseInt(currentQ.split("_")[1]!)]
      const previousQ = qNum === 1 ? `Q4_${yr - 1}` : `Q${qNum - 1}_${yr}`

      const { data: prevData } = await sb
        .from("sales")
        .select("one_id, one_name, brand, qty_equiv")
        .eq("quarter", previousQ)
        .in("brand", ["DYSPORT", "RESTYLANE", "SCULPTRA"])

      const { data: currData } = await sb
        .from("sales")
        .select("one_id, brand, qty_equiv")
        .eq("quarter", currentQ)
        .in("brand", ["DYSPORT", "RESTYLANE", "SCULPTRA"])

      const prevAgg: Record<string, { one_name: string; brand: string; qty: number }> = {}
      for (const row of (prevData || []) as Array<{
        one_id: string
        one_name: string
        brand: string
        qty_equiv: number
      }>) {
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

    const { data: metric } = await sb.from("metrics").select("handler_type, handler_config").eq("name", name).single()
    const sql = (metric?.handler_config as { sql?: string } | null)?.sql
    if (metric?.handler_type === "custom_sql" && sql) {
      const { data: rows, error: sqlErr } = await sb.rpc("exec_select_sql", {
        query_text: sql,
      })
      if (sqlErr) return JSON.stringify({ error: `Erro ao executar métrica: ${sqlErr.message}` })
      return JSON.stringify(rows ?? [])
    }

    return JSON.stringify({ error: `Ferramenta desconhecida: ${name}` })
  } catch (err) {
    return JSON.stringify({ error: String(err) })
  }
}

export async function handleChat(req: Request): Promise<Response> {
  let body: { message?: string; history?: Array<{ role: "user" | "assistant"; content: string }> }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    })
  }

  const { message, history = [] } = body
  if (!message) {
    return new Response(JSON.stringify({ error: 'Campo "message" é obrigatório' }), {
      status: 400,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    })
  }

  const persona = await loadSkill("agent-persona.md")
  const rules = await loadSkill("business-rules.md")
  const toolsHint =
    `Você tem acesso a ferramentas de dados. Algumas são métricas customizadas. Use a descrição de cada ferramenta para decidir quando chamá-la — considere todas as ferramentas disponíveis antes de responder.`

  const now = new Date()
  const dateStr = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
  const timeStr = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  })
  const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}_${now.getFullYear()}`
  const context = `## Contexto temporal\nHoje é ${dateStr}, ${timeStr}. Trimestre atual: ${quarter}.`

  const systemPrompt = `${persona}\n\n---\n\n${rules}\n\n---\n\n${toolsHint}\n\n---\n\n${context}`

  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ]

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const writeSse = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }

      let nearActiveData: NearActiveBySegGroup[] | null = null

      try {
        const toolDefinitions = await loadToolDefinitions()

        while (true) {
          const msgStream = getClient().messages.stream({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            system: systemPrompt,
            tools: toolDefinitions,
            messages,
          })

          for await (const event of msgStream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              writeSse({ text: event.delta.text })
            }
          }

          const finalMessage = await msgStream.finalMessage()

          if (finalMessage.stop_reason === "tool_use") {
            const toolUseBlocks = finalMessage.content.filter(
              (b): b is { type: "tool_use"; id: string; name: string } => b.type === "tool_use",
            )
            const toolResults: Anthropic.ToolResultBlockParam[] = []
            for (const toolCall of toolUseBlocks) {
              console.log(`[chat] Executing tool: ${toolCall.name}`)
              const result = await executeTool(toolCall.name)

              if (toolCall.name === "getNearActiveAccounts") {
                try {
                  nearActiveData = JSON.parse(result) as NearActiveBySegGroup[]
                } catch {
                  /* ignore */
                }
              }

              toolResults.push({
                type: "tool_result",
                tool_use_id: toolCall.id,
                content: result,
              })
            }

            messages.push({ role: "assistant", content: finalMessage.content })
            messages.push({ role: "user", content: toolResults })
          } else {
            if (nearActiveData) {
              const items = nearActiveData.flatMap((group) =>
                group.contas.map((c) => ({
                  name: c.one_name,
                  brand: c.brand,
                  qty_atual: c.qty_atual,
                  meta: c.meta,
                  pct_atingido: c.pct_atingido,
                  segmentacao: c.segmentacao,
                })),
              )
              writeSse({ structured_data: { type: "near_active", items } })
            }

            controller.enqueue(encoder.encode("data: [DONE]\n\n"))
            controller.close()
            break
          }
        }
      } catch (err) {
        console.error("Chat error:", err)
        const detail = String(err)
        if (detail.includes("credit balance is too low")) {
          writeSse({
            error: "billing",
            detail: "Saldo Anthropic insuficiente. Acesse console.anthropic.com → Billing para adicionar créditos.",
          })
        } else {
          writeSse({ error: "Erro ao processar mensagem", detail })
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      ...corsHeaders(),
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
