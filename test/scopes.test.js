/**
 * T-924 - a régua de escopo vista do lado do cliente MCP.
 *
 * O que este arquivo protege é a REGRA DO PADRÃO: tool nova cai em `mcp:write` sozinha, nunca
 * em leitura. Se o default fosse `mcp:read`, adicionar uma tool que apaga alguma coisa a
 * deixaria acessível a todo mundo que autorizou só leitura - e ninguém perceberia.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { tools } from '../src/tools.js';
import { TOOL_SCOPES, scopeFor, allowedByScope } from '../src/scopes.js';

const CONHECIDOS = new Set(['mcp:read', 'mcp:write', 'mcp:generate', 'mcp:publish', 'mcp:messages']);

test('toda tool tem um escopo conhecido', () => {
  for (const tool of tools) {
    const scope = scopeFor(tool.name);
    assert.ok(CONHECIDOS.has(scope), `${tool.name} caiu no escopo desconhecido ${scope}`);
  }
});

test('TOOL_SCOPES não tem entrada órfã (tool renomeada ou removida)', () => {
  const nomes = new Set(tools.map((t) => t.name));
  for (const nome of Object.keys(TOOL_SCOPES)) {
    assert.ok(nomes.has(nome), `TOOL_SCOPES cita ${nome}, que não é mais uma tool`);
  }
});

test('tool desconhecida cai em escrita, nunca em leitura', () => {
  assert.equal(scopeFor('umaToolQueAindaNaoExiste'), 'mcp:write');
});

test('quem só tem leitura não alcança nada que escreve, gasta ou publica', () => {
  const escrita = tools.filter((t) => scopeFor(t.name) !== 'mcp:read');
  assert.ok(escrita.length > 10, 'lista de escrita suspeita de vazia');
  for (const tool of escrita) {
    assert.equal(allowedByScope(tool.name, 'mcp:read'), false, `${tool.name} passou com só mcp:read`);
  }
});

test('mcp:write não abre gerar, publicar nem mandar mensagem', () => {
  for (const [nome, escopo] of Object.entries(TOOL_SCOPES)) {
    assert.equal(allowedByScope(nome, 'mcp:read mcp:write'), false, `${nome} (${escopo}) passou com read+write`);
    assert.equal(allowedByScope(nome, escopo), true, `${nome} não passou com o próprio escopo`);
  }
});

test('escopo vazio não abre nada', () => {
  for (const tool of tools) {
    assert.equal(allowedByScope(tool.name, ''), false, `${tool.name} passou sem escopo`);
  }
});
