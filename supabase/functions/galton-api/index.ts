import { corsHeaders, json, parseApiPath } from "./lib/http.ts"
import { handleAuthLogin } from "./handlers/auth.ts"
import { handleAlerts } from "./handlers/alerts.ts"
import { handleDashboardSummary } from "./handlers/dashboard.ts"
import {
  handleMetricsCreate,
  handleMetricsDelete,
  handleMetricsList,
  handleMetricsPatch,
  handleMetricsPreview,
} from "./handlers/metrics.ts"
import { handleRepresentativesList } from "./handlers/representatives.ts"
import {
  handleConversationsCreate,
  handleConversationsDelete,
  handleConversationsList,
  handleConversationsPatch,
  handleMessagesCreate,
  handleMessagesList,
} from "./handlers/conversations.ts"
import { handleChat } from "./handlers/chat.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() })
  }

  const url = new URL(req.url)
  const path = parseApiPath(url.pathname)
  const method = req.method

  try {
    if (path === "/api/health" && method === "GET") {
      return json({ status: "ok", service: "Galton AI API (Supabase Edge)" })
    }

    if (path === "/api/auth/login" && method === "POST") {
      return await handleAuthLogin(req)
    }

    if (path === "/api/alerts" && method === "GET") {
      return await handleAlerts(req)
    }

    if (path === "/api/dashboard-summary" && method === "GET") {
      return await handleDashboardSummary(req)
    }

    if (path === "/api/metrics/preview" && method === "POST") {
      return await handleMetricsPreview(req)
    }

    if (path === "/api/metrics" && method === "GET") {
      return await handleMetricsList()
    }

    if (path === "/api/metrics" && method === "POST") {
      return await handleMetricsCreate(req)
    }

    const metricsIdMatch = path.match(/^\/api\/metrics\/([^/]+)$/)
    if (metricsIdMatch) {
      const id = metricsIdMatch[1]!
      if (method === "PATCH") return await handleMetricsPatch(req, id)
      if (method === "DELETE") return await handleMetricsDelete(id)
    }

    if (path === "/api/representatives" && method === "GET") {
      return await handleRepresentativesList()
    }

    const convMessagesMatch = path.match(/^\/api\/conversations\/([^/]+)\/messages$/)
    if (convMessagesMatch) {
      const id = convMessagesMatch[1]!
      if (method === "GET") return await handleMessagesList(id)
      if (method === "POST") return await handleMessagesCreate(req, id)
    }

    const convIdMatch = path.match(/^\/api\/conversations\/([^/]+)$/)
    if (convIdMatch) {
      const id = convIdMatch[1]!
      if (method === "PATCH") return await handleConversationsPatch(req, id)
      if (method === "DELETE") return await handleConversationsDelete(id)
    }

    if (path === "/api/conversations" && method === "GET") {
      return await handleConversationsList(req)
    }

    if (path === "/api/conversations" && method === "POST") {
      return await handleConversationsCreate(req)
    }

    if (path === "/api/chat" && method === "POST") {
      return await handleChat(req)
    }

    return json({ error: "Not found", path }, 404)
  } catch (err) {
    console.error("[galton-api]", err)
    return json({ error: "Internal error", detail: String(err) }, 500)
  }
})
