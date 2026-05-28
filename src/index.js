#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { tools } from './tools.js';
import { api } from './api.js';

const server = new Server(
  { name: 'atray-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  try {
    const result = await callTool(name, args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
  }
});

async function callTool(name, a) {
  switch (name) {
    // ─── BRAND ──────────────────────────────────────────────────────────────
    case 'getBrandProfile':
      return api.get('/brand/profile');

    case 'updateBrandProfile':
      return api.put('/brand/profile', a);

    // ─── CAMPAIGNS ──────────────────────────────────────────────────────────
    case 'listCampaigns':
      return api.get('/campaigns', a);

    case 'createCampaign':
      return api.post('/campaigns', a);

    case 'getCampaign': {
      const { id, ...q } = a;
      return api.get(`/campaigns/${id}`, q);
    }

    case 'updateCampaign': {
      const { id, ...body } = a;
      return api.patch(`/campaigns/${id}`, body);
    }

    case 'listCampaignPosts': {
      const { id, ...q } = a;
      return api.get(`/campaigns/${id}/posts`, q);
    }

    // ─── POSTS ──────────────────────────────────────────────────────────────
    case 'listPosts':
      return api.get('/posts', a);

    case 'createPost':
      return api.post('/posts', a);

    case 'getPost':
      return api.get(`/posts/${a.id}`);

    case 'updatePost': {
      const { id, ...body } = a;
      return api.patch(`/posts/${id}`, body);
    }

    case 'regeneratePostText':
      return api.post(`/posts/${a.id}/regenerate-text`);

    case 'regeneratePostImage': {
      const { id, ...body } = a;
      return api.post(`/posts/${id}/regenerate-image`, body);
    }

    // ─── API KEYS ────────────────────────────────────────────────────────────
    case 'listApiKeys':
      return api.get('/api-keys');

    case 'createApiKey':
      return api.post('/api-keys', a);

    case 'updateApiKey': {
      const { id, ...body } = a;
      return api.patch(`/api-keys/${id}`, body);
    }

    case 'revokeApiKey':
      return api.delete(`/api-keys/${a.id}`);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const transport = new StdioServerTransport();
await server.connect(transport);
