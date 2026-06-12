/**
 * MCP tool definitions for the ATRAY API.
 * Each tool maps directly to an x-mcp-enabled endpoint in openapi.yaml.
 *
 * Schema convention:
 *   inputSchema follows JSON Schema (Draft 7) - the MCP SDK validates inputs before calling handler.
 *   All IDs are UUID strings. All dates are ISO-8601.
 */

export const tools = [
  // ─── BRAND ────────────────────────────────────────────────────────────────

  {
    name: 'getBrandProfile',
    description: "Returns the authenticated user's brand profile: name, description, target audience, tone of voice and CTA default.",
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'updateBrandProfile',
    description: "Updates the brand profile. Only send the fields you want to change.",
    inputSchema: {
      type: 'object',
      properties: {
        name:            { type: 'string', description: 'Brand/company name' },
        description:     { type: 'string', description: 'Business description' },
        target_audience: { type: 'string', description: 'Target audience' },
        tone:            { type: 'string', enum: ['professional', 'friendly', 'direct', 'premium'], description: 'Tone of voice' },
        cta_default:     { type: 'string', description: 'Default call-to-action text for posts' },
      },
    },
  },

  // ─── CAMPAIGNS ────────────────────────────────────────────────────────────

  {
    name: 'listCampaigns',
    description: 'Lists the user\'s campaigns with optional filters. Returns items array and total count.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['active', 'generating', 'archived'], description: 'Filter by status' },
        q:      { type: 'string', description: 'Search by name or theme' },
        sort:   { type: 'string', enum: ['name', 'theme', 'created_at', 'status', 'posts_count'], description: 'Sort field (default: created_at)' },
        order:  { type: 'string', enum: ['asc', 'desc'], description: 'Sort direction (default: desc)' },
        limit:  { type: 'integer', minimum: 1, maximum: 100, description: 'Results per page (default: 20)' },
        offset: { type: 'integer', minimum: 0, description: 'Pagination offset (default: 0)' },
      },
    },
  },

  {
    name: 'createCampaign',
    description: 'Creates a new campaign and automatically generates posts via AI (1 credit per post). Requires a completed brand profile. Returns the created campaign.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name:         { type: 'string', maxLength: 255, description: 'Campaign name (required)' },
        objective:    { type: 'string', enum: ['awareness', 'engagement', 'sales', 'traffic', 'leads'], description: 'Campaign objective' },
        theme:        { type: 'string', description: 'Central theme or subject of the campaign' },
        context_text: { type: 'string', description: 'Context or brief for AI content generation (min 20 chars)' },
        start_date:   { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        end_date:     { type: 'string', description: 'End date (YYYY-MM-DD)' },
        frequency:    { type: 'integer', description: 'Posts per week' },
        post_time:    { type: 'string', description: 'Preferred publish time (HH:MM)' },
        cta_text:     { type: 'string', description: 'Call-to-action text' },
        cta_link:     { type: 'string', description: 'Call-to-action URL' },
        hashtags:     { type: 'array', items: { type: 'string' }, description: 'Hashtags (without #)' },
      },
    },
  },

  {
    name: 'getCampaign',
    description: 'Returns a single campaign by ID.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Campaign UUID' },
      },
    },
  },

  {
    name: 'updateCampaign',
    description: 'Updates a campaign. Only send the fields you want to change.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:           { type: 'string', description: 'Campaign UUID' },
        name:         { type: 'string', maxLength: 255 },
        status:       { type: 'string', enum: ['active', 'generating', 'archived'] },
        objective:    { type: 'string', enum: ['awareness', 'engagement', 'sales', 'traffic', 'leads'] },
        theme:        { type: 'string' },
        context_text: { type: 'string', description: 'Min 20 chars' },
        start_date:   { type: 'string', description: 'YYYY-MM-DD' },
        end_date:     { type: 'string', description: 'YYYY-MM-DD' },
        frequency:    { type: 'integer' },
        post_time:    { type: 'string', description: 'HH:MM' },
        cta_text:     { type: 'string' },
        cta_link:     { type: 'string' },
      },
    },
  },

  {
    name: 'listCampaignPosts',
    description: 'Lists all posts belonging to a specific campaign with optional filters.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:     { type: 'string', description: 'Campaign UUID' },
        status: { type: 'string', enum: ['draft', 'scheduled', 'published'], description: 'Filter by post status' },
        sort:   { type: 'string', enum: ['scheduled_at', 'created_at', 'status'], description: 'Sort field (default: scheduled_at)' },
        order:  { type: 'string', enum: ['asc', 'desc'] },
        limit:  { type: 'integer', minimum: 1, maximum: 100, description: 'Default: 20' },
        offset: { type: 'integer', minimum: 0, description: 'Default: 0' },
      },
    },
  },

  // ─── POSTS ────────────────────────────────────────────────────────────────

  {
    name: 'listPosts',
    description: 'Lists posts with optional filters. Use campaign_id to filter by campaign, or the string "null" to list standalone posts (not linked to any campaign). Without campaign_id returns all posts.',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign UUID to filter, or the literal string "null" for standalone posts' },
        status:      { type: 'string', enum: ['draft', 'scheduled', 'published'] },
        sort:        { type: 'string', enum: ['scheduled_at', 'created_at', 'status'], description: 'Default: scheduled_at' },
        order:       { type: 'string', enum: ['asc', 'desc'] },
        limit:       { type: 'integer', minimum: 1, maximum: 100, description: 'Default: 20' },
        offset:      { type: 'integer', minimum: 0, description: 'Default: 0' },
      },
    },
  },

  {
    name: 'createPost',
    description: 'Creates a standalone post draft. Use type="carousel" with image_descriptions[] (3-6 items) for a carousel post. Default type="text" uses image_description for a single image.',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id:        { type: 'string', description: 'Campaign UUID to link to (optional)' },
        type:               { type: 'string', enum: ['text', 'carousel'], description: 'Post type (default: text)' },
        caption_text:       { type: 'string', description: 'Post caption text' },
        cta:                { type: 'string', description: 'Call-to-action text (e.g. "Link in bio")' },
        hashtags:           { type: 'array', items: { type: 'string' }, description: 'Hashtags (without #)' },
        image_description:  { type: 'string', description: 'Image description for single-image posts (type=text)' },
        image_descriptions: { type: 'array', items: { type: 'string' }, description: 'Image description per slide for carousel posts (type=carousel, 3-6 items)' },
        context:            { type: 'string', description: 'Context/brief for AI text generation (required for standalone posts)' },
        image_text_enabled: { type: 'boolean', description: 'Include text overlay in generated image (default: true)' },
        image_logo_enabled: { type: 'boolean', description: 'Include brand logo in generated image (default: true)' },
      },
    },
  },

  {
    name: 'getPost',
    description: 'Returns a single post by ID, including media history and scheduling info.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Post UUID' },
      },
    },
  },

  {
    name: 'updatePost',
    description: 'Updates a post. Only send the fields you want to change. Supports updating caption, CTA, hashtags, image description, context and image generation settings.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:                 { type: 'string', description: 'Post UUID' },
        caption_text:       { type: 'string' },
        cta:                { type: 'string' },
        hashtags:           { type: 'array', items: { type: 'string' } },
        image_description:  { type: 'string', description: 'Image description for single-image posts' },
        image_descriptions: { type: 'array', items: { type: 'string' }, description: 'Image descriptions per slide for carousel posts (3-6 items)' },
        context:            { type: 'string', description: 'Context/brief for AI text generation' },
        status:             { type: 'string', enum: ['draft', 'scheduled', 'published'] },
        scheduled_at:       { type: 'string', description: 'Publish datetime (ISO-8601, must be in the future)' },
        image_text_enabled: { type: 'boolean' },
        image_logo_enabled: { type: 'boolean' },
      },
    },
  },

  {
    name: 'regeneratePostText',
    description: 'Regenerates the post caption and hashtags using AI. For standalone posts (no campaign), context must be filled in the post.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Post UUID' },
      },
    },
  },

  {
    name: 'regeneratePostImage',
    description: 'Generates a new image for the post using AI. For carousel posts, regenerates all slides or a specific slide via slot_index. From the 6th generation onwards, an extra credit is charged - confirm with confirm_extra_content: true.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:                    { type: 'string', description: 'Post UUID' },
        confirm_extra_content: { type: 'boolean', description: 'Set true to confirm extra credit charge (6th+ generation)' },
        slot_index:            { type: 'integer', minimum: 0, maximum: 5, description: 'Carousel slide index to regenerate (omit to regenerate all slides)' },
      },
    },
  },

  {
    name: 'uploadPostVideo',
    description: 'Uploads a video (mp4, mov or webm; up to 120 MB) as the post media, replacing the current image/video. Provide either file_path (local file) or video_url (public URL to download from). When the post is published to Instagram, videos are posted as Reels (also shared to the feed). Scheduling works the same as image posts.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:        { type: 'string', description: 'Post UUID' },
        file_path: { type: 'string', description: 'Absolute path to a local video file (mp4, mov, webm)' },
        video_url: { type: 'string', description: 'Public URL of the video to download and upload' },
      },
    },
  },

  // ─── API KEYS ─────────────────────────────────────────────────────────────

  {
    name: 'listApiKeys',
    description: "Lists the user's active (non-revoked) API keys. The full key is never returned after creation.",
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'createApiKey',
    description: 'Creates a new API key. The full key (atray_...) is returned ONLY in this response - save it immediately. Limit: 10 keys per user.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', maxLength: 100, description: 'Descriptive name for the key' },
      },
    },
  },

  {
    name: 'updateApiKey',
    description: 'Updates the name and/or active status of an API key. Inactive keys are rejected at authentication.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:        { type: 'string', description: 'API key UUID' },
        name:      { type: 'string', maxLength: 100, description: 'New name for the key' },
        is_active: { type: 'boolean', description: 'Activate or deactivate the key' },
      },
    },
  },

  {
    name: 'revokeApiKey',
    description: 'Permanently revokes an API key. This action cannot be undone.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'API key UUID' },
      },
    },
  },
];
