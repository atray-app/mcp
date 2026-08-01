import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { tools, ANNOTATIONS } from '../src/tools.js';
import { toolsFor, VERSION } from '../src/server.js';

test('toda tool tem os quatro hints de annotation', () => {
  for (const tool of tools) {
    assert.ok(tool.annotations, `${tool.name} sem annotations`);
    for (const hint of ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint']) {
      assert.equal(typeof tool.annotations[hint], 'boolean', `${tool.name}.${hint} não é boolean`);
    }
  }
});

test('ANNOTATIONS não tem entrada órfã (tool renomeada/removida)', () => {
  const names = new Set(tools.map((t) => t.name));
  for (const name of Object.keys(ANNOTATIONS)) {
    assert.ok(names.has(name), `ANNOTATIONS tem ${name}, que não é tool`);
  }
});

test('tool de leitura é list/get e nenhuma outra se declara read-only', () => {
  for (const tool of tools) {
    const looksReadOnly = /^(list|get)/.test(tool.name);
    assert.equal(
      tool.annotations.readOnlyHint,
      looksReadOnly,
      `${tool.name}: readOnlyHint=${tool.annotations.readOnlyHint} não bate com o nome`
    );
  }
});

test('read-only nunca é destrutiva', () => {
  for (const tool of tools.filter((t) => t.annotations.readOnlyHint)) {
    assert.equal(tool.annotations.destructiveHint, false, `${tool.name} é read-only e destrutiva`);
  }
});

test('o que age no mundo real está marcado destrutivo', () => {
  // Publicar, enviar e apagar não têm desfazer: se algum destes perder o hint, o cliente
  // deixa de pedir confirmação.
  const mustBeDestructive = [
    'deletePost', 'schedulePost', 'sendCrmMessage', 'enrollContactInSequence',
    'regeneratePostText', 'regeneratePostImage', 'uploadPostImage', 'uploadPostVideo',
  ];
  for (const name of mustBeDestructive) {
    const tool = tools.find((t) => t.name === name);
    assert.ok(tool, `${name} sumiu da lista de tools`);
    assert.equal(tool.annotations.destructiveHint, true, `${name} deveria ser destrutiva`);
    assert.equal(tool.annotations.idempotentHint, false, `${name} não é idempotente`);
  }
});

test('nada que gasta crédito se declara idempotente', () => {
  const spendsCredit = ['createCampaign', 'createPost', 'regeneratePostText', 'regeneratePostImage'];
  for (const name of spendsCredit) {
    const tool = tools.find((t) => t.name === name);
    assert.equal(tool.annotations.idempotentHint, false, `${name} gasta crédito a cada chamada`);
    assert.equal(tool.annotations.openWorldHint, true, `${name} chama provedor de IA externo`);
  }
});

test('transporte remoto não expõe file_path (leitura de disco do servidor)', () => {
  const remote = toolsFor({ localFiles: false });
  for (const tool of remote) {
    assert.equal(tool.inputSchema?.properties?.file_path, undefined, `${tool.name} ainda expõe file_path`);
  }
  // e o stdio continua expondo, senão o uso local quebra
  const local = toolsFor({ localFiles: true });
  assert.ok(local.find((t) => t.name === 'uploadPostVideo').inputSchema.properties.file_path);
  assert.equal(local.length, remote.length, 'o filtro não pode sumir com tool nenhuma');
});

test('VERSION bate com a version do package.json', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(VERSION, pkg.version);
});
