import { db } from "../lib/supabase.ts"
import { json, noContent } from "../lib/http.ts"

const DEFAULT_METRICS = [
  {
    id: "builtin-1",
    name: "getNearActiveAccounts",
    display_name: "Próximos de conta ativa",
    description:
      "Retorna médicos próximos de virar conta ativa, agrupados por segmentação (A→B→C→D→E→N/D). Cada grupo traz até 5 contas ordenadas por % atingido decrescente.",
    handler_type: "builtin" as const,
    handler_config: {},
    created_at: "",
    updated_at: "",
  },
  {
    id: "builtin-2",
    name: "getPlannedNotPurchased",
    display_name: "Planejados sem compra",
    description:
      "Retorna médicos da carteira que compraram no trimestre anterior mas não realizaram nenhuma compra no trimestre atual. Ordenados por segmentação A→E.",
    handler_type: "builtin" as const,
    handler_config: {},
    created_at: "",
    updated_at: "",
  },
  {
    id: "builtin-3",
    name: "getDropouts",
    display_name: "Dropouts",
    description:
      "Retorna contas que eram ativas no trimestre anterior mas não atingiram a meta no trimestre atual (dropouts do trimestre). Ordenados por segmentação.",
    handler_type: "builtin" as const,
    handler_config: {},
    created_at: "",
    updated_at: "",
  },
]

function toToolName(displayName: string): string {
  const words = displayName
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return "getCustom"
  const camel = words
    .map((w, i) =>
      i === 0
        ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join("")
  return "get" + camel
}

function validateCustomSql(sql: string): boolean {
  const trimmed = sql.trim()
  if (!trimmed.toUpperCase().startsWith("SELECT")) return false
  if (/;\s*$/.test(trimmed)) return false
  if (/\b(DROP|DELETE|UPDATE|INSERT|TRUNCATE|ALTER|CREATE)\b/i.test(trimmed)) return false
  if (!/\bFROM\s+galton\./i.test(trimmed)) return false
  return true
}

export async function handleMetricsList(): Promise<Response> {
  try {
    const { data, error } = await db()
      .from("metrics")
      .select("id, name, display_name, description, handler_type, handler_config, created_at, updated_at")
      .order("created_at", { ascending: true })

    if (error) {
      const msg = String((error as { message?: string }).message || error)
      const tableMissing = /does not exist|relation.*not found|table.*not found/i.test(msg)
      if (tableMissing) {
        console.warn("[metrics] Tabela galton.metrics não existe. Retornando métricas padrão.")
        return json(DEFAULT_METRICS)
      }
      throw error
    }
    return json(data?.length ? data : DEFAULT_METRICS)
  } catch (err) {
    console.error("Metrics list error:", err)
    return json(
      { error: "Erro ao listar métricas", detail: err instanceof Error ? err.message : String(err) },
      500,
    )
  }
}

export async function handleMetricsPreview(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { sql?: string }
    const trimmed = body.sql?.trim()
    if (!trimmed) {
      return json({ error: "Campo sql é obrigatório" }, 400)
    }
    if (!validateCustomSql(trimmed)) {
      return json({
        error:
          "SQL inválido. Use apenas SELECT, referencie tabelas do schema galton (galton.tabela), sem comandos de alteração.",
      }, 400)
    }
    const { data, error } = await db().rpc("exec_select_sql", { query_text: trimmed })
    if (error) {
      return json({ error: error.message }, 400)
    }
    const rows = Array.isArray(data) ? data : data ? [data] : []
    return json({ rows, count: rows.length })
  } catch (err) {
    console.error("Metrics preview error:", err)
    return json(
      { error: "Erro ao executar preview", detail: err instanceof Error ? err.message : String(err) },
      500,
    )
  }
}

export async function handleMetricsCreate(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as {
      display_name?: string
      description?: string
      handler_type?: "builtin" | "custom_sql"
      handler_config?: { sql?: string }
    }
    const { display_name, description, handler_type, handler_config } = body

    if (!display_name?.trim() || !description?.trim()) {
      return json({ error: "display_name e description são obrigatórios" }, 400)
    }

    const handler = handler_type || "custom_sql"
    if (handler !== "builtin" && handler !== "custom_sql") {
      return json({ error: "handler_type deve ser builtin ou custom_sql" }, 400)
    }

    let name = toToolName(display_name)
    if (handler === "custom_sql") {
      const sql = handler_config?.sql?.trim()
      if (!sql) return json({ error: "Para métricas custom_sql, handler_config.sql é obrigatório" }, 400)
      if (!validateCustomSql(sql)) {
        return json({
          error:
            "SQL inválido. Use apenas SELECT, referencie tabelas do schema galton (galton.tabela), sem comandos de alteração.",
        }, 400)
      }
      const baseName = name
      let suffix = 0
      while (true) {
        const candidate = suffix === 0 ? baseName : `${baseName}_${suffix}`
        const { data: existing } = await db().from("metrics").select("id").eq("name", candidate).maybeSingle()
        if (!existing) {
          name = candidate
          break
        }
        suffix++
      }
    }

    const { data, error } = await db()
      .from("metrics")
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
    return json(data, 201)
  } catch (err) {
    console.error("Metrics create error:", err)
    return json({ error: "Erro ao criar métrica" }, 500)
  }
}

export async function handleMetricsPatch(req: Request, id: string): Promise<Response> {
  try {
    const body = (await req.json()) as {
      display_name?: string
      description?: string
      handler_config?: { sql?: string }
    }
    const { display_name, description, handler_config } = body

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (display_name != null) updates.display_name = display_name.trim()
    if (description != null) updates.description = description.trim()
    if (handler_config != null) {
      const sql = handler_config?.sql?.trim()
      if (sql && !validateCustomSql(sql)) {
        return json({
          error: "SQL inválido. Use apenas SELECT, referencie tabelas do schema galton (galton.tabela).",
        }, 400)
      }
      updates.handler_config = handler_config
    }

    const { data, error } = await db()
      .from("metrics")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error
    if (!data) return json({ error: "Métrica não encontrada" }, 404)
    return json(data)
  } catch (err) {
    console.error("Metrics update error:", err)
    return json({ error: "Erro ao atualizar métrica" }, 500)
  }
}

export async function handleMetricsDelete(id: string): Promise<Response> {
  try {
    const { error } = await db().from("metrics").delete().eq("id", id)
    if (error) throw error
    return noContent()
  } catch (err) {
    console.error("Metrics delete error:", err)
    return json({ error: "Erro ao excluir métrica" }, 500)
  }
}
