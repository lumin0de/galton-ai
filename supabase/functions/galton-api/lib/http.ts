export function corsHeaders(): HeadersInit {
  const origin = Deno.env.get("FRONTEND_ORIGIN") ?? "*"
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-requested-with",
    "Access-Control-Max-Age": "86400",
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  })
}

export function text(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { ...corsHeaders(), "Content-Type": "text/plain; charset=utf-8" },
  })
}

export function noContent(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

export function parseApiPath(pathname: string): string {
  const i = pathname.indexOf("/api/")
  if (i >= 0) return pathname.slice(i)
  if (pathname.endsWith("/api")) return "/api"
  return pathname
}
