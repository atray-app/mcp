/**
 * T-924 - o servidor remoto no modo OAuth, multi-tenant.
 *
 * Sobe o src/http.js de verdade contra uma api falsa que implementa `/oauth/tokeninfo`, e fala
 * MCP com ele por HTTP. É o caminho exato do ChatGPT/Claude, só sem o TLS do Caddy na frente.
 *
 * O TESTE QUE IMPORTA MAIS é o de isolamento: dois tokens de usuários diferentes, e o que chega
 * na api tem que ser o token de QUEM chamou. Se um dia alguém devolver a credencial para o
 * escopo de módulo (era assim até a fase 1), é aqui que quebra.
 */

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';

/** Tokens da api falsa: quem é o dono e o que pode. */
const TOKENS = {
  mcp_at_alice_full: { sub: 'user-alice', scope: 'mcp:read mcp:write mcp:generate mcp:publish mcp:messages', client_name: 'Cliente da Alice' },
  mcp_at_bruno_read: { sub: 'user-bruno', scope: 'mcp:read', client_name: 'Cliente do Bruno' },
};

async function freePort() {
  const s = createServer();
  s.listen(0, '127.0.0.1');
  await once(s, 'listening');
  const { port } = s.address();
  await new Promise((r) => s.close(r));
  return port;
}

/** api falsa: /oauth/tokeninfo de verdade, e o resto ecoa quem chamou. */
async function startFakeApi() {
  const calls = [];
  const server = createServer((req, res) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

    if (req.url.startsWith('/oauth/tokeninfo')) {
      const info = TOKENS[token];
      if (!info) {
        res.writeHead(401, { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer error="invalid_token"' });
        return res.end(JSON.stringify({ active: false }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ active: true, ...info, client_id: 'atc_x' }));
    }

    calls.push({ method: req.method, url: req.url, token });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    // A resposta identifica o dono: é o que prova, do lado do cliente MCP, que a conta certa
    // respondeu - e não só que a api recebeu o header certo.
    res.end(JSON.stringify({ items: [{ id: 'c1', owner: TOKENS[token]?.sub || 'desconhecido' }], total: 1 }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { url: `http://127.0.0.1:${server.address().port}`, calls, close: () => server.close() };
}

async function startHttpServer(env = {}) {
  const port = await freePort();
  const child = spawn(process.execPath, ['src/http.js'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: {
      ...process.env,
      PORT: String(port),
      MCP_HTTP_HOST: '127.0.0.1',
      MCP_HTTP_PATH_SECRET: '',
      MCP_OAUTH_ENABLED: 'true',
      MCP_HTTP_RATE_MAX: '500',
      MCP_RESOURCE_URL: 'https://mcp.atray.app',
      MCP_OAUTH_ISSUER: 'https://api.atray.app',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  child.stdout.on('data', (d) => logs.push(String(d)));
  child.stderr.on('data', (d) => logs.push(String(d)));

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (logs.join('').includes('ouvindo')) break;
    if (child.exitCode !== null) throw new Error(`http.js morreu: ${logs.join('')}`);
    await new Promise((r) => setTimeout(r, 50));
  }
  return { port, child, logs, base: `http://127.0.0.1:${port}` };
}

/** O transporte responde em SSE por padrão: extrai o JSON do primeiro evento `data:`. */
async function readRpc(res) {
  const text = await res.text();
  if ((res.headers.get('content-type') || '').includes('application/json')) return JSON.parse(text);
  const line = text.split('\n').find((l) => l.startsWith('data:'));
  assert.ok(line, `resposta sem evento data: ${text}`);
  return JSON.parse(line.slice(5).trim());
}

const BASE_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
const withToken = (token, extra = {}) => ({ ...BASE_HEADERS, Authorization: `Bearer ${token}`, ...extra });

const INITIALIZE = {
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } },
};

/** Abre sessão com um token e devolve o mcp-session-id. */
async function openSession(base, token) {
  const res = await fetch(`${base}/mcp`, { method: 'POST', headers: withToken(token), body: JSON.stringify(INITIALIZE) });
  assert.equal(res.status, 200, `initialize devolveu ${res.status}`);
  const sid = res.headers.get('mcp-session-id');
  await res.text();
  await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: withToken(token, { 'mcp-session-id': sid }),
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  });
  return sid;
}

let api;
let srv;

before(async () => {
  api = await startFakeApi();
  srv = await startHttpServer({ ATRAY_API_URL: api.url });
});

after(() => {
  srv?.child.kill();
  api?.close();
});

test('sem Authorization: 401 com WWW-Authenticate apontando o resource metadata', async () => {
  // É este 401 que faz um cliente DESCONHECIDO achar o caminho sozinho. Sem o
  // `resource_metadata` ele só sabe que falhou, e alguém precisa configurar na mão.
  const res = await fetch(`${srv.base}/mcp`, { method: 'POST', headers: BASE_HEADERS, body: '{}' });
  assert.equal(res.status, 401);
  const challenge = res.headers.get('www-authenticate') || '';
  assert.match(challenge, /^Bearer /);
  assert.match(challenge, /resource_metadata="https:\/\/mcp\.atray\.app\/\.well-known\/oauth-protected-resource"/);
  await res.text();
});

test('protected resource metadata (RFC 9728) responde nos dois caminhos', async () => {
  for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp']) {
    const res = await fetch(srv.base + path);
    assert.equal(res.status, 200, `${path} devolveu ${res.status}`);
    const body = await res.json();
    assert.equal(body.resource, 'https://mcp.atray.app');
    assert.deepEqual(body.authorization_servers, ['https://api.atray.app']);
    assert.ok(body.scopes_supported.includes('mcp:read'));
    // Cliente que roda em navegador precisa poder ler isto.
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
  }
});

test('token desconhecido: 401, não 403 e não 500', async () => {
  const res = await fetch(`${srv.base}/mcp`, {
    method: 'POST', headers: withToken('mcp_at_inventado'), body: JSON.stringify(INITIALIZE),
  });
  assert.equal(res.status, 401);
  await res.text();
});

test('token válido abre sessão e lista tools', async () => {
  const sid = await openSession(srv.base, 'mcp_at_alice_full');
  assert.ok(sid, 'sem mcp-session-id');
  const res = await fetch(`${srv.base}/mcp`, {
    method: 'POST',
    headers: withToken('mcp_at_alice_full', { 'mcp-session-id': sid }),
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
  });
  const body = await readRpc(res);
  assert.ok(body.result.tools.length >= 40, `poucas tools: ${body.result.tools.length}`);
  assert.ok(body.result.tools.every((t) => !t.inputSchema?.properties?.file_path), 'file_path exposto no remoto');
});

test('escopo filtra o tools/list: quem só tem leitura não vê publicar nem gerar', async () => {
  const sid = await openSession(srv.base, 'mcp_at_bruno_read');
  const res = await fetch(`${srv.base}/mcp`, {
    method: 'POST',
    headers: withToken('mcp_at_bruno_read', { 'mcp-session-id': sid }),
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
  });
  const names = (await readRpc(res)).result.tools.map((t) => t.name);
  assert.ok(names.includes('listCampaigns'), 'sumiu tool de leitura');
  for (const escondida of ['schedulePost', 'createCampaign', 'sendCrmMessage', 'createPost', 'deletePost']) {
    assert.ok(!names.includes(escondida), `${escondida} não podia aparecer com escopo só de leitura`);
  }
});

test('escopo insuficiente no tools/call devolve erro explicando o que falta', async () => {
  const sid = await openSession(srv.base, 'mcp_at_bruno_read');
  const res = await fetch(`${srv.base}/mcp`, {
    method: 'POST',
    headers: withToken('mcp_at_bruno_read', { 'mcp-session-id': sid }),
    body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'schedulePost', arguments: { id: 'x' } } }),
  });
  const body = await readRpc(res);
  assert.equal(body.result.isError, true);
  assert.match(body.result.content[0].text, /mcp:publish/);
});

test('ISOLAMENTO: cada sessão fala com a api usando o token de quem chamou', async () => {
  const sidAlice = await openSession(srv.base, 'mcp_at_alice_full');
  const sidBruno = await openSession(srv.base, 'mcp_at_bruno_read');
  assert.notEqual(sidAlice, sidBruno);

  const call = (sid, token) => fetch(`${srv.base}/mcp`, {
    method: 'POST',
    headers: withToken(token, { 'mcp-session-id': sid }),
    body: JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'listCampaigns', arguments: {} } }),
  }).then(readRpc);

  // Intercaladas de propósito: se a credencial voltasse a viver no escopo de módulo, é aqui
  // que uma sobrescreveria a outra.
  const [a1, b1, a2] = await Promise.all([
    call(sidAlice, 'mcp_at_alice_full'),
    call(sidBruno, 'mcp_at_bruno_read'),
    call(sidAlice, 'mcp_at_alice_full'),
  ]);

  assert.match(a1.result.content[0].text, /user-alice/);
  assert.match(a2.result.content[0].text, /user-alice/);
  assert.match(b1.result.content[0].text, /user-bruno/);

  const recentes = api.calls.filter((c) => c.url === '/campaigns').slice(-3).map((c) => c.token);
  assert.equal(recentes.filter((t) => t === 'mcp_at_alice_full').length, 2);
  assert.equal(recentes.filter((t) => t === 'mcp_at_bruno_read').length, 1);
});

test('ISOLAMENTO: sessão de um token não pode ser usada com outro token', async () => {
  // Sem isto, o mcp-session-id seria uma credencial paralela: quem o interceptasse falaria com
  // a conta do dono da sessão sem apresentar token nenhum dela.
  const sidAlice = await openSession(srv.base, 'mcp_at_alice_full');
  const res = await fetch(`${srv.base}/mcp`, {
    method: 'POST',
    headers: withToken('mcp_at_bruno_read', { 'mcp-session-id': sidAlice }),
    body: JSON.stringify({ jsonrpc: '2.0', id: 8, method: 'tools/list' }),
  });
  assert.equal(res.status, 404, 'sessão de outro token foi aceita');
  const body = await res.json();
  assert.match(body.error.message, /re-initialize/);
});

test('nenhum token aparece no log do servidor', () => {
  const log = srv.logs.join('');
  for (const token of Object.keys(TOKENS)) {
    assert.ok(!log.includes(token), `o token ${token.slice(0, 12)}... vazou para o log`);
  }
});

test('api de autorização fora do ar vira 503, nunca 401', async () => {
  // 401 aqui faria o cliente jogar fora um refresh token perfeitamente bom e pedir
  // reautorização ao usuário por causa de um soluço nosso.
  const morta = await startHttpServer({ ATRAY_API_URL: 'http://127.0.0.1:1' });
  try {
    const res = await fetch(`${morta.base}/mcp`, {
      method: 'POST', headers: withToken('mcp_at_alice_full'), body: JSON.stringify(INITIALIZE),
    });
    assert.equal(res.status, 503);
    await res.text();
  } finally {
    morta.child.kill();
  }
});
