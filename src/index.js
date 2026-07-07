#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { tools } from './tools.js';
import { api } from './api.js';

const server = new Server(
  { name: 'atray-mcp', version: '1.0.8' },
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
      return api.put(`/campaigns/${id}`, body);
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
      return api.put(`/posts/${id}`, body);
    }

    case 'deletePost':
      return api.delete(`/posts/${a.id}`);

    case 'regeneratePostText':
      return api.post(`/posts/${a.id}/regenerate-text`);

    case 'regeneratePostImage': {
      const { id, ...body } = a;
      return api.post(`/posts/${id}/regenerate-image`, body);
    }

    case 'uploadPostImage':
      return uploadPostImage(a);

    case 'uploadPostVideo':
      return uploadPostVideo(a);

    // ─── SOCIAL CONNECTIONS (read-only) ───────────────────────────────────────
    case 'listSocialConnections':
      return api.get('/social-connections');

    // ─── PUBLISH / SCHEDULE ───────────────────────────────────────────────────
    case 'schedulePost': {
      const { id, ...body } = a;
      return api.post(`/posts/${id}/schedule`, body);
    }

    // ─── CRM ──────────────────────────────────────────────────────────────────
    case 'listCrmContacts':
      return api.get('/crm/contacts', a);

    case 'getCrmContact':
      return api.get(`/crm/contacts/${a.id}`);

    case 'createCrmContact':
      return api.post('/crm/contacts', a);

    case 'updateCrmContact': {
      const { id, ...body } = a;
      return api.put(`/crm/contacts/${id}`, body);
    }

    case 'importCrmContacts':
      return api.post('/crm/contacts/import', a);

    case 'listCrmLists':
      return api.get('/crm/lists');

    case 'listCrmPipelines':
      return api.get('/crm/pipelines');

    case 'getCrmPipelineBoard':
      return api.get(`/crm/pipelines/${a.id}/board`);

    case 'listCrmDeals':
      return api.get('/crm/deals', a);

    case 'createCrmDeal':
      return api.post('/crm/deals', a);

    case 'updateCrmDeal': {
      const { id, ...body } = a;
      return api.put(`/crm/deals/${id}`, body);
    }

    case 'moveCrmDealStage':
      return api.put(`/crm/deals/${a.id}/stage`, { stage_id: a.stage_id });

    case 'listCrmConversations':
      return api.get('/crm/conversations', a);

    case 'getCrmConversationMessages': {
      const { id, ...q } = a;
      return api.get(`/crm/conversations/${id}/messages`, q);
    }

    case 'sendCrmMessage':
      return api.post(`/crm/conversations/${a.id}/messages`, { text: a.text });

    case 'getCrmDashboardOverview':
      return api.get('/crm/dashboard/overview', a);

    case 'listCrmAutomations':
      return api.get('/crm/automations');

    case 'createCrmAutomation':
      return api.post('/crm/automations', a);

    case 'updateCrmAutomation': {
      const { id, ...body } = a;
      return api.put(`/crm/automations/${id}`, body);
    }

    case 'listCrmAgents':
      return api.get('/crm/agents');

    case 'updateCrmAgent': {
      const { id, ...body } = a;
      return api.put(`/crm/agents/${id}`, body);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const IMAGE_MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

async function uploadPostImage({ id, file_path, image_url, slot_index }) {
  if (!id) throw new Error('id (post UUID) is required');
  if (!file_path && !image_url) throw new Error('Provide file_path (local file) or image_url (public URL)');

  let buffer;
  let filename;
  if (file_path) {
    buffer = await readFile(file_path);
    filename = basename(file_path);
  } else {
    const res = await fetch(image_url);
    if (!res.ok) throw new Error(`Failed to download image_url: HTTP ${res.status}`);
    buffer = Buffer.from(await res.arrayBuffer());
    filename = basename(new URL(image_url).pathname) || 'image.jpg';
    if (!/\.(jpg|jpeg|png|webp)$/i.test(filename)) {
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const ext = Object.keys(IMAGE_MIME).find((k) => IMAGE_MIME[k] === ct.split(';')[0].trim());
      if (ext) filename = 'image.' + ext;
    }
  }

  const m = filename.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/);
  if (!m) throw new Error('Image must be .jpg, .jpeg, .png or .webp');

  const base64 = buffer.toString('base64');
  const ext = m[1] === 'jpg' ? 'jpeg' : m[1];
  const body = { image: `data:image/${ext};base64,${base64}`, filename };
  if (slot_index != null) body.slot_index = Number(slot_index);
  return api.post(`/posts/${id}/image`, body);
}

const VIDEO_MIME = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };
const VIDEO_MAX_BYTES = 120 * 1024 * 1024;

/** Sobe um vídeo (arquivo local ou URL) como mídia do post. Publicado no Instagram vira Reel. */
async function uploadPostVideo({ id, file_path, video_url }) {
  if (!id) throw new Error('id (post UUID) is required');
  if (!file_path && !video_url) throw new Error('Provide file_path (local file) or video_url (public URL)');

  let buffer;
  let filename;
  if (file_path) {
    buffer = await readFile(file_path);
    filename = basename(file_path);
  } else {
    const res = await fetch(video_url);
    if (!res.ok) throw new Error(`Failed to download video_url: HTTP ${res.status}`);
    buffer = Buffer.from(await res.arrayBuffer());
    filename = basename(new URL(video_url).pathname) || 'video.mp4';
    if (!/\.(mp4|mov|webm)$/i.test(filename)) {
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const ext = Object.keys(VIDEO_MIME).find((k) => VIDEO_MIME[k] === ct.split(';')[0].trim());
      if (ext) filename = 'video.' + ext;
    }
  }

  const m = filename.toLowerCase().match(/\.(mp4|mov|webm)$/);
  if (!m) throw new Error('Video must be .mp4, .mov or .webm');
  if (buffer.length > VIDEO_MAX_BYTES) throw new Error('Video exceeds the 120 MB limit');

  return api.upload(`/posts/${id}/video`, {
    field: 'video',
    buffer,
    filename,
    contentType: VIDEO_MIME[m[1]],
  });
}

const transport = new StdioServerTransport();
await server.connect(transport);
