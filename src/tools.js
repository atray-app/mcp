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
    description: "Returns the authenticated user's brand profile (the \"My business\" DNA): business name, segment, city, what it sells, ticket range, differentiator, main products, target audience, audience pains, objections, tone of voice, emoji preference, preferred/forbidden words and brand colors. Also returns server-managed fields logo_path, brand_manual_path and brand_analysis_count.",
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'updateBrandProfile',
    description: "Updates the brand profile (the \"My business\" DNA). Only send the fields you want to change; all are optional. Logo and brand manual are set via their own endpoints and cannot be changed here.",
    inputSchema: {
      type: 'object',
      properties: {
        business_name:    { type: 'string', description: 'Company/brand name' },
        segment:          { type: 'string', description: 'Business segment/industry' },
        city:             { type: 'string', description: 'City where the business operates' },
        what_you_sell:    { type: 'string', description: 'What the brand sells (products/services)' },
        ticket_range:     { type: 'string', description: 'Typical price/ticket range' },
        diferencial:      { type: 'string', description: 'Key differentiator versus competitors' },
        main_products:    { type: 'array', items: { type: 'string' }, description: 'Main products/offers' },
        target_audience:  { type: 'string', description: 'Target audience' },
        audience_pains:   { type: 'array', items: { type: 'string' }, description: 'Audience pains/problems the brand solves' },
        objections:       { type: 'array', items: { type: 'string' }, description: 'Common sales objections' },
        tone:             { type: 'string', enum: ['professional', 'friendly', 'direct', 'premium'], description: 'Tone of voice' },
        use_emojis:       { type: 'boolean', description: 'Whether to use emojis in generated content' },
        preferred_words:  { type: 'array', items: { type: 'string' }, description: 'Preferred words/expressions' },
        forbidden_words:  { type: 'array', items: { type: 'string' }, description: 'Words/expressions to avoid' },
        primary_color:    { type: 'string', description: 'Primary brand color (hex #RRGGBB)' },
        secondary_color:  { type: 'string', description: 'Secondary brand color (hex #RRGGBB)' },
        neutral_color:    { type: 'string', description: 'Neutral brand color (hex #RRGGBB)' },
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
    description: 'Creates a new campaign and automatically generates posts via AI (1 credit per post). Requires a completed brand profile. Post text is generated synchronously, but images are generated asynchronously in a background queue (status="generating") to respect provider rate limits - the response returns immediately without waiting for images. Poll getCampaign or listCampaignPosts to check progress (campaign.generation_progress / post.generation_status transitions pending -> generating -> ready or failed).',
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
    description: 'Creates a standalone post draft. Use type="carousel" with image_descriptions[] (3-6 items) for a carousel post. Default type="text" uses image_description for a single image. Set skip_image_generation=true when you plan to upload your own image with uploadPostImage right after — prevents the AI from generating and overwriting your upload. When image generation runs, it is enqueued and processed asynchronously (post.generation_status: pending -> generating -> ready/failed) - the response returns before the image is ready; poll getPost to check.',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id:            { type: 'string', description: 'Campaign UUID to link to (optional)' },
        type:                   { type: 'string', enum: ['text', 'carousel'], description: 'Post type (default: text)' },
        placement:              { type: 'string', enum: ['feed', 'story'], description: 'Publish destination (default: feed). "story" publishes as an Instagram Story (single media only; not for carousel).' },
        caption_text:           { type: 'string', description: 'Post caption text' },
        cta:                    { type: 'string', description: 'Call-to-action text (e.g. "Link in bio")' },
        hashtags:               { type: 'array', items: { type: 'string' }, description: 'Hashtags (without #)' },
        image_description:      { type: 'string', description: 'Image description for single-image posts (type=text)' },
        image_descriptions:     { type: 'array', items: { type: 'string' }, description: 'Image description per slide for carousel posts (type=carousel, 3-6 items)' },
        context:                { type: 'string', description: 'Context/brief for AI text generation (required for standalone posts)' },
        image_text_enabled:     { type: 'boolean', description: 'Include text overlay in generated image (default: true)' },
        image_logo_enabled:     { type: 'boolean', description: 'Include brand logo in generated image (default: true)' },
        skip_image_generation:  { type: 'boolean', description: 'Set to true to skip AI image generation. Use when you will upload your own image with uploadPostImage after creating the post.' },
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
    name: 'deletePost',
    description: 'Permanently deletes a post and all its associated media. This action is irreversible.',
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
        placement:          { type: 'string', enum: ['feed', 'story'], description: 'Publish destination: feed or story (Instagram Story). Carousel posts are always feed.' },
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
    description: 'Enqueues a new image generation for the post using AI (processed asynchronously in a background queue - the response returns immediately, before the image is ready; poll getPost and check post.generation_status). For carousel posts, regenerates all slides or a specific slide via slot_index. From the 6th generation onwards, an extra credit is charged - confirm with confirm_extra_content: true.',
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
    name: 'uploadPostImage',
    description: 'Uploads a custom image (jpg, jpeg, png or webp) as the post media, replacing the current AI-generated image. Provide either file_path (local file) or image_url (public URL to download from). For carousel posts, use slot_index (0-based) to target a specific slide; omit to replace slide 0.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:         { type: 'string', description: 'Post UUID' },
        file_path:  { type: 'string', description: 'Absolute path to a local image file (jpg, jpeg, png, webp)' },
        image_url:  { type: 'string', description: 'Public URL of the image to download and upload' },
        slot_index: { type: 'number', description: 'Carousel slide index (0-based). Required to fill slides beyond the first one.' },
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

  // ─── SOCIAL CONNECTIONS (read-only) ─────────────────────────────────────────

  {
    name: 'listSocialConnections',
    description: "Lists the user's connected social accounts (Instagram, etc.) with id, platform, username and status. Use the connection id as social_connection_id when scheduling a standalone post. Read-only: connecting and managing accounts is done in the Studio.",
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // ─── PUBLISH / SCHEDULE ─────────────────────────────────────────────────────

  {
    name: 'schedulePost',
    description: 'Schedules a post for publishing: marks it as scheduled and creates the delivery job (the worker publishes at scheduled_at). Omit scheduled_at to publish as soon as possible. For standalone posts (no campaign) you MUST pass social_connection_id (get it from listSocialConnections). Campaign posts publish to the campaign accounts.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:                   { type: 'string', description: 'Post UUID' },
        scheduled_at:         { type: 'string', description: 'Publish datetime (ISO-8601). Omit to publish as soon as possible.' },
        social_connection_id: { type: 'string', description: 'Target account UUID (from listSocialConnections). Required for standalone posts.' },
      },
    },
  },
];
