#!/usr/bin/env node
/**
 * Entrypoint HTTP (Streamable HTTP) do MCP da ATRAY - mcp.atray.app.
 *
 * ── FASE 2 (T-924): OAuth 2.1, multi-tenant ───────────────────────────────────────────────
 * A fase 1 (T-903) resolveu o transporte com uma API key fixa no servidor: seguro, mas
 * MONO-TENANT - operava uma conta só, e para conectar era preciso alguém preencher env na VM.
 * Agora `POST /mcp` exige `Authorization: Bearer mcp_at_...`, e a CONTA VEM DO TOKEN. Um
 * cliente desconhecido (ChatGPT, Claude, Cursor) chega sem nada, toma 401 com
 * `WWW-Authenticate`, lê `/.well-known/oauth-protected-resource`, acha o authorization server,
 * se registra sozinho (DCR) e manda o usuário autorizar. Ninguém cadastra nada à mão.
 *
 * ── ONDE ISTO PODE VAZAR CONTA DE UM CLIENTE PARA OUTRO ───────────────────────────────────
 * Este é o ponto mais fácil de errar do trabalho inteiro, então está tudo num lugar só:
 *
 *   1. O cliente da API é criado POR REQUISIÇÃO (`createApi({ token })`) e entregue ao
 *      `createServer`. Nada de credencial em variável de módulo - duas requisições simultâneas
 *      se atropelariam entre "trocar a chave global" e o fetch.
 *   2. A sessão do MCP (mcp-session-id) fica AMARRADA ao token que a abriu. Um session id
 *      vazado, apresentado com outro token, é recusado - senão o header viraria uma credencial
 *      paralela, sem escopo e sem revogação.
 *   3. O escopo do token filtra a lista de tools. É conveniência: a autorização de verdade é a
 *      api conferindo o escopo contra o caminho a cada chamada.
 *
 * ── MODO LEGADO (fase 1) ──────────────────────────────────────────────────────────────────
 * A rota `/mcp/<segredo>` continua existindo quando MCP_HTTP_PATH_SECRET e ATRAY_API_KEY estão
 * definidos, para não quebrar quem já tenha configurado. Sem essas envs ela simplesmente não
 * existe e todo path fora do previsto responde 404.
 */

import { createServer as createHttpServer } from 'node:http';
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

import { createServer, VERSION } from './server.js';
import { createApi } from './api.js';

const PORT = Number(process.env.PORT || 3002);
const HOST = process.env.MCP_HTTP_HOST || '0.0.0.0';

/** URL pública deste resource server. Entra nos metadados e no `WWW-Authenticate`. */
const RESOURCE_URL = (process.env.MCP_RESOURCE_URL || 'https://mcp.atray.app').replace(/\/$/, '');
/** Authorization server: a api da ATRAY. */
const ISSUER_URL = (process.env.MCP_OAUTH_ISSUER || 'https://api.atray.app').replace(/\/$/, '');
/** Por onde ESTE processo fala com a api (rede interna do compose, sem sair para a internet). */
const API_URL = (process.env.ATRAY_API_URL || 'https://api.atray.app').replace(/\/$/, '');

const OAUTH_ENABLED = String(process.env.MCP_OAUTH_ENABLED || 'true').toLowerCase() !== 'false';

/** Segredos de path do modo legado. Vírgula separa: permite rotacionar sem derrubar o cliente. */
const PATH_SECRETS = (process.env.MCP_HTTP_PATH_SECRET || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const LEGACY_API_KEY = process.env.ATRAY_API_KEY || '';
const LEGACY_ENABLED = PATH_SECRETS.length > 0 && !!LEGACY_API_KEY;

const MIN_SECRET_LEN = 24;

/** Janela e teto do rate limit por IP (a janela deslizante é simples: contador por bucket). */
const RATE_WINDOW_MS = Number(process.env.MCP_HTTP_RATE_WINDOW_MS || 60_000);
const RATE_MAX = Number(process.env.MCP_HTTP_RATE_MAX || 120);

/** Teto do corpo da requisição. Payload de tool é pequeno (IDs e URLs), não mídia. */
const MAX_BODY_BYTES = Number(process.env.MCP_HTTP_MAX_BODY_BYTES || 4 * 1024 * 1024);

/** Sessão sem nenhuma requisição por este tempo é encerrada (evita vazar transporte). */
const SESSION_IDLE_MS = Number(process.env.MCP_HTTP_SESSION_IDLE_MS || 30 * 60_000);

/** Quanto tempo o resultado do /oauth/tokeninfo vale sem reperguntar. Curto de propósito:
 *  é o atraso máximo entre o usuário clicar em "desconectar" e a sessão parar de listar tools.
 *  A CHAMADA em si nunca usa cache - o token vai junto e a api valida na hora. */
const TOKENINFO_TTL_MS = Number(process.env.MCP_TOKENINFO_TTL_MS || 60_000);

if (PATH_SECRETS.some((s) => s.length < MIN_SECRET_LEN)) {
  console.error(`[atray-mcp-http] MCP_HTTP_PATH_SECRET curto demais (mínimo ${MIN_SECRET_LEN} caracteres).`);
  process.exit(1);
}
if (!OAUTH_ENABLED && !LEGACY_ENABLED) {
  console.error('[atray-mcp-http] Nenhum modo de autenticação ligado: defina MCP_OAUTH_ENABLED=true');
  console.error('[atray-mcp-http] ou MCP_HTTP_PATH_SECRET + ATRAY_API_KEY (modo legado da fase 1).');
  process.exit(1);
}

const sha256 = (s) => createHash('sha256').update(s).digest();
const sha256hex = (s) => createHash('sha256').update(s).digest('hex');

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

const sessions = new Map(); // sessionId -> { transport, server, lastSeen, principal }

function touchSession(id) {
  const s = sessions.get(id);
  if (s) s.lastSeen = Date.now();
}

const tokenInfoCache = new Map(); // sha256(token) -> { info, expiresAt }

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
  for (const [key, entry] of tokenInfoCache) {
    if (now >= entry.expiresAt) tokenInfoCache.delete(key);
  }
}, 60_000);
sweeper.unref?.();

const short = (id) => (id ? String(id).slice(0, 8) : '-');
const log = (msg) => console.log(`[atray-mcp-http] ${msg}`);

function jsonRpcError(res, status, code, message, headers = {}) {
  const body = JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null });
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers }).end(body);
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found\n');
}

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    // Cliente que roda no navegador precisa disto para sequer ler o 401 e achar a descoberta.
    'Access-Control-Allow-Origin': '*',
    ...headers,
  }).end(JSON.stringify(payload));
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

// ── OAuth ───────────────────────────────────────────────────────────────────────────────────

/** RFC 9728. É o documento que o cliente lê depois do 401 para achar onde autorizar. */
function protectedResourceMetadata() {
  return {
    resource: RESOURCE_URL,
    authorization_servers: [ISSUER_URL],
    scopes_supported: ['mcp:read', 'mcp:write', 'mcp:generate', 'mcp:publish', 'mcp:messages'],
    bearer_methods_supported: ['header'],
    resource_documentation: 'https://atray.app/docs',
  };
}

/**
 * O 401 que ENSINA o caminho. Sem o `resource_metadata` aqui, o cliente só sabe que falhou; com
 * ele, descobre o authorization server, se registra e manda o usuário autorizar - sozinho.
 */
function unauthorized(res, description) {
  const challenge =
    `Bearer realm="ATRAY MCP", ` +
    `error="invalid_token", ` +
    `error_description="${String(description).replace(/"/g, "'")}", ` +
    `resource_metadata="${RESOURCE_URL}/.well-known/oauth-protected-resource"`;
  sendJson(res, 401, { error: 'invalid_token', error_description: description }, { 'WWW-Authenticate': challenge });
}

/**
 * Pergunta à api de quem é o token. O resultado fica em cache curto: `tools/list` e `initialize`
 * chegam em rajada e não faz sentido consultar cinco vezes em dois segundos.
 * @returns {Promise<{sub: string, scope: string, clientName: string}|null>}
 */
async function resolveToken(token) {
  const key = sha256hex(token);
  const cached = tokenInfoCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.info;

  let res;
  try {
    res = await fetch(`${API_URL}/oauth/tokeninfo`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch (err) {
    // api fora do ar não é token inválido: quem chama devolve 503, não 401 (401 faria o
    // cliente jogar fora um refresh token perfeitamente bom e pedir reautorização ao usuário).
    const e = new Error('authorization server unreachable');
    e.unreachable = true;
    throw e;
  }
  if (res.status === 401) {
    tokenInfoCache.set(key, { info: null, expiresAt: Date.now() + 5_000 });
    return null;
  }
  if (!res.ok) {
    const e = new Error(`tokeninfo HTTP ${res.status}`);
    e.unreachable = true;
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (!data || data.active !== true) {
    tokenInfoCache.set(key, { info: null, expiresAt: Date.now() + 5_000 });
    return null;
  }
  const info = { sub: String(data.sub), scope: String(data.scope || ''), clientName: String(data.client_name || 'aplicativo') };
  tokenInfoCache.set(key, { info, expiresAt: Date.now() + TOKENINFO_TTL_MS });
  return info;
}

/**
 * Quem está falando nesta requisição. Devolve o "principal": a identidade + o cliente da API já
 * amarrado ao token dela.
 *
 * `key` é o que amarra a SESSÃO ao token. Usa o hash do token, não o id do usuário: dois tokens
 * do mesmo usuário (o ChatGPT e o Claude, por exemplo) não devem compartilhar sessão, porque
 * podem ter escopos diferentes e são revogáveis separadamente.
 */
function principalFromToken(token, info) {
  return {
    key: sha256hex(token),
    sub: info.sub,
    scope: info.scope,
    clientName: info.clientName,
    api: createApi({ token, baseUrl: API_URL }),
  };
}

/** Modo legado da fase 1: a conta é a da env, sempre a mesma, e o escopo é tudo. */
function legacyPrincipal() {
  return {
    key: 'legacy',
    sub: 'legacy',
    scope: null, // null = sem filtro de escopo (é uma API key, que não tem escopo)
    clientName: 'modo legado (path secret)',
    api: createApi({ token: LEGACY_API_KEY, baseUrl: API_URL }),
  };
}

// ── Sessões ─────────────────────────────────────────────────────────────────────────────────

/** Sessão nova (POST initialize): transporte com sessionId, guardado no mapa. */
async function openSession(principal) {
  const server = createServer({ localFiles: false, api: principal.api, scope: principal.scope });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      sessions.set(sessionId, { transport, server, lastSeen: Date.now(), principalKey: principal.key });
      log(`sessão ${short(sessionId)} aberta para ${short(principal.sub)} via ${principal.clientName} (${sessions.size} ativa(s))`);
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
async function handleStateless(req, res, body, principal) {
  const server = createServer({ localFiles: false, api: principal.api, scope: principal.scope });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}

/** O corpo do endpoint MCP, comum aos dois modos de autenticação. */
async function handleMcp(req, res, principal, ip) {
  const sessionId = req.headers['mcp-session-id'];
  const known = sessionId ? sessions.get(String(sessionId)) : undefined;
  const trace = `${req.method} /mcp sid=${short(sessionId)} ip=${ip}`;

  // Sessão pertence ao token que a abriu. Sem isto o mcp-session-id seria uma credencial
  // paralela: quem o interceptasse falaria com a conta do dono da sessão sem token nenhum.
  if (known && known.principalKey !== principal.key) {
    log(`${trace} -> sessão de outro token, recusada`);
    return jsonRpcError(res, 404, -32001, 'Session not found: re-initialize');
  }

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
      const transport = await openSession(principal);
      await transport.handleRequest(req, res, body);
    } else {
      await handleStateless(req, res, body, principal);
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
}

// ── Servidor ────────────────────────────────────────────────────────────────────────────────

const httpServer = createHttpServer(async (req, res) => {
  const ip = clientIp(req);
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';

  // Health interno: docker healthcheck e probes rodam de dentro. O Caddy não expõe esta rota.
  if (path === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ ok: true, service: 'atray-mcp-http', version: VERSION, sessions: sessions.size, oauth: OAUTH_ENABLED }));
    return;
  }

  // Preflight: o 401 e o /mcp precisam ser legíveis por cliente que roda em navegador.
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID',
      'Access-Control-Expose-Headers': 'Mcp-Session-Id, WWW-Authenticate',
      'Access-Control-Max-Age': '86400',
    }).end();
    return;
  }

  // Descoberta (RFC 9728). Pública e sem rate limit apertado: é o primeiro passo de todo
  // cliente novo, e o segundo caminho (`.../mcp`) é o que a especificação do MCP usa quando o
  // endpoint não está na raiz. Servir os dois evita um 404 que trava a conexão inteira.
  if (
    OAUTH_ENABLED &&
    req.method === 'GET' &&
    (path === '/.well-known/oauth-protected-resource' || path === '/.well-known/oauth-protected-resource/mcp')
  ) {
    sendJson(res, 200, protectedResourceMetadata(), { 'Cache-Control': 'public, max-age=300' });
    return;
  }

  // Rate limit ANTES de qualquer autenticação: é o que torna caro varrer atrás de credencial.
  const retryAfter = rateLimited(ip);
  if (retryAfter !== null) {
    log(`429 ip=${ip}`);
    res.writeHead(429, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': String(retryAfter) })
      .end('Too Many Requests\n');
    return;
  }

  try {
    // ── Modo OAuth: POST /mcp com Bearer ──
    if (OAUTH_ENABLED && path === '/mcp') {
      const header = req.headers.authorization || '';
      if (!header.startsWith('Bearer ')) {
        return unauthorized(res, 'Autorização necessária. Conecte sua conta ATRAY.');
      }
      const token = header.slice(7).trim();
      let info;
      try {
        info = await resolveToken(token);
      } catch (err) {
        if (err.unreachable) {
          log(`503 tokeninfo indisponível ip=${ip}: ${err.message}`);
          return sendJson(res, 503, { error: 'temporarily_unavailable', error_description: 'Não foi possível validar a autorização agora.' });
        }
        throw err;
      }
      if (!info) return unauthorized(res, 'Token inválido, expirado ou revogado.');
      await handleMcp(req, res, principalFromToken(token, info), ip);
      return;
    }

    // ── Modo legado (fase 1): /mcp/<segredo> ──
    // 404 e não 401 de propósito: sem o segredo, nada aqui deve anunciar que existe.
    if (LEGACY_ENABLED) {
      const m = path.match(/^\/mcp\/([^/]+)$/);
      if (m && matchesSecret(decodeURIComponent(m[1]))) {
        await handleMcp(req, res, legacyPrincipal(), ip);
        return;
      }
    }

    notFound(res);
  } catch (err) {
    console.error(`[atray-mcp-http] erro em ${req.method} ${path === '/mcp' ? '/mcp' : '/***'} ip=${ip}: ${err.message}`);
    if (!res.headersSent) jsonRpcError(res, 500, -32603, 'Internal server error');
    else res.end();
  }
});

httpServer.listen(PORT, HOST, () => {
  const modos = [
    OAUTH_ENABLED ? `OAuth em POST /mcp (issuer ${ISSUER_URL})` : null,
    LEGACY_ENABLED ? `legado em /mcp/<segredo> (${PATH_SECRETS.length} segredo(s))` : null,
  ].filter(Boolean).join(' + ');
  log(`v${VERSION} ouvindo em ${HOST}:${PORT} - ${modos}`);
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

export { httpServer, protectedResourceMetadata, resolveToken };
