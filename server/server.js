/* MirageOS 本地服务器：静态文件 + /api/messages 流式代理 + /api/trending 热点抓取
   零依赖，Node 18+。密钥只在本文件读取的 .env 中，绝不下发到前端。
   开机门禁：设置了 GATE_PASSWORD 时，所有 /api/* 需带请求头 x-mirage-key，否则 401；未设置则不设防。
   /api/gate 为公开端点，只回报是否上锁（供锁屏探测，不泄密钥）。 */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { TextDecoder } = require("util");

/* ---- .env（手工解析，避免依赖） ---- */
try {
  const envTxt = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
  for (const line of envTxt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch (e) { /* .env 缺失时沿用环境变量 */ }

const API_BASE = (process.env.API_BASE_URL || "").replace(/\/+$/, "");
const API_KEY = process.env.API_KEY || "";
const MODEL = process.env.MODEL || "claude-opus-5-5";
const EFFORT = process.env.MODEL_REASONING_EFFORT || "";
const GATE_PASSWORD = process.env.GATE_PASSWORD || "";
const PORT = +process.env.PORT || 8787;
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = path.join(__dirname, "..", "web");
const TREND_URL = "https://mshibanami.github.io/GitHubTrendingRSS/daily/all.xml";

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon"
};

function send(res, code, body, type) {
  res.writeHead(code, { "content-type": type || "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(body);
}
function json(res, code, obj) { send(res, code, JSON.stringify(obj)); }

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/* ---- /api/messages：转发到中转站，SSE 原样透传 ---- */
async function proxyMessages(req, res) {
  if (!API_BASE || !API_KEY) return json(res, 500, { error: "server missing API_BASE_URL/API_KEY in .env" });
  let body;
  try { body = JSON.parse(await readBody(req)); } catch (e) { return json(res, 400, { error: "bad json" }); }
  const system = String(body.system || "").slice(0, 60000);
  const messages = (Array.isArray(body.messages) ? body.messages : []).slice(0, 80).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content || "").slice(0, 200000)
  }));
  const max = Math.max(200, Math.min(16000, +body.max || 3500));
  const payload = {
    model: MODEL, max_tokens: max, stream: true,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages
  };
  if (EFFORT) payload.reasoning_effort = EFFORT;
  let up;
  try {
    up = await fetch(API_BASE + "/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(payload)
    });
  } catch (e) { return json(res, 502, { error: "relay unreachable: " + (e.message || e) }); }
  if (up.status !== 200) {
    const t = await up.text().catch(() => "");
    return json(res, up.status, { error: ("relay " + up.status + ": " + t).slice(0, 600) });
  }
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-store", "x-accel-buffering": "no"
  });
  const reader = up.body.getReader();
  const dec = new TextDecoder();
  let raw = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const piece = dec.decode(value, { stream: true });
      res.write(piece);
      if (process.env.MIRAGE_DEBUG) raw += piece;
    }
  } finally {
    res.end();
    if (process.env.MIRAGE_DEBUG && raw) {
      const task = String((messages[0] && messages[0].content) || "").slice(0, 120);
      fs.appendFile(path.join(__dirname, "..", "tmp", "mirage-debug.log"),
        "\n===== " + new Date().toISOString() + " task=" + task.replace(/\n/g, " ") +
        " max=" + max + " =====\n" + raw.slice(0, 30000) + "\n", () => {});
    }
  }
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
    const r = await fetch(TREND_URL, { headers: { "user-agent": "MirageOS/0.1" } });
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

/* ---- http 服务 ---- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://local");
  if (url.pathname.startsWith("/api/")) {
    if (req.method === "GET" && url.pathname === "/api/gate") // 锁屏探测：无需密钥
      return json(res, 200, { locked: !!GATE_PASSWORD });
    if (GATE_PASSWORD && req.headers["x-mirage-key"] !== GATE_PASSWORD) // 门禁：没解锁就不给任何数据
      return json(res, 401, { error: "locked: 门禁未通过" });
    if (req.method === "POST" && url.pathname === "/api/messages") return proxyMessages(req, res);
    if (req.method === "GET" && url.pathname === "/api/trending") return json(res, 200, await trending());
    if (req.method === "GET" && url.pathname === "/api/config")
      return json(res, 200, { model: MODEL, effort: EFFORT || null, relay: API_BASE.replace(/^https?:\/\//, "").split("/")[0] });
    return json(res, 404, { error: "not found" });
  }
  if (req.method === "GET") {
    let p = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    p = path.normalize(p).replace(/^([/\\]+|[.][.][/\\])+/, "");
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT)) return json(res, 403, { error: "forbidden" });
    fs.readFile(file, (e, buf) => {
      if (e) return json(res, 404, { error: "not found" });
      send(res, 200, buf, MIME[path.extname(file).toLowerCase()] || "application/octet-stream");
    });
    return;
  }
  json(res, 405, { error: "method not allowed" });
});
server.listen(PORT, HOST, () => console.log("MirageOS -> http://" + HOST + ":" + PORT + "  model=" + MODEL + "  relay=" + (API_BASE || "(none)")));
