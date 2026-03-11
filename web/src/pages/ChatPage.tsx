import { useState, useRef, useEffect, useCallback } from 'react'
import type { KeyboardEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ProgressMessage from '../components/ProgressMessage'
import type { NearActiveItem } from '../components/ProgressMessage'

const API_URL = import.meta.env.VITE_API_URL || ''

// ─── Types ────────────────────────────────────────────────────────────────────

interface StructuredData {
  type: 'near_active'
  items: NearActiveItem[]
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  structured_data?: StructuredData
}

interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function saudacao(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function formatTime(ts: string): string {
  const date = new Date(ts)
  const diff = Date.now() - date.getTime()
  if (diff < 86_400_000) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (diff < 7 * 86_400_000) return date.toLocaleDateString('pt-BR', { weekday: 'short' })
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

const SUGGESTIONS = [
  'Quem está perto de virar conta ativa?',
  'Quais clientes planejados ainda não compraram este mês?',
  'Mostre meus dropouts deste trimestre',
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function AssistantAvatar() {
  return (
    <div aria-hidden="true" style={{
      width: 28, height: 28, borderRadius: 7,
      background: 'var(--color-accent)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12, color: 'white',
    }}>G</div>
  )
}

function MessageBubble({ msg, showCursor }: { msg: Message; showCursor?: boolean }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{
      display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 16, gap: 10, animation: 'fadeUp 0.2s ease',
    }}>
      {!isUser && <AssistantAvatar />}
      <div
        aria-live={showCursor ? 'polite' : undefined}
        style={{
          maxWidth: '68%', padding: '11px 16px',
          borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
          background: isUser ? 'var(--color-accent)' : 'var(--color-surface)',
          border: isUser ? 'none' : '1px solid var(--color-border)',
          color: isUser ? 'white' : 'var(--color-text-primary)',
          fontSize: 14, fontFamily: 'var(--font-body)', lineHeight: 1.6,
          ...(isUser ? { whiteSpace: 'pre-wrap' as const } : {}),
        }}
        className={isUser ? '' : (showCursor ? '' : 'prose prose-sm max-w-none')}
      >
        {isUser ? msg.content : showCursor ? (
          <span style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, fontFamily: 'var(--font-body)' }}>
            {msg.content}
            <span aria-hidden="true" style={{ animation: 'blink 1s infinite', color: 'var(--color-accent)', fontWeight: 300 }}>|</span>
          </span>
        ) : (
          <>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            {msg.structured_data?.type === 'near_active' && <ProgressMessage items={msg.structured_data.items} />}
          </>
        )}
      </div>
    </div>
  )
}

function IconPencil() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  )
}


// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChatPage({ repName }: { repName: string }) {
  const firstName = repName.split(' ')[0]

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [convLoading, setConvLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [msgLoading, setMsgLoading] = useState(false)

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [hoveredConvId, setHoveredConvId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch conversations on mount ─────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    setConvLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/conversations?rep=${encodeURIComponent(repName)}`)
      const data: Conversation[] = await res.json()
      setConversations(data)
      // Auto-select most recent conversation
      if (data.length > 0 && !activeId) {
        setActiveId(data[0].id)
      }
    } catch (e) {
      console.error('[conversations] falhou:', e)
    } finally {
      setConvLoading(false)
    }
  }, [repName])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  // ── Load messages when active conversation changes ───────────────────────────

  useEffect(() => {
    if (!activeId) { setMessages([]); return }
    setMsgLoading(true)
    fetch(`${API_URL}/api/conversations/${activeId}/messages`)
      .then(r => r.json())
      .then((data: { role: 'user' | 'assistant'; content: string; structured_data?: StructuredData }[]) => {
        setMessages(data.map(m => ({ role: m.role, content: m.content, structured_data: m.structured_data })))
      })
      .catch(e => console.error('[messages] falhou:', e))
      .finally(() => setMsgLoading(false))
  }, [activeId])

  useEffect(() => { inputRef.current?.focus() }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ── Conversation management ──────────────────────────────────────────────────

  async function newConversation() {
    try {
      const res = await fetch(`${API_URL}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repName, title: 'Nova conversa' }),
      })
      const conv: Conversation = await res.json()
      setConversations(prev => [conv, ...prev])
      setActiveId(conv.id)
      setMessages([])
      setInput('')
    } catch (e) {
      console.error('[new conversation] falhou:', e)
    }
  }

  function switchConversation(id: string) {
    if (id === activeId) return
    setActiveId(id)
    setInput('')
  }

  async function deleteConversation(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    try {
      await fetch(`${API_URL}/api/conversations/${id}`, { method: 'DELETE' })
      const updated = conversations.filter(c => c.id !== id)
      setConversations(updated)
      if (activeId === id) {
        const next = updated[0] ?? null
        setActiveId(next?.id ?? null)
        setMessages([])
      }
    } catch (e) {
      console.error('[delete conversation] falhou:', e)
    }
  }

  function startEditing(e: React.MouseEvent, conv: Conversation) {
    e.stopPropagation()
    setEditingId(conv.id)
    setEditingTitle(conv.title)
    setTimeout(() => {
      editInputRef.current?.select()
    }, 50)
  }

  async function commitEdit(convId: string) {
    const trimmed = editingTitle.trim()
    if (trimmed && trimmed !== conversations.find(c => c.id === convId)?.title) {
      await updateTitle(convId, trimmed)
    }
    setEditingId(null)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function updateTitle(convId: string, title: string) {
    try {
      const truncated = title.length > 48 ? title.slice(0, 48) + '…' : title
      const res = await fetch(`${API_URL}/api/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: truncated }),
      })
      const updated: Conversation = await res.json()
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, ...updated } : c))
    } catch (e) {
      console.error('[update title] falhou:', e)
    }
  }

  async function saveMessage(convId: string, role: 'user' | 'assistant', content: string, structured_data?: StructuredData) {
    try {
      await fetch(`${API_URL}/api/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content, structured_data }),
      })
      // Refresh updated_at on the conversation in sidebar
      setConversations(prev => prev.map(c =>
        c.id === convId ? { ...c, updated_at: new Date().toISOString() } : c
      ))
    } catch (e) {
      console.error('[save message] falhou:', e)
    }
  }

  // ── Send message ─────────────────────────────────────────────────────────────

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return

    const isFirstMessage = messages.length === 0

    // Create conversation on-the-fly if none selected
    let convId = activeId
    if (!convId) {
      try {
        const res = await fetch(`${API_URL}/api/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repName, title: text.slice(0, 48) }),
        })
        const conv: Conversation = await res.json()
        setConversations(prev => [conv, ...prev])
        setActiveId(conv.id)
        convId = conv.id
      } catch (e) {
        console.error('[auto-create conversation] falhou:', e)
        return
      }
    }

    // Title = first user message
    if (isFirstMessage) updateTitle(convId, text)

    const userMsg: Message = { role: 'user', content: text.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    // Persist user message immediately
    saveMessage(convId, 'user', text.trim())

    // Build history for API
    const historyBase = newMessages.slice(-10).map(m => ({ role: m.role, content: m.content }))

    // Inject greeting context on first message of a new conversation
    const greet = saudacao()
    const historyToSend = isFirstMessage
      ? [
          {
            role: 'user' as const,
            content: `[Contexto de sessão — não exibir ao usuário: você está atendendo o representante ${repName}. Horário: ${greet.toLowerCase()}. Inicie sua resposta cumprimentando-o pelo primeiro nome de forma natural, ex: "${greet}, ${firstName}!" antes de responder.]`,
          },
          { role: 'assistant' as const, content: 'Entendido!' },
          ...historyBase.slice(0, -1),
        ]
      : historyBase.slice(0, -1)

    let assistantAdded = false
    let finalAssistantContent = ''
    let finalStructuredData: StructuredData | undefined

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), history: historyToSend }),
      })

      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') break

          try {
            const parsed = JSON.parse(raw) as {
              text?: string; error?: string; detail?: string; structured_data?: StructuredData
            }

            if (parsed.text) {
              finalAssistantContent += parsed.text
              if (!assistantAdded) {
                assistantAdded = true
                setIsStreaming(true)
                setMessages(prev => [...prev, { role: 'assistant', content: parsed.text! }])
              } else {
                setMessages(prev => {
                  const u = [...prev]
                  const last = u[u.length - 1]
                  if (last?.role === 'assistant') u[u.length - 1] = { ...last, content: last.content + parsed.text }
                  return u
                })
              }
            }

            if (parsed.structured_data) {
              finalStructuredData = parsed.structured_data
              setMessages(prev => {
                const u = [...prev]
                const last = u[u.length - 1]
                if (last?.role === 'assistant') u[u.length - 1] = { ...last, structured_data: parsed.structured_data }
                return u
              })
            }

            if (parsed.error) {
              const errMsg = parsed.error === 'billing'
                ? `⚠️ ${parsed.detail}`
                : 'Desculpe, ocorreu um erro. Verifique se a API está rodando.'
              finalAssistantContent = errMsg
              if (!assistantAdded) {
                assistantAdded = true
                setMessages(prev => [...prev, { role: 'assistant', content: errMsg }])
              } else {
                setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: errMsg }; return u })
              }
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch {
      const errMsg = 'Desculpe, ocorreu um erro. Verifique se a API está rodando.'
      finalAssistantContent = errMsg
      if (!assistantAdded) {
        setMessages(prev => [...prev, { role: 'assistant', content: errMsg }])
      } else {
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: errMsg }; return u })
      }
    } finally {
      setLoading(false)
      setIsStreaming(false)
      // Persist assistant message after stream completes
      if (finalAssistantContent) {
        saveMessage(convId!, 'assistant', finalAssistantContent, finalStructuredData)
      }
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const isEmpty = messages.length === 0

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside
        aria-label="Histórico de conversas"
        style={{
          width: 256, minWidth: 256,
          background: 'var(--color-bg)',
          borderRight: '1px solid rgba(59,91,219,0.10)',
          display: 'flex', flexDirection: 'column',
          height: '100%',
          padding: '14px 0 16px',
        }}
      >
        {/* Nova conversa — botão minimalista */}
        <div style={{ padding: '0 10px 14px' }}>
          <button
            type="button"
            onClick={newConversation}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 9,
              padding: '8px 10px',
              background: 'transparent',
              border: 'none', borderRadius: 8, cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13,
              color: 'var(--color-text-secondary)',
              transition: 'all 150ms ease', outline: 'none',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--color-accent-dim)'
              e.currentTarget.style.color = 'var(--color-accent)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--color-text-secondary)'
            }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: 6,
              border: '1.5px solid currentColor',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <IconPlus />
            </span>
            Nova conversa
          </button>
        </div>

        {/* Separador sutil */}
        <div style={{ height: 1, background: 'var(--color-border)', margin: '0 12px 12px', opacity: 0.6 }} aria-hidden="true" />

        {/* Label recentes */}
        <div style={{ padding: '0 14px 6px' }}>
          <span style={{
            fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
            fontFamily: 'var(--font-body)', fontWeight: 600,
            color: 'var(--color-text-muted)',
          }}>
            Recentes
          </span>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {convLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
              <div role="status" aria-label="Carregando conversas..." style={{
                width: 16, height: 16,
                border: '2px solid var(--color-border)',
                borderTopColor: 'var(--color-accent)',
                borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              }} />
            </div>
          ) : conversations.length === 0 ? (
            <p style={{ padding: '8px 6px', fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', lineHeight: 1.6, margin: 0 }}>
              Nenhuma conversa ainda.
            </p>
          ) : (
            conversations.map(conv => {
              const isActive = conv.id === activeId
              const isHovered = conv.id === hoveredConvId
              const isEditing = editingId === conv.id
              return (
                <div
                  key={conv.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isActive}
                  aria-label={`Conversa: ${conv.title}`}
                  onClick={() => { if (!isEditing) switchConversation(conv.id) }}
                  onKeyDown={e => { if (!isEditing && (e.key === 'Enter' || e.key === ' ')) switchConversation(conv.id) }}
                  onMouseEnter={() => setHoveredConvId(conv.id)}
                  onMouseLeave={() => setHoveredConvId(null)}
                  style={{
                    padding: '7px 10px', cursor: isEditing ? 'default' : 'pointer',
                    background: isActive ? 'rgba(59,91,219,0.09)' : isHovered ? 'rgba(59,91,219,0.04)' : 'transparent',
                    borderRadius: 8, marginBottom: 1,
                    transition: 'background 120ms ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                  }}
                >
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      value={editingTitle}
                      onChange={e => setEditingTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); commitEdit(conv.id) }
                        if (e.key === 'Escape') cancelEdit()
                        e.stopPropagation()
                      }}
                      onBlur={() => commitEdit(conv.id)}
                      onClick={e => e.stopPropagation()}
                      aria-label="Editar título da conversa"
                      style={{
                        flex: 1, minWidth: 0,
                        border: 'none', borderBottom: '1.5px solid var(--color-accent)',
                        outline: 'none', background: 'transparent',
                        fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
                        color: 'var(--color-accent)',
                        padding: '1px 0',
                      }}
                    />
                  ) : (
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p
                        style={{
                          margin: 0, fontFamily: 'var(--font-body)', fontSize: 13,
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? 'var(--color-accent)' : 'var(--color-text-primary)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.4,
                        }}
                        onDoubleClick={e => startEditing(e, conv)}
                        title="Duplo clique para renomear"
                      >
                        {conv.title}
                      </p>
                      <p style={{ margin: '1px 0 0', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)' }}>
                        {formatTime(conv.updated_at)}
                      </p>
                    </div>
                  )}
                  {isHovered && !isEditing && (
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={e => startEditing(e, conv)}
                        aria-label="Renomear conversa"
                        title="Renomear"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--color-text-muted)', padding: '3px 4px',
                          borderRadius: 5, lineHeight: 1,
                          transition: 'color 120ms ease', outline: 'none',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-accent)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                      >
                        <IconPencil />
                      </button>
                      <button
                        type="button"
                        onClick={e => deleteConversation(e, conv.id)}
                        aria-label="Excluir conversa"
                        title="Excluir conversa"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--color-text-muted)', padding: '3px 4px',
                          borderRadius: 5, lineHeight: 1,
                          transition: 'color 120ms ease', outline: 'none',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </aside>

      {/* ── Área de chat ──────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>

        {/* Scroll full-width → scrollbar na borda direita da tela */}
        <div
          role="log"
          aria-live="polite"
          aria-label="Histórico de mensagens"
          style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}
        >
          {/* Conteúdo centrado */}
          <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 24px 8px' }}>
            {msgLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
                <div role="status" aria-label="Carregando mensagens..." style={{
                  width: 20, height: 20,
                  border: '2px solid var(--color-border)',
                  borderTopColor: 'var(--color-accent)',
                  borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                }} />
              </div>
            ) : isEmpty ? (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                minHeight: 320, gap: 8, animation: 'fadeUp 0.35s ease',
              }}>
                <div aria-hidden="true" style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: 'var(--color-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: 26, color: 'white',
                  marginBottom: 16,
                }}>G</div>
                <p style={{ fontFamily: 'var(--font-title)', fontSize: 22, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                  {saudacao()}, {firstName}!
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-secondary)', margin: 0 }}>
                  Como posso ajudar com sua carteira hoje?
                </p>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <MessageBubble
                    key={i}
                    msg={msg}
                    showCursor={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
                  />
                ))}
                {loading && !isStreaming && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16, gap: 10 }}>
                    <AssistantAvatar />
                    <div role="status" aria-label="Processando..." style={{
                      padding: '10px 16px', borderRadius: '12px 12px 12px 2px',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      {[0, 1, 2].map(idx => (
                        <span key={idx} aria-hidden="true" style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: 'var(--color-text-muted)', display: 'inline-block',
                          animation: 'bounce 1s ease infinite', animationDelay: `${idx * 150}ms`,
                        }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </>
            )}
          </div>
        </div>

        {/* Chips + Input — rodapé centrado, fora do scroll */}
        <div style={{ maxWidth: 760, margin: '0 auto', width: '100%', padding: '8px 24px 20px' }}>

          {/* Chips de sugestão */}
          {!loading && (
            <div
              role="group"
              aria-label="Sugestões rápidas"
              style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}
            >
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => sendMessage(s)}
                  style={{
                    padding: '5px 13px',
                    borderRadius: 20,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    fontSize: 12, fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer', outline: 'none',
                    transition: 'all 150ms ease',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--color-accent)'
                    e.currentTarget.style.color = 'var(--color-accent)'
                    e.currentTarget.style.background = 'var(--color-accent-dim)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--color-border)'
                    e.currentTarget.style.color = 'var(--color-text-secondary)'
                    e.currentTarget.style.background = 'var(--color-surface)'
                  }}
                >{s}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 12, padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 2px 8px rgba(59,91,219,0.06)',
          }}>
            <label htmlFor="chat-input" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
              Mensagem para Galton AI
            </label>
            <textarea
              id="chat-input"
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua pergunta…"
              rows={1}
              style={{
                flex: 1, resize: 'none', border: 'none', outline: 'none',
                fontSize: 14, fontFamily: 'var(--font-body)',
                color: 'var(--color-text-primary)', background: 'transparent',
                lineHeight: 1.5, maxHeight: 120,
                padding: 0, margin: 0, display: 'block',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span aria-hidden="true" style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>Enter ↵</span>
              <button
                type="button"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                aria-label="Enviar mensagem"
                style={{
                  padding: '8px 16px', background: 'var(--color-accent)', color: 'white',
                  border: 'none', borderRadius: 8,
                  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13,
                  cursor: 'pointer', transition: 'background 150ms ease',
                  opacity: (!input.trim() || loading) ? 0.4 : 1, outline: 'none',
                }}
                onMouseEnter={e => { if (input.trim() && !loading) e.currentTarget.style.background = 'var(--color-accent-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-accent)' }}
              >Enviar</button>
            </div>
          </div>{/* fim input */}
        </div>{/* fim rodapé centrado */}
      </div>
    </div>
  )
}
