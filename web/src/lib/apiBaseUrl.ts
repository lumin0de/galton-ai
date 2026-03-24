/**
 * URL base da API Galton (Edge Function `galton-api` no Supabase).
 *
 * 1. `VITE_API_URL` — URL completa se quiseres override (ex.: outro ambiente).
 * 2. `VITE_SUPABASE_URL` — URL do projeto (ex.: https://abc.supabase.co);
 *    a app usa automaticamente `{url}/functions/v1/galton-api`.
 * 3. Vazio — em dev, o proxy do Vite pode encaminhar `/api` para localhost (legado).
 */
export function getApiBaseUrl(): string {
  const explicit = import.meta.env.VITE_API_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  const supabase = import.meta.env.VITE_SUPABASE_URL?.trim()
  if (supabase) {
    const base = supabase.replace(/\/$/, '')
    return `${base}/functions/v1/galton-api`
  }

  return ''
}
