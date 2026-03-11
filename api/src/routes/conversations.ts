import { Router } from 'express'
import { db } from '../db/supabase'

const router = Router()

// ─── GET /api/conversations?rep=Carlos+Junior ─────────────────────────────────
// Lista conversas de um representante (mais recentes primeiro)
router.get('/conversations', async (req, res) => {
  const repName = req.query.rep as string
  if (!repName) return res.status(400).json({ error: 'Parâmetro ?rep= obrigatório' })

  const { data, error } = await db
    .from('chat_conversations')
    .select('id, title, created_at, updated_at')
    .eq('rep_name', repName)
    .order('updated_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// ─── POST /api/conversations ──────────────────────────────────────────────────
// Cria nova conversa
router.post('/conversations', async (req, res) => {
  const { repName, title } = req.body as { repName: string; title?: string }
  if (!repName) return res.status(400).json({ error: 'repName obrigatório' })

  const { data, error } = await db
    .from('chat_conversations')
    .insert({ rep_name: repName, title: title ?? 'Nova conversa' })
    .select('id, title, created_at, updated_at')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// ─── PATCH /api/conversations/:id ────────────────────────────────────────────
// Atualiza título da conversa
router.patch('/conversations/:id', async (req, res) => {
  const { id } = req.params
  const { title } = req.body as { title: string }
  if (!title) return res.status(400).json({ error: 'title obrigatório' })

  const { data, error } = await db
    .from('chat_conversations')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, title, updated_at')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// ─── DELETE /api/conversations/:id ───────────────────────────────────────────
// Exclui conversa (CASCADE remove as mensagens)
router.delete('/conversations/:id', async (req, res) => {
  const { id } = req.params

  const { error } = await db
    .from('chat_conversations')
    .delete()
    .eq('id', id)

  if (error) return res.status(500).json({ error: error.message })
  res.status(204).send()
})

// ─── GET /api/conversations/:id/messages ─────────────────────────────────────
// Retorna todas as mensagens de uma conversa (ordem cronológica)
router.get('/conversations/:id/messages', async (req, res) => {
  const { id } = req.params

  const { data, error } = await db
    .from('chat_messages')
    .select('id, role, content, structured_data, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// ─── POST /api/conversations/:id/messages ────────────────────────────────────
// Salva uma mensagem em uma conversa
router.post('/conversations/:id/messages', async (req, res) => {
  const { id } = req.params
  const { role, content, structured_data } = req.body as {
    role: 'user' | 'assistant'
    content: string
    structured_data?: object
  }

  if (!role || !content) return res.status(400).json({ error: 'role e content obrigatórios' })

  const { data, error } = await db
    .from('chat_messages')
    .insert({ conversation_id: id, role, content, structured_data: structured_data ?? null })
    .select('id, role, content, structured_data, created_at')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

export default router
