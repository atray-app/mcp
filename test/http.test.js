/**
 * Sobe o src/http.js de verdade (processo filho) contra uma API ATRAY falsa e fala MCP com ele
 * por HTTP. É o mesmo caminho que o ChatGPT percorre - só sem o TLS do Caddy na frente.
 */

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';

const SECRET = 'test-secret-com-mais-de-24-caracteres';

/** Porta livre: abre, lê e devolve. */
async function freePort() {
  const s = createServer();
  s.listen(0, '127.0.0.1');
  await once(s, 'listening');
  const { port } = s.address();
  await new Promise((r) => s.close(r));
  return port;
}

/** API ATRAY falsa: registra o que recebeu e devolve JSON fixo. */
async function startFakeApi() {
  const calls = [];
  const server = createServer((req, res) => {
    calls.push({ method: req.method, url: req.url, auth: req.headers.authorization });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ items: [{ id: 'c1', name: 'Campanha de teste' }], total: 1 }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { url: `http://127.0.0.1:${server.address().port}`, calls, close: () => server.close() };
}

async function startHttpServer(env = {}) {
  const port = await freePort();
  const child = spawn(process.execPath, ['src/http.js'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, PORT: String(port), MCP_HTTP_HOST: '127.0.0.1', MCP_HTTP_PATH_SECRET: SECRET, ...env },
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

const HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };

let api;
let srv;

before(async () => {
  api = await startFakeApi();
  srv = await startHttpServer({ ATRAY_API_URL: api.url, ATRAY_API_KEY: 'fake-key', MCP_HTTP_RATE_MAX: '500' });
});

after(() => {
  srv?.child.kill();
  api?.close();
});

test('rota legada: path sem o segredo responde 404, não 401 (não sinaliza que existe)', async () => {
  // `/mcp` sai desta lista na fase 2: lá o 401 é o contrato, e é ele que ensina a descoberta.
  for (const path of ['/', '/mcp/errado', '/mcp/' + SECRET + 'x']) {
    const res = await fetch(srv.base + path, { method: 'POST', headers: HEADERS, body: '{}' });
    assert.equal(res.status, 404, `${path} deveria ser 404`);
    assert.ok(!res.headers.get('www-authenticate'), `${path} não pode devolver WWW-Authenticate`);
  }
});

test('initialize responde e devolve mcp-session-id', async () => {
  const res = await fetch(`${srv.base}/mcp/${SECRET}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } },
    }),
  });
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('mcp-session-id'), 'sem header mcp-session-id');
  const body = await readRpc(res);
  assert.equal(body.result.serverInfo.name, 'atray-mcp');
  assert.ok(body.result.capabilities.tools);
});

test('tools/list devolve as tools com annotations e sem file_path', async () => {
  const init = await fetch(`${srv.base}/mcp/${SECRET}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } },
    }),
  });
  const sid = init.headers.get('mcp-session-id');
  await init.text();

  await fetch(`${srv.base}/mcp/${SECRET}`, {
    method: 'POST',
    headers: { ...HEADERS, 'mcp-session-id': sid },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  });

  const res = await fetch(`${srv.base}/mcp/${SECRET}`, {
    method: 'POST',
    headers: { ...HEADERS, 'mcp-session-id': sid },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
  });
  const body = await readRpc(res);
  const list = body.result.tools;
  assert.ok(list.length >= 40, `poucas tools: ${list.length}`);
  assert.ok(list.every((t) => t.annotations), 'tool sem annotations no tools/list');
  assert.ok(list.every((t) => !t.inputSchema?.properties?.file_path), 'file_path exposto no transporte remoto');

  // tools/call chega na API com a key do SERVIDOR (o cliente nunca a envia)
  const call = await fetch(`${srv.base}/mcp/${SECRET}`, {
    method: 'POST',
    headers: { ...HEADERS, 'mcp-session-id': sid },
    body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'listCampaigns', arguments: {} } }),
  });
  const callBody = await readRpc(call);
  assert.match(callBody.result.content[0].text, /Campanha de teste/);
  const last = api.calls.at(-1);
  assert.equal(last.url, '/campaigns');
  assert.equal(last.auth, 'Bearer fake-key');

  // DELETE encerra a sessão
  const del = await fetch(`${srv.base}/mcp/${SECRET}`, { method: 'DELETE', headers: { ...HEADERS, 'mcp-session-id': sid } });
  assert.ok(del.status < 300, `DELETE devolveu ${del.status}`);
});

test('cliente que não devolve o session id continua funcionando (fallback sem estado)', async () => {
  const res = await fetch(`${srv.base}/mcp/${SECRET}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/list' }),
  });
  const body = await readRpc(res);
  assert.ok(body.result.tools.length >= 40);
});

test('o segredo nunca aparece no log do servidor', () => {
  assert.ok(!srv.logs.join('').includes(SECRET), 'o segredo do path vazou pro log');
});

test('rate limit por IP devolve 429 com Retry-After', async () => {
  const rl = await startHttpServer({ MCP_HTTP_RATE_MAX: '3', ATRAY_API_URL: api.url, ATRAY_API_KEY: 'fake-key' });
  try {
    const codes = [];
    for (let i = 0; i < 6; i++) {
      const res = await fetch(`${rl.base}/mcp/errado`, { method: 'POST', headers: HEADERS, body: '{}' });
      codes.push(res.status);
      if (res.status === 429) assert.ok(res.headers.get('retry-after'), 'sem Retry-After');
      await res.text();
    }
    assert.deepEqual(codes.slice(0, 3), [404, 404, 404]);
    assert.ok(codes.includes(429), `sem 429 na sequência: ${codes.join(',')}`);
  } finally {
    rl.child.kill();
  }
});

test('sem NENHUM modo de autenticação o servidor se recusa a subir', async () => {
  // Na fase 2 o OAuth sozinho basta para subir (é o modo normal). O que não pode existir é um
  // servidor sem autenticação nenhuma - por isso o teste desliga o OAuth também.
  const child = spawn(process.execPath, ['src/http.js'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, PORT: String(await freePort()), MCP_HTTP_PATH_SECRET: '', MCP_OAUTH_ENABLED: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let err = '';
  child.stderr.on('data', (d) => { err += d; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 1);
  assert.match(err, /autentica/i);
});

test('segredo curto também barra o boot', async () => {
  const child = spawn(process.execPath, ['src/http.js'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, PORT: String(await freePort()), MCP_HTTP_PATH_SECRET: 'curto' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let err = '';
  child.stderr.on('data', (d) => { err += d; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 1);
  assert.match(err, /curto demais/);
});
