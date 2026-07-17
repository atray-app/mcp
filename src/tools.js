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
        company_context:  { type: 'string', description: 'Free-form long-text company context (products, policies, FAQ, rules) used by AI agents and content generation' },
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
    description: 'Creates a new campaign and automatically generates posts via AI (1 post from the quota per generated post). Requires a completed brand profile. Post text is generated synchronously, but images are generated asynchronously in a background queue (status="generating") to respect provider rate limits - the response returns immediately without waiting for images. Poll getCampaign or listCampaignPosts to check progress (campaign.generation_progress / post.generation_status transitions pending -> generating -> ready or failed).',
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
        frequency:    {
          oneOf: [
            { type: 'string', enum: ['1_post_dia', '2_posts_dia'] },
            { type: 'integer', minimum: 1, maximum: 7 },
          ],
          description: "Post cadence: '1_post_dia' (1/day), '2_posts_dia' (2/day), or an integer 1-7 meaning posts per week (spread evenly across each 7-day block from start_date)",
        },
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
        frequency:    {
          oneOf: [
            { type: 'string', enum: ['1_post_dia', '2_posts_dia'] },
            { type: 'integer', minimum: 1, maximum: 7 },
          ],
          description: "Post cadence: '1_post_dia' (1/day), '2_posts_dia' (2/day), or an integer 1-7 meaning posts per week",
        },
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
    description: 'Creates a standalone post draft. Billing: creating with AI (context or campaign present) uses 1 post from the quota; a fully manual draft (own caption/media, no context) is free at creation and only pays when AI generation is first used. Publishing consumes publishes (1 per destination account). Use type="carousel" with image_descriptions[] (3-6 items) for a carousel post. Default type="text" uses image_description for a single image. Set skip_image_generation=true when you plan to upload your own image with uploadPostImage right after — prevents the AI from generating and overwriting your upload. When image generation runs, it is enqueued and processed asynchronously (post.generation_status: pending -> generating -> ready/failed) - the response returns before the image is ready; poll getPost to check.',
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

  // ─── CRM ────────────────────────────────────────────────────────────────────

  {
    name: 'listCrmContacts',
    description: 'Lists CRM contacts with filters and pagination. Returns contacts array and total.',
    inputSchema: {
      type: 'object',
      properties: {
        q:       { type: 'string', description: 'Search by name, email, company or phone' },
        list_id: { type: 'string', description: 'Filter by contact list UUID' },
        tag:     { type: 'string', description: 'Filter by tag' },
        sort:    { type: 'string', enum: ['full_name', 'created_at', 'last_interaction_at', 'company', 'city'] },
        order:   { type: 'string', enum: ['asc', 'desc'] },
        limit:   { type: 'integer', minimum: 1, maximum: 100 },
        offset:  { type: 'integer', minimum: 0 },
      },
    },
  },

  {
    name: 'getCrmContact',
    description: 'Gets a CRM contact by UUID, including the lists it belongs to.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'Contact UUID' } },
    },
  },

  {
    name: 'createCrmContact',
    description: 'Creates a CRM contact. Provide at least name, phone or email. Phone in any format is normalized to E.164 (BR numbers without country code get 55). Returns 409 DUPLICATE_PHONE with existing_id if the phone already exists.',
    inputSchema: {
      type: 'object',
      properties: {
        full_name:     { type: 'string' },
        phone:         { type: 'string', description: 'Phone in any format' },
        email:         { type: 'string' },
        company:       { type: 'string' },
        city:          { type: 'string' },
        birthday:      { type: 'string', description: 'YYYY-MM-DD' },
        tags:          { type: 'array', items: { type: 'string' } },
        custom_fields: { type: 'object' },
        notes:         { type: 'string' },
      },
    },
  },

  {
    name: 'updateCrmContact',
    description: 'Updates a CRM contact. Only send the fields you want to change. opt_out: true excludes the contact from automations.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:            { type: 'string', description: 'Contact UUID' },
        full_name:     { type: 'string' },
        phone:         { type: 'string' },
        email:         { type: 'string' },
        company:       { type: 'string' },
        city:          { type: 'string' },
        birthday:      { type: 'string', description: 'YYYY-MM-DD' },
        tags:          { type: 'array', items: { type: 'string' } },
        custom_fields: { type: 'object' },
        notes:         { type: 'string' },
        opt_out:       { type: 'boolean' },
      },
    },
  },

  {
    name: 'importCrmContacts',
    description: 'Imports contacts from CSV text (first row = header; accepted columns: nome/name, telefone/phone/whatsapp, email, empresa/company, cidade/city, aniversario/birthday, observacoes/notes, tags). Deduplicates by phone. Max 5000 rows. Returns { created, skipped_duplicates, errors }.',
    inputSchema: {
      type: 'object',
      required: ['csv'],
      properties: {
        csv:     { type: 'string', description: 'Raw CSV text' },
        list_id: { type: 'string', description: 'Optional list UUID to add imported contacts to' },
      },
    },
  },

  {
    name: 'listCrmLists',
    description: 'Lists CRM contact lists (segments) with member counts.',
    inputSchema: { type: 'object', properties: {} },
  },

  {
    name: 'listCrmPipelines',
    description: 'Lists CRM pipelines, each with its ordered custom stages (id, name, color, is_won, is_lost).',
    inputSchema: { type: 'object', properties: {} },
  },

  {
    name: 'getCrmPipelineBoard',
    description: 'Returns the kanban board of a pipeline: columns (stages) with their deals, counts and total values in cents.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'Pipeline UUID' } },
    },
  },

  {
    name: 'listCrmDeals',
    description: 'Lists CRM deals with filters and pagination. Returns deals (with stage_name, pipeline_name, contact_name) and total.',
    inputSchema: {
      type: 'object',
      properties: {
        pipeline_id: { type: 'string' },
        stage_id:    { type: 'string' },
        contact_id:  { type: 'string' },
        q:           { type: 'string', description: 'Search by title' },
        sort:        { type: 'string', enum: ['title', 'value_cents', 'created_at', 'updated_at', 'expected_close_date'] },
        order:       { type: 'string', enum: ['asc', 'desc'] },
        limit:       { type: 'integer', minimum: 1, maximum: 100 },
        offset:      { type: 'integer', minimum: 0 },
      },
    },
  },

  {
    name: 'createCrmDeal',
    description: 'Creates a CRM deal. title is required. Without pipeline_id uses the default pipeline; without stage_id uses its first stage. value_cents is the monetary value in cents (BRL default).',
    inputSchema: {
      type: 'object',
      required: ['title'],
      properties: {
        title:               { type: 'string' },
        pipeline_id:         { type: 'string' },
        stage_id:            { type: 'string' },
        contact_id:          { type: 'string' },
        value_cents:         { type: 'integer' },
        currency:            { type: 'string', description: 'ISO 4217, default BRL' },
        owner_name:          { type: 'string' },
        expected_close_date: { type: 'string', description: 'YYYY-MM-DD' },
        notes:               { type: 'string' },
      },
    },
  },

  {
    name: 'getCrmDeal',
    description: 'Gets a single CRM deal by UUID.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'Deal UUID' } },
    },
  },

  {
    name: 'updateCrmDeal',
    description: 'Updates a CRM deal. Only send the fields you want to change (to move stage use moveCrmDealStage).',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:                  { type: 'string', description: 'Deal UUID' },
        title:               { type: 'string' },
        contact_id:          { type: 'string' },
        value_cents:         { type: 'integer' },
        currency:            { type: 'string' },
        owner_name:          { type: 'string' },
        expected_close_date: { type: 'string', description: 'YYYY-MM-DD' },
        notes:               { type: 'string' },
      },
    },
  },

  {
    name: 'moveCrmDealStage',
    description: 'Moves a deal to another stage of its pipeline (kanban). Records stage_entered_at; entering a won/lost stage sets closed_at.',
    inputSchema: {
      type: 'object',
      required: ['id', 'stage_id'],
      properties: {
        id:       { type: 'string', description: 'Deal UUID' },
        stage_id: { type: 'string', description: 'Target stage UUID (same pipeline)' },
      },
    },
  },

  {
    name: 'listCrmConversations',
    description: 'Lists WhatsApp inbox conversations ordered by last message. Includes contact info, unread count, agent state and last message preview.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'waiting_human', 'resolved'] },
        q:      { type: 'string', description: 'Search by contact name or phone' },
        limit:  { type: 'integer', minimum: 1, maximum: 100 },
        offset: { type: 'integer', minimum: 0 },
      },
    },
  },

  {
    name: 'getCrmConversationMessages',
    description: 'Gets messages of a conversation, newest first. Use before (ISO datetime) as cursor for older pages.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:     { type: 'string', description: 'Conversation UUID' },
        before: { type: 'string', description: 'ISO datetime cursor' },
        limit:  { type: 'integer', minimum: 1, maximum: 200 },
      },
    },
  },

  {
    name: 'sendCrmMessage',
    description: 'Sends a WhatsApp message in a conversation as a human attendant. Delivery goes through the outbox worker; the AI agent is PAUSED on this conversation (human takeover).',
    inputSchema: {
      type: 'object',
      required: ['id', 'text'],
      properties: {
        id:   { type: 'string', description: 'Conversation UUID' },
        text: { type: 'string', description: 'Message text' },
      },
    },
  },

  {
    name: 'listCrmSequences',
    description: 'Lists follow-up sequences (multi-step cadences with waits; stop-on-reply) with step and enrollment counts.',
    inputSchema: { type: 'object', properties: {} },
  },

  {
    name: 'enrollContactInSequence',
    description: 'Enrolls a contact in a follow-up sequence (step 1 scheduled by its wait). One active enrollment per contact per sequence; contacts with opt-out are refused.',
    inputSchema: {
      type: 'object',
      required: ['sequence_id', 'contact_id'],
      properties: {
        sequence_id: { type: 'string', description: 'Sequence UUID' },
        contact_id:  { type: 'string', description: 'Contact UUID' },
      },
    },
  },

  {
    name: 'listCrmAgents',
    description: 'Lists the AI agents (name, prompt, WhatsApp connection, active state, settings). Only 1 active agent per connection.',
    inputSchema: { type: 'object', properties: {} },
  },

  {
    name: 'getCrmDashboardOverview',
    description: 'CRM overview: new contacts, open/waiting conversations, open deals value, won/lost deals in the period, messages per day, AI agent replies/escalations and the pipeline funnel.',
    inputSchema: {
      type: 'object',
      properties: {
        days:        { type: 'integer', minimum: 7, maximum: 90, description: 'Period in days (default 30)' },
        pipeline_id: { type: 'string', description: 'Funnel pipeline UUID (default: default pipeline)' },
      },
    },
  },

  {
    name: 'listCrmAutomations',
    description: 'Lists CRM automations (trigger, actions, active state, completed runs count).',
    inputSchema: { type: 'object', properties: {} },
  },

  {
    name: 'createCrmAutomation',
    description: 'Creates a CRM automation. Triggers: date_birthday {days_before}, date_inactivity {inactivity_days}, date_followup {days_after}, message_keyword {keywords[]}, message_first_contact {}, deal_stage_changed {stage_id}. Actions (max 5, in order): send_message (via "template" with template_text using {{nome}}/{{primeiro_nome}}/{{empresa}} placeholders, or via "agent" with instruction), notify_human, move_deal_stage {stage_id}, create_task {title, due_in_days}. Messages respect opt-out, daily cap per contact and quiet hours 21h-8h.',
    inputSchema: {
      type: 'object',
      required: ['name', 'trigger_type', 'actions'],
      properties: {
        name:           { type: 'string' },
        trigger_type:   { type: 'string', enum: ['date_birthday', 'date_inactivity', 'date_followup', 'message_keyword', 'message_first_contact', 'deal_stage_changed'] },
        trigger_config: { type: 'object', description: 'Per trigger type (see description)' },
        conditions:     { type: 'object', properties: { list_id: { type: 'string' } } },
        actions:        { type: 'array', items: { type: 'object' }, description: 'See description for action shapes' },
        cooldown_hours: { type: 'integer' },
        is_active:      { type: 'boolean' },
      },
    },
  },

  {
    name: 'updateCrmAutomation',
    description: 'Updates a CRM automation (same shapes as createCrmAutomation; send only fields to change; is_active toggles it).',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:             { type: 'string', description: 'Automation UUID' },
        name:           { type: 'string' },
        trigger_type:   { type: 'string', enum: ['date_birthday', 'date_inactivity', 'date_followup', 'message_keyword', 'message_first_contact', 'deal_stage_changed'] },
        trigger_config: { type: 'object' },
        conditions:     { type: 'object' },
        actions:        { type: 'array', items: { type: 'object' } },
        cooldown_hours: { type: 'integer' },
        is_active:      { type: 'boolean' },
      },
    },
  },

  {
    name: 'createCrmAgent',
    description: 'Creates an AI agent. Only "name" is required. To create it already active (is_active), the agent needs a prompt and a WhatsApp connection; activating deactivates other agents on the same connection.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name:                 { type: 'string' },
        prompt:               { type: 'string', description: 'Behavior prompt (role, tone, what it can/cannot do)' },
        social_connection_id: { type: 'string', description: 'WhatsApp connection UUID' },
        is_active:            { type: 'boolean' },
        settings: {
          type: 'object',
          properties: {
            debounce_seconds:        { type: 'integer', minimum: 3, maximum: 120 },
            max_consecutive_replies: { type: 'integer', minimum: 1, maximum: 20 },
            business_hours:          { type: 'object', description: '{start:"08:00", end:"18:00", tz:"America/Sao_Paulo"} or null' },
            fallback_message:        { type: 'string' },
            escalation_jid:          { type: 'string', description: 'Phone/group that receives escalation alerts' },
          },
        },
      },
    },
  },

  {
    name: 'updateCrmAgent',
    description: 'Updates an AI agent. Only send the fields to change. To activate, the agent needs a prompt and a WhatsApp connection; activating deactivates other agents on the same connection.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:                   { type: 'string', description: 'Agent UUID' },
        name:                 { type: 'string' },
        prompt:               { type: 'string', description: 'Behavior prompt (role, tone, what it can/cannot do)' },
        social_connection_id: { type: 'string', description: 'WhatsApp connection UUID' },
        is_active:            { type: 'boolean' },
        settings: {
          type: 'object',
          properties: {
            debounce_seconds:        { type: 'integer', minimum: 3, maximum: 120 },
            max_consecutive_replies: { type: 'integer', minimum: 1, maximum: 20 },
            business_hours:          { type: 'object', description: '{start:"08:00", end:"18:00", tz:"America/Sao_Paulo"} or null' },
            fallback_message:        { type: 'string' },
            escalation_jid:          { type: 'string', description: 'Phone/group that receives escalation alerts' },
          },
        },
      },
    },
  },

  // ─── BILLING ────────────────────────────────────────────────────────────────

  {
    name: 'getBillingUsage',
    description: "Current-month usage per module: posts (AI generations), publicacoes (1 post x 1 destination account) and atendimentos (AI conversations handled by the CRM agent). Each module reports the plan quota (used/total), the extra one-time pack balance (with expiry) and the total available now. Use to check remaining atendimentos/posts/publish quota before creating content or enrolling contacts.",
    inputSchema: { type: 'object', properties: {} },
  },
];
