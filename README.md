# ATRAY MCP

[![npm version](https://img.shields.io/npm/v/atray-mcp.svg)](https://www.npmjs.com/package/atray-mcp)

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
claude mcp add atray -e ATRAY_API_KEY=atray_your_key -- npx -y atray-mcp
```

### Manual config (Claude Desktop, Cursor, and others)

Add this to your client's MCP config (in Claude Desktop, `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "atray": {
      "command": "npx",
      "args": ["-y", "atray-mcp"],
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
| `listApiKeys` / `createApiKey` / `updateApiKey` / `revokeApiKey` | Manage your API keys. |

Each AI-generated post consumes 1 content credit from your plan. Creating a campaign
requires a completed brand profile.

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
