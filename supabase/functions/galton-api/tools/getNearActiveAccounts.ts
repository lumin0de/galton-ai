/**
 * getNearActiveAccounts — portado de api/src/tools/getNearActiveAccounts.ts
 */
import { db } from "../lib/supabase.ts"

const BRAND_TARGETS: Record<string, number> = {
  DYSPORT: 10,
  RESTYLANE: 10,
  SCULPTRA: 6,
}

export interface NearActiveAccount {
  one_name: string
  brand: string
  qty_atual: number
  meta: number
  pct_atingido: number
  segmentacao: string | null
}

export interface NearActiveBySegGroup {
  segmentacao: string
  contas: NearActiveAccount[]
}

async function getLatestQuarter(): Promise<string> {
  const sb = db()
  const { data } = await sb
    .from("sales")
    .select("year_ref, month_ref")
    .not("year_ref", "is", null)
    .not("month_ref", "is", null)
    .order("year_ref", { ascending: false })
    .order("month_ref", { ascending: false })
    .limit(1)

  const row = (data || [])[0] as { year_ref: number; month_ref: number } | undefined
  if (!row) return "Q4_2024"
  return `Q${Math.ceil(row.month_ref / 3)}_${row.year_ref}`
}

export async function getNearActiveAccounts(territoryCode?: string): Promise<NearActiveBySegGroup[]> {
  const sb = db()
  const currentQ = await getLatestQuarter()

  let query = sb
    .from("sales")
    .select("one_id, one_name, brand, qty_equiv")
    .eq("quarter", currentQ)
    .in("brand", ["DYSPORT", "RESTYLANE", "SCULPTRA"])
  if (territoryCode) query = query.eq("territory_code", territoryCode)
  const { data: salesData, error } = await query

  if (error) throw new Error(`getNearActiveAccounts query error: ${error.message}`)
  if (!salesData || salesData.length === 0) return []

  const groups: NearActiveBySegGroup[] = []
  const agg: Record<string, { one_name: string; brand: string; qty_equiv: number }> = {}

  for (const row of salesData as Array<{
    one_id: string
    one_name: string
    brand: string
    qty_equiv: number
  }>) {
    const key = `${row.one_id}||${row.brand}`
    if (!agg[key]) {
      agg[key] = { one_name: row.one_name, brand: row.brand, qty_equiv: 0 }
    }
    agg[key]!.qty_equiv += Number(row.qty_equiv)
  }

  const allOneIds = [...new Set(Object.keys(agg).map((k) => k.split("||")[0]!))]
  const { data: docData } = await sb
    .from("doctors")
    .select("one_id, seg_dysport, seg_restylane, seg_sculptra")
    .in("one_id", allOneIds)

  const docSegMap: Record<string, { seg_dysport: string; seg_restylane: string; seg_sculptra: string }> = {}
  for (const doc of (docData || []) as Array<{
    one_id: string
    seg_dysport: string
    seg_restylane: string
    seg_sculptra: string
  }>) {
    if (!docSegMap[doc.one_id]) docSegMap[doc.one_id] = doc
  }

  const results: NearActiveAccount[] = []
  for (const [key, val] of Object.entries(agg)) {
    const oneId = key.split("||")[0]!
    const meta = BRAND_TARGETS[val.brand] ?? 10
    const pct = (val.qty_equiv / meta) * 100

    if (pct >= 50 && pct < 100) {
      const doc = docSegMap[oneId]
      let seg: string | null = null
      if (doc) {
        if (val.brand === "DYSPORT") seg = doc.seg_dysport
        else if (val.brand === "RESTYLANE") seg = doc.seg_restylane
        else if (val.brand === "SCULPTRA") seg = doc.seg_sculptra
      }

      results.push({
        one_name: val.one_name,
        brand: val.brand,
        qty_atual: Math.round(val.qty_equiv * 100) / 100,
        meta,
        pct_atingido: Math.round(pct * 10) / 10,
        segmentacao: seg,
      })
    }
  }

  const SEG_ORDER: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 }
  const bySeg: Record<string, NearActiveAccount[]> = {}
  for (const r of results) {
    const seg = r.segmentacao ?? "N/D"
    if (!bySeg[seg]) bySeg[seg] = []
    bySeg[seg]!.push(r)
  }

  const segOrder = [...Object.keys(bySeg)].sort(
    (a, b) => (SEG_ORDER[a] ?? 99) - (SEG_ORDER[b] ?? 99),
  )

  for (const seg of segOrder) {
    groups.push({
      segmentacao: seg,
      contas: bySeg[seg]!.sort((a, b) => b.pct_atingido - a.pct_atingido).slice(0, 5),
    })
  }

  return groups
}
