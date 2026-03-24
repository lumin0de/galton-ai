import { db } from "../lib/supabase.ts"
import { json } from "../lib/http.ts"

export type UserRole = "representative" | "admin"

interface User {
  name: string
  email: string
  role: UserRole
}

const USERS: Record<string, { password: string; name: string; role: UserRole }> = {
  "admin@galton.ai": { password: "admin123", name: "Administrador", role: "admin" },
  "carlos@galton.ai": { password: "demo123", name: "Carlos Junior", role: "representative" },
}

export async function handleAuthLogin(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { email?: string; password?: string }
    const { email, password } = body
    if (!email || !password) {
      return json({ error: "E-mail e senha são obrigatórios" }, 400)
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const user = USERS[normalizedEmail]

    if (!user || user.password !== password) {
      return json({ error: "Credenciais inválidas" }, 401)
    }

    const response: User = {
      name: user.name,
      email: normalizedEmail,
      role: user.role,
    }

    if (user.role === "representative") {
      try {
        await db().from("rep_login_log").insert({ rep_name: user.name })
      } catch (e) {
        console.warn("[auth] rep_login_log insert failed:", e)
      }
    }

    return json(response)
  } catch (err) {
    console.error("Auth login error:", err)
    return json({ error: "Erro ao autenticar" }, 500)
  }
}
