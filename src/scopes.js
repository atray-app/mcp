/**
 * Escopo exigido por cada tool (T-924).
 *
 * ESTE ARQUIVO NÃO AUTORIZA NADA. Quem autoriza é a api, que confere o escopo do token contra
 * método + caminho a cada requisição (`api/src/domains/oauth/scopes.js`). O que existe aqui é
 * a mesma régua vista do lado do cliente, com dois usos:
 *
 *   1. `tools/list` devolve só o que o token pode chamar - o assistente não oferece ao usuário
 *      um botão que vai voltar 403, e o modelo não queima rodada tentando publicar quando só
 *      recebeu leitura.
 *   2. a recusa vem com a frase certa ("falta mcp:publish"), em vez de um 403 cru vindo da api.
 *
 * MANTER EM SINCRONIA com a régua da api. O teste `scopes.test.js` cobre o que dá para cobrir
 * daqui (toda tool tem escopo, escopo é conhecido); a paridade real com os caminhos da api é
 * responsabilidade de quem mexer nos dois - por isso a regra de "quem mexeu em endpoint atualiza
 * o openapi" vale aqui também.
 */

/** Tools que gastam crédito, publicam ou falam com gente: cada uma nomeada, sem regra por padrão
 *  de nome. Nome de tool muda; o que dói se der errado, não. */
export const TOOL_SCOPES = {
  // ── Gasta crédito ──
  createCampaign: 'mcp:generate',
  regeneratePostText: 'mcp:generate',
  regeneratePostImage: 'mcp:generate',
  // ── Sai para o mundo ──
  schedulePost: 'mcp:publish',
  // ── Chega em pessoa real ──
  sendCrmMessage: 'mcp:messages',
  enrollContactInSequence: 'mcp:messages',
};

/** Tools de leitura. O que não está aqui nem no mapa acima é escrita (`mcp:write`). */
const READ_TOOLS = new Set([
  'getBrandProfile',
  'listCampaigns', 'getCampaign', 'listCampaignPosts',
  'listPosts', 'getPost',
  'listSocialConnections',
  'listCrmContacts', 'getCrmContact',
  'listCrmLabels', 'listCrmPipelines', 'getCrmPipelineBoard',
  'listCrmDeals', 'getCrmDeal',
  'listCrmConversations', 'getCrmConversationMessages',
  'getCrmDashboardOverview',
  'listCrmAutomations', 'listCrmOffers', 'listCrmSequences', 'listCrmAgents',
  'getBillingUsage',
]);

/** @returns {string} escopo exigido pela tool */
export function scopeFor(toolName) {
  if (TOOL_SCOPES[toolName]) return TOOL_SCOPES[toolName];
  return READ_TOOLS.has(toolName) ? 'mcp:read' : 'mcp:write';
}

/** @param {string} granted escopos concedidos, separados por espaço */
export function allowedByScope(toolName, granted) {
  const list = String(granted || '').split(/[\s,]+/).filter(Boolean);
  return list.includes(scopeFor(toolName));
}
