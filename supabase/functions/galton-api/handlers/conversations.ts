import { db } from "../lib/supabase.ts"
import { json, noContent } from "../lib/http.ts"

export async function handleConversationsList(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const repName = url.searchParams.get("rep")
  if (!repName) return json({ error: "Parâmetro ?rep= obrigatório" }, 400)

  const { data, error } = await db()
    .from("chat_conversations")
    .select("id, title, created_at, updated_at")
    .eq("rep_name", repName)
    .order("updated_at", { ascending: false })

  if (error) return json({ error: error.message }, 500)
  return json(data)
}

export async function handleConversationsCreate(req: Request): Promise<Response> {
  const body = (await req.json()) as { repName: string; title?: string }
  const { repName, title } = body
  if (!repName) return json({ error: "repName obrigatório" }, 400)

  const { data, error } = await db()
    .from("chat_conversations")
    .insert({ rep_name: repName, title: title ?? "Nova conversa" })
    .select("id, title, created_at, updated_at")
    .single()

  if (error) return json({ error: error.message }, 500)
  return json(data, 201)
}

export async function handleConversationsPatch(req: Request, id: string): Promise<Response> {
  const body = (await req.json()) as { title: string }
  const { title } = body
  if (!title) return json({ error: "title obrigatório" }, 400)

  const { data, error } = await db()
    .from("chat_conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, title, updated_at")
    .single()

  if (error) return json({ error: error.message }, 500)
  return json(data)
}

export async function handleConversationsDelete(id: string): Promise<Response> {
  const { error } = await db().from("chat_conversations").delete().eq("id", id)
  if (error) return json({ error: error.message }, 500)
  return noContent()
}

export async function handleMessagesList(id: string): Promise<Response> {
  const { data, error } = await db()
    .from("chat_messages")
    .select("id, role, content, structured_data, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })

  if (error) return json({ error: error.message }, 500)
  return json(data)
}

export async function handleMessagesCreate(req: Request, id: string): Promise<Response> {
  const body = (await req.json()) as {
    role: "user" | "assistant"
    content: string
    structured_data?: object
  }
  const { role, content, structured_data } = body

  if (!role || !content) return json({ error: "role e content obrigatórios" }, 400)

  const { data, error } = await db()
    .from("chat_messages")
    .insert({
      conversation_id: id,
      role,
      content,
      structured_data: structured_data ?? null,
    })
    .select("id, role, content, structured_data, created_at")
    .single()

  if (error) return json({ error: error.message }, 500)
  return json(data, 201)
}
