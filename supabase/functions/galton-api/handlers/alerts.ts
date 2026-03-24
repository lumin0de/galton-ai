import { db } from "../lib/supabase.ts"
import { json } from "../lib/http.ts"

const SEG_ORDER: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 }
const TARGETS: Record<string, number> = { DYSPORT: 10, RESTYLANE: 10, SCULPTRA: 6 }

function segSort(a: string | null, b: string | null): number {
  return (SEG_ORDER[a || ""] ?? 99) - (SEG_ORDER[b || ""] ?? 99)
}

function prevQuarter(q: string): string {
  const match = q.match(/Q(\d)_(\d{4})/)
  if (!match) return q
  const qNum = parseInt(match[1]!)
  const year = parseInt(match[2]!)
  return qNum === 1 ? `Q4_${year - 1}` : `Q${qNum - 1}_${year}`
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

async function getDropouts(currentQ: string, previousQ: string, territoryCode?: string) {
  const sb = db()
  let prevQ = sb
    .from("sales")
    .select("one_id, one_name, brand, qty_equiv, doctor_id")
    .eq("quarter", previousQ)
    .in("brand", ["DYSPORT", "RESTYLANE", "SCULPTRA"])
  if (territoryCode) prevQ = prevQ.eq("territory_code", territoryCode)
  const { data: prevData, error: e1 } = await prevQ

  if (e1) throw e1

  const prevAgg: Record<string, { one_name: string; brand: string; qty: number; doctorId: string }> = {}
  for (const row of (prevData || []) as Array<{
    one_id: string
    one_name: string
    brand: string
    qty_equiv: number
    doctor_id: string
  }>) {
    const key = `${row.one_id}||${row.brand}`
    if (!prevAgg[key]) prevAgg[key] = { one_name: row.one_name, brand: row.brand, qty: 0, doctorId: row.doctor_id }
    prevAgg[key]!.qty += Number(row.qty_equiv)
  }

  const prevActiveIds = new Set(
    Object.entries(prevAgg)
      .filter(([, val]) => val.qty >= (TARGETS[val.brand] ?? 10))
      .map(([key]) => key.split("||")[0]!),
  )
  if (prevActiveIds.size === 0) return []

  let currQ = sb
    .from("sales")
    .select("one_id, brand, qty_equiv")
    .eq("quarter", currentQ)
    .in("brand", ["DYSPORT", "RESTYLANE", "SCULPTRA"])
  if (territoryCode) currQ = currQ.eq("territory_code", territoryCode)
  const { data: currData, error: e2 } = await currQ

  if (e2) throw e2

  const currAgg: Record<string, number> = {}
  for (const row of (currData || []) as Array<{ one_id: string; brand: string; qty_equiv: number }>) {
    const key = `${row.one_id}||${row.brand}`
    currAgg[key] = (currAgg[key] || 0) + Number(row.qty_equiv)
  }

  const dropouts: Array<{
    one_name: string
    brand: string
    prev_qty: number
    curr_qty: number
    meta: number
    segmentacao: string | null
  }> = []
  const seen = new Set<string>()

  for (const [key, val] of Object.entries(prevAgg)) {
    const [oneId, brand] = key.split("||") as [string, string]
    if (!prevActiveIds.has(oneId)) continue
    const target = TARGETS[brand] ?? 10
    if (val.qty < target) continue
    const currQty = currAgg[key] || 0
    if (currQty >= target) continue
    if (seen.has(key)) continue
    seen.add(key)
    dropouts.push({
      one_name: val.one_name,
      brand,
      prev_qty: Math.round(val.qty * 10) / 10,
      curr_qty: Math.round(currQty * 10) / 10,
      meta: target,
      segmentacao: null,
    })
  }

  const oneIds = [
    ...new Set(
      dropouts
        .map((d) => Object.entries(prevAgg).find(([, v]) => v.one_name === d.one_name)?.[0].split("||")[0])
        .filter(Boolean),
    ),
  ] as string[]

  const { data: docs } = await sb
    .from("doctors")
    .select("one_id, seg_dysport, seg_restylane, seg_sculptra")
    .in("one_id", oneIds)

  const segMap: Record<string, { seg_dysport: string; seg_restylane: string; seg_sculptra: string }> = {}
  for (const d of (docs || []) as Array<{
    one_id: string
    seg_dysport: string
    seg_restylane: string
    seg_sculptra: string
  }>) {
    if (!segMap[d.one_id]) segMap[d.one_id] = d
  }

  for (const d of dropouts) {
    const oneId = Object.entries(prevAgg).find(([, v]) => v.one_name === d.one_name)?.[0].split("||")[0]
    if (!oneId) continue
    const doc = segMap[oneId]
    if (doc) {
      if (d.brand === "DYSPORT") d.segmentacao = doc.seg_dysport
      else if (d.brand === "RESTYLANE") d.segmentacao = doc.seg_restylane
      else if (d.brand === "SCULPTRA") d.segmentacao = doc.seg_sculptra
    }
  }

  return dropouts.sort((a, b) => segSort(a.segmentacao, b.segmentacao)).slice(0, 20)
}

async function getCrossSell(currentQ: string, territoryCode?: string) {
  const sb = db()
  let currQ = sb
    .from("sales")
    .select("one_id, one_name, brand")
    .eq("quarter", currentQ)
    .in("brand", ["DYSPORT", "RESTYLANE", "SCULPTRA"])
  if (territoryCode) currQ = currQ.eq("territory_code", territoryCode)
  const { data: currData, error: e1 } = await currQ

  if (e1) throw e1
  if (!currData || currData.length === 0) return []

  const currBrands: Record<string, { one_name: string; brands: Set<string> }> = {}
  for (const row of currData as Array<{ one_id: string; one_name: string; brand: string }>) {
    if (!currBrands[row.one_id]) currBrands[row.one_id] = { one_name: row.one_name, brands: new Set() }
    currBrands[row.one_id]!.brands.add(row.brand)
  }

  const allOneIds = Object.keys(currBrands)

  let allQ = sb
    .from("sales")
    .select("one_id, brand")
    .in("one_id", allOneIds)
    .in("brand", ["DYSPORT", "RESTYLANE", "SCULPTRA"])
    .limit(10000)
  if (territoryCode) allQ = allQ.eq("territory_code", territoryCode)
  const { data: allData, error: e2 } = await allQ

  if (e2) throw e2

  const allTimeBrands: Record<string, Set<string>> = {}
  for (const row of (allData || []) as Array<{ one_id: string; brand: string }>) {
    if (!allTimeBrands[row.one_id]) allTimeBrands[row.one_id] = new Set()
    allTimeBrands[row.one_id]!.add(row.brand)
  }

  const crossSellRaw: Array<{ oneId: string; one_name: string; has: string; missing: string }> = []

  for (const [oneId, val] of Object.entries(currBrands)) {
    const curr = val.brands
    const allTime = allTimeBrands[oneId] ?? new Set()
    const missing: string[] = []

    if (curr.has("RESTYLANE") && !allTime.has("DYSPORT")) missing.push("DYSPORT")
    if (curr.has("DYSPORT") && !allTime.has("RESTYLANE")) missing.push("RESTYLANE")
    if (!allTime.has("SCULPTRA") && curr.size >= 1) missing.push("SCULPTRA")

    for (const m of missing) {
      crossSellRaw.push({ oneId, one_name: val.one_name, has: [...curr].join(", "), missing: m })
    }
  }

  if (crossSellRaw.length === 0) return []

  const csOneIds = [...new Set(crossSellRaw.map((c) => c.oneId))]
  const { data: csDocData } = await sb
    .from("doctors")
    .select("one_id, seg_dysport, seg_restylane, seg_sculptra")
    .in("one_id", csOneIds)

  const csSegMap: Record<string, { seg_dysport: string; seg_restylane: string; seg_sculptra: string }> = {}
  for (const doc of (csDocData || []) as Array<{
    one_id: string
    seg_dysport: string
    seg_restylane: string
    seg_sculptra: string
  }>) {
    if (!csSegMap[doc.one_id]) csSegMap[doc.one_id] = doc
  }

  const crossSell = crossSellRaw.map(({ oneId, ...rest }) => {
    const doc = csSegMap[oneId]
    let seg: string | null = null
    if (doc) {
      seg =
        (rest.missing === "DYSPORT"
          ? doc.seg_dysport
          : rest.missing === "RESTYLANE"
            ? doc.seg_restylane
            : doc.seg_sculptra) ||
        doc.seg_dysport ||
        doc.seg_restylane ||
        doc.seg_sculptra ||
        null
    }
    return { ...rest, segmentacao: seg }
  })

  return crossSell.sort((a, b) => segSort(a.segmentacao, b.segmentacao)).slice(0, 20)
}

async function getPlannedNotPurchased(currentQ: string, previousQ: string, territoryCode?: string) {
  const sb = db()
  let prevQ = sb.from("sales").select("one_id, one_name, brand, billed_at, doctor_id").eq("quarter", previousQ)
  if (territoryCode) prevQ = prevQ.eq("territory_code", territoryCode)
  const { data: prevData, error: e1 } = await prevQ

  if (e1) throw e1
  if (!prevData || prevData.length === 0) return []

  const prevOneIds = new Set((prevData as Array<{ one_id: string }>).map((r) => r.one_id))

  let currQ = sb.from("sales").select("one_id").eq("quarter", currentQ)
  if (territoryCode) currQ = currQ.eq("territory_code", territoryCode)
  const { data: currData, error: e2 } = await currQ

  if (e2) throw e2
  const currOneIds = new Set((currData || ([] as Array<{ one_id: string }>)).map((r: { one_id: string }) => r.one_id))

  const notPurchased = [...prevOneIds].filter((id) => !currOneIds.has(id))
  if (notPurchased.length === 0) return []

  const lastMap: Record<string, { one_name: string; brand: string; billed_at: string; doctor_id: string }> = {}
  for (const row of prevData as Array<{
    one_id: string
    one_name: string
    brand: string
    billed_at: string
    doctor_id: string
  }>) {
    const existing = lastMap[row.one_id]
    if (!existing || row.billed_at > existing.billed_at) lastMap[row.one_id] = row
  }

  const pnpOneIds = [...new Set(notPurchased)]
  const { data: docData } = await sb
    .from("doctors")
    .select("one_id, seg_dysport, seg_restylane, seg_sculptra")
    .in("one_id", pnpOneIds)

  const docSegMap: Record<string, { seg_dysport: string; seg_restylane: string; seg_sculptra: string }> = {}
  for (const doc of (docData || []) as Array<{
    one_id: string
    seg_dysport: string
    seg_restylane: string
    seg_sculptra: string
  }>) {
    if (!docSegMap[doc.one_id]) docSegMap[doc.one_id] = doc
  }

  const SEG_ORDER_LOCAL: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 }

  return notPurchased
    .slice(0, 50)
    .map((oneId) => {
      const last = lastMap[oneId]!
      const doc = docSegMap[oneId]
      let seg: string | null = null
      if (doc) {
        seg =
          (last.brand === "DYSPORT"
            ? doc.seg_dysport
            : last.brand === "RESTYLANE"
              ? doc.seg_restylane
              : doc.seg_sculptra) ||
          doc.seg_dysport ||
          doc.seg_restylane ||
          doc.seg_sculptra ||
          null
      }
      const dateDisplay = last.billed_at || previousQ
      return {
        one_name: last.one_name,
        segmentacao: seg,
        last_product: last.brand,
        last_purchase_date: dateDisplay,
      }
    })
    .sort(
      (a, b) =>
        (SEG_ORDER_LOCAL[a.segmentacao || ""] ?? 99) - (SEG_ORDER_LOCAL[b.segmentacao || ""] ?? 99),
    )
}

async function getRepTerritory(repName: string): Promise<string | null> {
  const { data } = await db().from("representatives").select("territory_code").eq("name", repName).single()
  return (data as { territory_code: string | null } | null)?.territory_code ?? null
}

export async function handleAlerts(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url)
    const rep = url.searchParams.get("rep")?.trim()
    const territoryCode = rep ? await getRepTerritory(rep) : null

    const currentQ = await getLatestQuarter()
    const previousQ = prevQuarter(currentQ)

    const [dropouts, crossSell, plannedNotPurchased] = await Promise.all([
      getDropouts(currentQ, previousQ, territoryCode ?? undefined),
      getCrossSell(currentQ, territoryCode ?? undefined),
      getPlannedNotPurchased(currentQ, previousQ, territoryCode ?? undefined),
    ])

    return json({
      currentQuarter: currentQ,
      previousQuarter: previousQ,
      dropouts,
      crossSell,
      plannedNotPurchased,
    })
  } catch (err) {
    console.error("Alerts error:", err)
    return json({ error: "Erro ao buscar alertas", detail: String(err) }, 500)
  }
}
