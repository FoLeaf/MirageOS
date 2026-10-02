/* MirageOS Cloudflare Worker：静态资源(ASSETS binding) + /api/messages SSE 代理 + /api/trending
   与 server/server.js 行为对等的边缘版本。密钥经 wrangler secret 注入（API_BASE_URL / API_KEY / MODEL），绝不下发前端。
   开机门禁：设置了 GATE_PASSWORD 时，所有 /api/* 需带请求头 x-mirage-key，否则 401；未设置则不设防。
   /api/gate 为公开端点，只回报是否上锁（供锁屏探测，不泄密钥）。 */
"use strict";

const TREND_URL = "https://mshibanami.github.io/GitHubTrendingRSS/daily/all.xml";

function json(body, code = 200) {
  return new Response(JSON.stringify(body), {
    status: code,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/* ---- 门禁：设置了 GATE_PASSWORD 才上锁；未设置则放行 ---- */
function gateOK(request, env) {
  const pw = String(env.GATE_PASSWORD || "");
  return !pw || request.headers.get("x-mirage-key") === pw;
}

/* ---- /api/messages：转发到中转站，SSE 流式透传 ---- */
async function proxyMessages(request, env) {
  const apiBase = (env.API_BASE_URL || "").replace(/\/+$/, "");
  const apiKey = env.API_KEY || "";
  if (!apiBase || !apiKey) return json({ error: "worker missing API_BASE_URL/API_KEY secrets" }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const system = String(body.system || "").slice(0, 60000);
  const messages = (Array.isArray(body.messages) ? body.messages : []).slice(0, 80).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content || "").slice(0, 200000),
  }));
  const max = Math.max(200, Math.min(16000, +body.max || 3500));
  const payload = {
    model: env.MODEL || "claude-opus-5-5",
    max_tokens: max,
    stream: true,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages,
  };
  const effort = String(env.MODEL_REASONING_EFFORT || "").trim().toLowerCase();
  if (effort) payload.reasoning_effort = effort;

  let up;
  try {
    up = await fetch(apiBase + "/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return json({ error: "relay unreachable: " + (e.message || e) }, 502);
  }
  if (up.status !== 200) {
    const t = await up.text().catch(() => "");
    return json({ error: ("relay " + up.status + ": " + t).slice(0, 600) }, up.status);
  }
  return new Response(up.body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}

/* ---- /api/trending：GitHub Trending RSS，内存缓存 1 小时，失败降级为空 ---- */
let trendCache = { ts: 0, data: null };
function decodeXml(s) {
  return String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
async function trending() {
  if (trendCache.data && Date.now() - trendCache.ts < 3600e3) return trendCache.data;
  const out = { signals: [], source: "github-trending-daily", fetchedAt: new Date().toISOString() };
  try {
    const r = await fetch(TREND_URL, { headers: { "user-agent": "MirageOS/0.1" }, cf: { cacheTtl: 1800 } });
    if (r.ok) {
      const xml = await r.text();
      for (const it of xml.split(/<item>/).slice(1)) { // RSS 2.0：<item><title>…</title><description>…</description>
        const t = (it.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
        if (!t) continue;
        const c = (it.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || "";
        const desc = decodeXml(c).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
        out.signals.push({ repo: decodeXml(t).trim(), desc });
        if (out.signals.length >= 12) break;
      }
    }
  } catch (e) { out.error = String(e.message || e); }
  trendCache = { ts: Date.now(), data: out };
  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      if (request.method === "GET" && url.pathname === "/api/gate") // 锁屏探测：无需密钥
        return json({ locked: !!String(env.GATE_PASSWORD || "") });
      if (!gateOK(request, env)) return json({ error: "locked: 门禁未通过" }, 401);
      if (request.method === "POST" && url.pathname === "/api/messages") return proxyMessages(request, env);
      if (request.method === "GET" && url.pathname === "/api/trending") return json(await trending());
      if (request.method === "GET" && url.pathname === "/api/config") {
        const apiBase = (env.API_BASE_URL || "").replace(/\/+$/, "");
        return json({ model: env.MODEL || "claude-opus-5-5", effort: String(env.MODEL_REASONING_EFFORT || "").trim().toLowerCase() || null, relay: apiBase.replace(/^https?:\/\//, "").split("/")[0] });
      }
      return json({ error: "not found" }, 404);
    }
    if (request.method === "GET") return env.ASSETS.fetch(request);
    return json({ error: "method not allowed" }, 405);
  },
};
