#!/usr/bin/env node
/**
 * Entrypoint HTTP (Streamable HTTP) do MCP da ATRAY - mcp.atray.app.
 *
 * Serve para clientes que não rodam processo local, como o modo desenvolvedor do ChatGPT,
 * que só aceita URL HTTPS. As tools e o dispatch são exatamente os de src/server.js: este
 * arquivo é só transporte + contenção de acesso.
 *
 * ── Autenticação da FASE 1 (temporária) ────────────────────────────────────────────────
 * A ATRAY_API_KEY fica SÓ no servidor (env) - nunca no cliente. Como a URL é pública na
 * internet e o modo desenvolvedor do ChatGPT permite "sem autenticação", o que separa o mundo
 * do endpoint é um segredo longo no PATH (MCP_HTTP_PATH_SECRET), tratado como credencial:
 * fora do git, fora de log, revogável trocando a env. Qualquer path sem o segredo responde
 * 404 (não 401), para não sinalizar que existe algo aqui. Rate limit por IP em cima disso.
 *
 * Isso é contenção, não modelo de autorização: o modelo definitivo é o OAuth 2.1 da fase 2
 * (authorize/token/PKCE/DCR + /.well-known/oauth-protected-resource).
 */

import { createServer as createHttpServer } from 'node:http';
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

import { createServer, VERSION } from './server.js';

const PORT = Number(process.env.PORT || 3002);
const HOST = process.env.MCP_HTTP_HOST || '0.0.0.0';

/** Segredos de path aceitos. Vírgula separa: permite rotacionar sem derrubar o cliente antigo. */
const PATH_SECRETS = (process.env.MCP_HTTP_PATH_SECRET || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const MIN_SECRET_LEN = 24;

/** Janela e teto do rate limit por IP (a janela deslizante é simples: contador por bucket). */
const RATE_WINDOW_MS = Number(process.env.MCP_HTTP_RATE_WINDOW_MS || 60_000);
const RATE_MAX = Number(process.env.MCP_HTTP_RATE_MAX || 120);

/** Teto do corpo da requisição. Payload de tool é pequeno (IDs e URLs), não mídia. */
const MAX_BODY_BYTES = Number(process.env.MCP_HTTP_MAX_BODY_BYTES || 4 * 1024 * 1024);

/** Sessão sem nenhuma requisição por este tempo é encerrada (evita vazar transporte). */
const SESSION_IDLE_MS = Number(process.env.MCP_HTTP_SESSION_IDLE_MS || 30 * 60_000);

if (PATH_SECRETS.length === 0) {
  console.error('[atray-mcp-http] MCP_HTTP_PATH_SECRET ausente - o servidor não sobe sem ele.');
  console.error('[atray-mcp-http] Gere um com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"');
  process.exit(1);
}
if (PATH_SECRETS.some((s) => s.length < MIN_SECRET_LEN)) {
  console.error(`[atray-mcp-http] MCP_HTTP_PATH_SECRET curto demais (mínimo ${MIN_SECRET_LEN} caracteres).`);
  process.exit(1);
}
if (!process.env.ATRAY_API_KEY) {
  console.error('[atray-mcp-http] AVISO: ATRAY_API_KEY não definida - toda tool vai falhar com 401 da API.');
}

const sha256 = (s) => createHash('sha256').update(s).digest();

/** Comparação em tempo constante sobre o digest (comprimento fixo, não vaza o tamanho do segredo). */
function matchesSecret(candidate) {
  const c = sha256(candidate);
  let ok = false;
  for (const secret of PATH_SECRETS) {
    if (timingSafeEqual(c, sha256(secret))) ok = true;
  }
  return ok;
}

/**
 * IP do cliente. Só o Caddy fala com este processo e ele ANEXA o peer real ao final do
 * X-Forwarded-For, então o último elemento é o único confiável (o cliente pode forjar o resto).
 */
function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const parts = String(xff).split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.socket?.remoteAddress || 'unknown';
}

const rateBuckets = new Map(); // ip -> { count, resetAt }

function rateLimited(ip) {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return null;
  }
  bucket.count += 1;
  if (bucket.count > RATE_MAX) return Math.ceil((bucket.resetAt - now) / 1000);
  return null;
}

const sessions = new Map(); // sessionId -> { transport, server, lastSeen }

function touchSession(id) {
  const s = sessions.get(id);
  if (s) s.lastSeen = Date.now();
}

const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.lastSeen > SESSION_IDLE_MS) {
      sessions.delete(id);
      s.transport.close().catch(() => {});
      log(`sessão ${short(id)} encerrada por inatividade`);
    }
  }
  for (const [ip, bucket] of rateBuckets) {
    if (now >= bucket.resetAt) rateBuckets.delete(ip);
  }
}, 60_000);
sweeper.unref?.();

const short = (id) => (id ? String(id).slice(0, 8) : '-');
const log = (msg) => console.log(`[atray-mcp-http] ${msg}`);

function jsonRpcError(res, status, code, message) {
  const body = JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null });
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(body);
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found\n');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('payload too large'), { tooLarge: true }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve(undefined);
      try { resolve(JSON.parse(raw)); } catch { reject(Object.assign(new Error('invalid JSON'), { badJson: true })); }
    });
    req.on('error', reject);
  });
}

/** Sessão nova (POST initialize): transporte com sessionId, guardado no mapa. */
async function openSession() {
  const server = createServer({ localFiles: false });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      sessions.set(sessionId, { transport, server, lastSeen: Date.now() });
      log(`sessão ${short(sessionId)} aberta (${sessions.size} ativa(s))`);
    },
    onsessionclosed: (sessionId) => {
      sessions.delete(sessionId);
      log(`sessão ${short(sessionId)} encerrada pelo cliente`);
    },
  });
  transport.onclose = () => {
    if (transport.sessionId) sessions.delete(transport.sessionId);
  };
  await server.connect(transport);
  return transport;
}

/**
 * Requisição sem sessão que não é initialize: em vez de recusar, atende sem estado (transporte
 * descartável). Cliente que não devolve o header mcp-session-id continua funcionando.
 */
async function handleStateless(req, res, body) {
  const server = createServer({ localFiles: false });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}

const httpServer = createHttpServer(async (req, res) => {
  const ip = clientIp(req);
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';

  // Health interno: docker healthcheck e probes rodam de dentro. O Caddy não expõe esta rota.
  if (path === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ ok: true, service: 'atray-mcp-http', version: VERSION, sessions: sessions.size }));
    return;
  }

  // Rate limit ANTES do segredo: é o que torna caro varrer o path atrás dele.
  const retryAfter = rateLimited(ip);
  if (retryAfter !== null) {
    log(`429 ip=${ip}`);
    res.writeHead(429, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': String(retryAfter) })
      .end('Too Many Requests\n');
    return;
  }

  const m = path.match(/^\/mcp\/([^/]+)$/);
  if (!m || !matchesSecret(decodeURIComponent(m[1]))) {
    notFound(res);
    return;
  }

  const sessionId = req.headers['mcp-session-id'];
  const known = sessionId ? sessions.get(String(sessionId)) : undefined;
  // Nunca logar o path: ele contém a credencial.
  const trace = `${req.method} /mcp/*** sid=${short(sessionId)} ip=${ip}`;

  try {
    if (req.method === 'POST') {
      let body;
      try {
        body = await readBody(req);
      } catch (err) {
        if (err.tooLarge) return jsonRpcError(res, 413, -32600, 'Request body too large');
        if (err.badJson) return jsonRpcError(res, 400, -32700, 'Parse error');
        throw err;
      }

      if (known) {
        touchSession(String(sessionId));
        await known.transport.handleRequest(req, res, body);
      } else if (sessionId) {
        // Sessão desconhecida (servidor reiniciou): 404 é o que manda o cliente reinicializar.
        log(`${trace} -> sessão desconhecida, pedindo re-initialize`);
        jsonRpcError(res, 404, -32001, 'Session not found: re-initialize');
      } else if (isInitializeRequest(body)) {
        const transport = await openSession();
        await transport.handleRequest(req, res, body);
      } else {
        await handleStateless(req, res, body);
      }
      return;
    }

    if (req.method === 'GET' || req.method === 'DELETE') {
      if (!known) {
        // Sem sessão não há stream de notificações nem o que encerrar.
        res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST' })
          .end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed without an active session' }, id: null }));
        return;
      }
      touchSession(String(sessionId));
      await known.transport.handleRequest(req, res);
      return;
    }

    res.writeHead(405, { Allow: 'POST, GET, DELETE' }).end();
  } catch (err) {
    console.error(`[atray-mcp-http] erro em ${trace}: ${err.message}`);
    if (!res.headersSent) jsonRpcError(res, 500, -32603, 'Internal server error');
    else res.end();
  }
});

httpServer.listen(PORT, HOST, () => {
  log(`v${VERSION} ouvindo em ${HOST}:${PORT} - rota POST/GET/DELETE /mcp/<segredo> (${PATH_SECRETS.length} segredo(s) aceito(s))`);
});

async function shutdown(signal) {
  log(`${signal} recebido - encerrando ${sessions.size} sessão(ões)...`);
  clearInterval(sweeper);
  for (const [, s] of sessions) await s.transport.close().catch(() => {});
  sessions.clear();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { httpServer };
