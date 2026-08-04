#!/usr/bin/env node
/**
 * Entrypoint stdio (uso local: Claude Desktop, Claude Code, Cursor).
 * Autenticação pela ATRAY_API_KEY do ambiente. O transporte remoto está em src/http.js.
 * A lista de tools e o dispatch vivem em src/server.js, compartilhados pelos dois.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

if (!process.env.ATRAY_API_KEY) {
  process.stderr.write('[atray-mcp] WARNING: ATRAY_API_KEY not set\n');
}

const server = createServer({ localFiles: true });
const transport = new StdioServerTransport();
await server.connect(transport);
