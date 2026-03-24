/**
 * API Galton = Edge Function `galton-api` neste projeto Supabase.
 * Valor fixo no código (sem VITE_* / .env para a URL da API).
 */
const SUPABASE_PROJECT_URL = 'https://pzwefecmqkktcybeuohm.supabase.co'

export function getApiBaseUrl(): string {
  const base = SUPABASE_PROJECT_URL.replace(/\/$/, '')
  return `${base}/functions/v1/galton-api`
}
