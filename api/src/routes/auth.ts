import { Router, Request, Response } from 'express'
import { db as supabase } from '../db/supabase'

const router = Router()

export type UserRole = 'representative' | 'admin'

interface User {
  name: string
  email: string
  role: UserRole
}

// Usuários permitidos (em produção, usar Supabase Auth ou tabela)
const USERS: Record<string, { password: string; name: string; role: UserRole }> = {
  'admin@galton.ai': { password: 'admin123', name: 'Administrador', role: 'admin' },
  'carlos@galton.ai': { password: 'demo123', name: 'Carlos Junior', role: 'representative' },
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string }
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios' })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const user = USERS[normalizedEmail]

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Credenciais inválidas' })
    }

    const response: User = {
      name: user.name,
      email: normalizedEmail,
      role: user.role,
    }

    if (user.role === 'representative') {
      try {
        await supabase.from('rep_login_log').insert({ rep_name: user.name })
      } catch (e) {
        console.warn('[auth] rep_login_log insert failed:', e)
      }
    }

    res.json(response)
  } catch (err) {
    console.error('Auth login error:', err)
    res.status(500).json({ error: 'Erro ao autenticar' })
  }
})

export default router
