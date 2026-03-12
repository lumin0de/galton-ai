import { Router, Request, Response } from 'express'
import { db as supabase } from '../db/supabase'

const router = Router()

// ─── GET /api/representatives ───────────────────────────────────────────────

router.get('/representatives', async (_req: Request, res: Response) => {
  try {
    const { data: reps, error: repsErr } = await supabase
      .from('representatives')
      .select('id, name, territory_code, email, manager_district, manager_regional')
      .order('name', { ascending: true })

    if (repsErr) throw repsErr
    if (!reps?.length) return res.json([])

    const repNames = (reps as Array<{ name: string }>).map(r => r.name)

    let loginByRep: Record<string, number> = {}
    try {
      const { data: loginCounts } = await supabase.from('rep_login_log').select('rep_name')
      for (const row of (loginCounts || []) as Array<{ rep_name: string }>) {
        loginByRep[row.rep_name] = (loginByRep[row.rep_name] || 0) + 1
      }
    } catch {
      // rep_login_log pode não existir ainda
    }

    const { data: convs } = await supabase
      .from('chat_conversations')
      .select('id, rep_name')
    const convIdsByRep: Record<string, string[]> = {}
    for (const c of (convs || []) as Array<{ id: string; rep_name: string }>) {
      if (!convIdsByRep[c.rep_name]) convIdsByRep[c.rep_name] = []
      convIdsByRep[c.rep_name].push(c.id)
    }

    const allConvIds = [...new Set(Object.values(convIdsByRep).flat())]
    let msgCountByConv: Record<string, number> = {}
    if (allConvIds.length > 0) {
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('conversation_id, role')
        .in('conversation_id', allConvIds)
        .eq('role', 'user')
      for (const m of (msgs || []) as Array<{ conversation_id: string }>) {
        msgCountByConv[m.conversation_id] = (msgCountByConv[m.conversation_id] || 0) + 1
      }
    }

    const messageByRep: Record<string, number> = {}
    for (const [repName, ids] of Object.entries(convIdsByRep)) {
      messageByRep[repName] = ids.reduce((sum, id) => sum + (msgCountByConv[id] || 0), 0)
    }

    const result = (reps as Array<{ id: string; name: string; territory_code: string | null; email: string | null; manager_district: string | null; manager_regional: string | null }>).map(r => ({
      ...r,
      login_count: loginByRep[r.name] || 0,
      message_count: messageByRep[r.name] || 0,
    }))

    res.json(result)
  } catch (err) {
    console.error('Representatives list error:', err)
    res.status(500).json({ error: 'Erro ao listar representantes' })
  }
})

export default router
