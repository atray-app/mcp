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
  **Settings → API keys** (`https://studio.atray.app`). The key (`atray_...`) is shown only
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

## Tools

| Tool | What it does |
|---|---|
| `getBrandProfile` / `updateBrandProfile` | View and update the brand profile. |
| `listCampaigns` / `createCampaign` / `getCampaign` / `updateCampaign` | Manage campaigns. `createCampaign` generates posts with AI (1 content credit per post). |
| `listCampaignPosts` | List posts of a campaign. |
| `listPosts` / `createPost` / `getPost` / `updatePost` | Manage posts (text and carousel). |
| `regeneratePostText` / `regeneratePostImage` | Regenerate caption or image with AI. |
| `uploadPostVideo` | Upload a video (mp4/mov/webm, up to 120 MB) as the post media; published to Instagram as a Reel. |
| `listSocialConnections` | List your connected social accounts (read-only) to pick a publish target. |
| `schedulePost` | Schedule/publish a post (omit `scheduled_at` to publish as soon as possible). |
| `listCrmContacts` / `createCrmContact` / `getCrmContact` / `updateCrmContact` / `importCrmContacts` | Manage CRM contacts (import from CSV, tags, custom fields). |
| `listCrmLists` | List contact lists (segments). |
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

> API keys are created and managed in the Studio (**Settings → API keys**), not through
> the API/MCP.

## API reference

Full interactive REST reference (Swagger): <https://api.atray.app/docs/>

## Local development

```bash
git clone https://github.com/atray-app/mcp.git
cd mcp
npm install
ATRAY_API_KEY=atray_your_key npm start
```

The server speaks MCP over stdio.

## Links

- Website: <https://atray.app>
- Documentation: <https://atray.app/docs.html>
- Issues: <https://github.com/atray-app/mcp/issues>

## License

MIT
