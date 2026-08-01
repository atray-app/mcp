# ATRAY MCP

[![npm version](https://img.shields.io/npm/v/@atray/mcp.svg)](https://www.npmjs.com/package/@atray/mcp)

MCP (Model Context Protocol) server for the [ATRAY](https://atray.app) API. Lets an AI
assistant (Claude, Claude Code, Cursor, and any other MCP client) manage your ATRAY
campaigns, posts, and brand profile in natural language.

> ATRAY is a SaaS that creates Instagram content with AI: you describe your brand, the AI
> generates posts (image, caption, hashtags), and ATRAY schedules and publishes them for you.

## Requirements

- Node.js >= 18
- An ATRAY account and an **API key**. Generate one in the Studio under
  **Settings → Tools** (`https://studio.atray.app`). The key (`atray_...`) is shown only
  once on creation, so store it safely.

## Quick start

### Claude Code (CLI), one command

```bash
claude mcp add atray -e ATRAY_API_KEY=atray_your_key -- npx -y @atray/mcp
```

### Manual config (Claude Desktop, Cursor, and others)

Add this to your client's MCP config (in Claude Desktop, `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "atray": {
      "command": "npx",
      "args": ["-y", "@atray/mcp"],
      "env": { "ATRAY_API_KEY": "atray_your_key" }
    }
  }
}
```

Restart the client and the ATRAY tools become available.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ATRAY_API_KEY` | yes | - | Your ATRAY API key (`atray_...`). |
| `ATRAY_API_URL` | no | `https://api.atray.app` | Override the API base URL (for self-hosted / staging). |

The remote (HTTP) transport reads a few more - see [Remote transport](#remote-transport-http).

## Tools

| Tool | What it does |
|---|---|
| `getBrandProfile` / `updateBrandProfile` | View and update the brand profile. |
| `listCampaigns` / `createCampaign` / `getCampaign` / `updateCampaign` | Manage campaigns. `createCampaign` generates posts with AI (1 content credit per post). `updateCampaign` takes `social_connection_ids` (array) to change the accounts the campaign publishes to - it replaces the whole list, so send all of them. |
| `listCampaignPosts` | List posts of a campaign. |
| `listPosts` / `createPost` / `getPost` / `updatePost` | Manage posts (text and carousel). On a standalone post, `updatePost` accepts `social_connection_id` to set the publish target up front, so `schedulePost` no longer needs it. Campaign posts reject it - their target comes from the campaign. |
| `regeneratePostText` / `regeneratePostImage` | Regenerate caption or image with AI. |
| `uploadPostVideo` | Upload a video (mp4/mov/webm, up to 120 MB) as the post media; published to Instagram as a Reel. |
| `listSocialConnections` | List your connected social accounts (read-only) to pick a publish target. |
| `schedulePost` | Schedule/publish a post (omit `scheduled_at` to publish as soon as possible). |
| `listCrmContacts` / `createCrmContact` / `getCrmContact` / `updateCrmContact` / `importCrmContacts` | Manage CRM contacts (import from CSV, tags, custom fields). |
| `listCrmLabels` | List contact labels (segments). |
| `listCrmOffers` / `createCrmOffer` / `updateCrmOffer` | Manage the offers the AI agent can quote and send a payment link for. |
| `listCrmPipelines` / `getCrmPipelineBoard` | View sales pipelines and their kanban board. |
| `listCrmDeals` / `createCrmDeal` / `getCrmDeal` / `updateCrmDeal` / `moveCrmDealStage` | Manage deals and move them across pipeline stages. |
| `listCrmConversations` / `getCrmConversationMessages` | Read the WhatsApp inbox (conversations and message history). |
| `sendCrmMessage` | Send a WhatsApp message as a human attendant (pauses the AI agent on that conversation - human takeover). |
| `listCrmAgents` / `createCrmAgent` / `updateCrmAgent` | Create, view and configure the AI agents that answer WhatsApp and Instagram conversations. Use `connection_ids` (array) to attach one agent to several connections - it replaces all links, so send the full list. `social_connection_id` is legacy (single connection). |
| `listCrmAutomations` / `createCrmAutomation` / `updateCrmAutomation` | Manage CRM automations (birthday, inactivity, follow-up, keyword and deal-stage triggers). |
| `listCrmSequences` / `enrollContactInSequence` | Manage follow-up sequences and enroll contacts. |
| `getCrmDashboardOverview` | CRM KPIs: contacts, conversations, deal funnel, AI agent replies/escalations. |
| `getBillingUsage` | Current-month usage and quota per module: posts, publicacoes and atendimentos (CRM AI conversations). |

Each AI-generated post consumes 1 content credit from your plan. Creating a campaign
requires a completed brand profile. `sendCrmMessage` is the only tool that reaches a real
customer directly - review the text before calling it, since it is not reversible.

> API keys are created and managed in the Studio (**Settings → Tools**), not through
> the API/MCP.

Every tool carries MCP `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`,
`openWorldHint`) so a client can decide what to confirm before calling. `deletePost`,
`schedulePost` (publishes for real), `sendCrmMessage` and `enrollContactInSequence` are the
irreversible ones.

## Remote transport (HTTP)

Besides stdio, the server speaks **Streamable HTTP** (`src/http.js`), for clients that cannot
run a local process - for example a remotely hosted connector. Tools and dispatch are shared
with the stdio entrypoint (`src/server.js`); only the transport differs.

```bash
MCP_HTTP_PATH_SECRET=$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=') \
ATRAY_API_KEY=atray_your_key npm run start:http
# POST/GET/DELETE http://localhost:3002/mcp/<MCP_HTTP_PATH_SECRET>
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `MCP_HTTP_PATH_SECRET` | yes | - | Secret segment in the route (`/mcp/<secret>`). Comma-separated values are all accepted, which is how you rotate it. Minimum 24 chars; the server refuses to start without it. |
| `PORT` | no | `3002` | Listen port. |
| `MCP_HTTP_HOST` | no | `0.0.0.0` | Listen address. |
| `MCP_HTTP_RATE_MAX` | no | `120` | Requests per IP per window. |
| `MCP_HTTP_RATE_WINDOW_MS` | no | `60000` | Rate-limit window. |
| `MCP_HTTP_SESSION_IDLE_MS` | no | `1800000` | Idle time before a session is dropped. |
| `MCP_HTTP_MAX_BODY_BYTES` | no | `4194304` | Request body cap. |

Security model of this phase, in short:

- the ATRAY API key lives **only on the server**; the client never sends or sees it, and every
  call acts on that key's account;
- the secret in the path is the credential. Any other path answers `404` (not `401`), so the
  endpoint does not announce itself; requests are rate limited per IP; the secret is never
  logged;
- `file_path` (local file upload) is **not** exposed over HTTP - on a remote server that path
  would be the server's own disk. Use `image_url` / `video_url` instead;
- put TLS and a reverse proxy in front. This is containment, not authorization: proper OAuth
  is the next step.

## API reference

Full interactive REST reference (Swagger): <https://api.atray.app/docs/>

## Local development

```bash
git clone https://github.com/atray-app/mcp.git
cd mcp
npm install
npm test
ATRAY_API_KEY=atray_your_key npm start
```

`npm start` speaks MCP over stdio; `npm run start:http` speaks Streamable HTTP.

## Links

- Website: <https://atray.app>
- Documentation: <https://atray.app/docs.html>
- Issues: <https://github.com/atray-app/mcp/issues>

## License

MIT
