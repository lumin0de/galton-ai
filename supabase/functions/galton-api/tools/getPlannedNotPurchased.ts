/**
 * getPlannedNotPurchased — portado de api/src/tools/getPlannedNotPurchased.ts
 */
import { db } from "../lib/supabase.ts"

const SEG_ORDER: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 }

export interface PlannedNotPurchased {
  one_name: string
  segmentacao: string | null
  last_product: string | null
  last_purchase_date: string | null
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

function prevQuarter(q: string): string {
  const match = q.match(/Q(\d)_(\d{4})/)
  if (!match) return q
  const qNum = parseInt(match[1]!)
  const year = parseInt(match[2]!)
  return qNum === 1 ? `Q4_${year - 1}` : `Q${qNum - 1}_${year}`
}

export async function getPlannedNotPurchased(): Promise<PlannedNotPurchased[]> {
  const sb = db()
  const currentQ = await getLatestQuarter()
  const previousQ = prevQuarter(currentQ)

  const { data: prevData, error: e1 } = await sb
    .from("sales")
    .select("one_id, one_name, brand, billed_at, doctor_id")
    .eq("quarter", previousQ)

  if (e1) throw new Error(`getPlannedNotPurchased prev query error: ${e1.message}`)
  if (!prevData || prevData.length === 0) return []

  const prevOneIds = new Set((prevData as Array<{ one_id: string }>).map((r) => r.one_id))

  const { data: currData, error: e2 } = await sb
    .from("sales")
    .select("one_id")
    .eq("quarter", currentQ)

  if (e2) throw new Error(`getPlannedNotPurchased curr query error: ${e2.message}`)
  const currOneIds = new Set((currData || []).map((r: { one_id: string }) => r.one_id))

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

  const allDoctorIds = [...new Set(Object.values(lastMap).map((r) => r.doctor_id).filter(Boolean))]
  const { data: docData } = await sb
    .from("doctors")
    .select("id, seg_dysport, seg_restylane, seg_sculptra")
    .in("id", allDoctorIds)

  const docSegMap: Record<string, { seg_dysport: string; seg_restylane: string; seg_sculptra: string }> = {}
  for (const doc of (docData || []) as Array<{
    id: string
    seg_dysport: string
    seg_restylane: string
    seg_sculptra: string
  }>) {
    docSegMap[doc.id] = doc
  }

  return notPurchased
    .slice(0, 50)
    .map((oneId) => {
      const last = lastMap[oneId]!
      const doc = docSegMap[last.doctor_id]
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
          doc.seg_sculptra
      }
      return {
        one_name: last.one_name,
        segmentacao: seg,
        last_product: last.brand,
        last_purchase_date: last.billed_at,
      }
    })
    .sort(
      (a, b) =>
        (SEG_ORDER[a.segmentacao || ""] ?? 99) - (SEG_ORDER[b.segmentacao || ""] ?? 99),
    )
}
