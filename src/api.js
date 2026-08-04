/**
 * Cliente HTTP fino da API da ATRAY.
 *
 * ── POR QUE ISTO VIROU UMA FÁBRICA (T-924) ────────────────────────────────────────────────
 * Até a fase 1 a credencial era lida do módulo (`process.env.ATRAY_API_KEY` no topo do
 * arquivo): uma chave por PROCESSO. No stdio isso é correto - o processo é do usuário. No
 * servidor remoto multi-tenant é o defeito mais perigoso possível: estado de módulo é
 * compartilhado por todas as requisições simultâneas, então dois clientes conectados ao mesmo
 * container leriam a conta um do outro. Não existe jeito seguro de "trocar a chave global antes
 * de cada chamada" - duas requisições concorrentes se atropelam entre a troca e o fetch.
 *
 * Por isso a credencial passou a ser argumento: `createApi({ token })` devolve um cliente
 * isolado, criado por requisição no http.js e descartado com ela. O `api` exportado no fim é o
 * de sempre (lê a env), para o stdio continuar funcionando sem mudar uma linha.
 */

const DEFAULT_BASE_URL = (process.env.ATRAY_API_URL || 'https://api.atray.app').replace(/\/$/, '');

/**
 * @param {object} opts
 * @param {string} opts.token   - credencial no Authorization: API key (atray_...) ou access token do OAuth (mcp_at_...)
 * @param {string} [opts.baseUrl]
 */
export function createApi({ token, baseUrl = DEFAULT_BASE_URL } = {}) {
  const base = String(baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
  const credential = token || '';

  async function request(method, path, { body, query } = {}) {
    let url = base + path;

    if (query) {
      const params = Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
      if (params.length) url += '?' + params.join('&');
    }

    const headers = {
      'Authorization': `Bearer ${credential}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    return parseResponse(res);
  }

  /**
   * Multipart/form-data upload (e.g. post video). The Content-Type header
   * (with boundary) is set automatically by fetch from the FormData body.
   */
  async function upload(path, { field, buffer, filename, contentType }) {
    const form = new FormData();
    form.append(field, new Blob([buffer], { type: contentType }), filename);

    const res = await fetch(base + path, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credential}`,
        'Accept': 'application/json',
      },
      body: form,
    });

    return parseResponse(res);
  }

  return {
    get: (path, query) => request('GET', path, { query }),
    post: (path, body, query) => request('POST', path, { body, query }),
    put: (path, body) => request('PUT', path, { body }),
    patch: (path, body) => request('PATCH', path, { body }),
    delete: (path) => request('DELETE', path),
    upload,
  };
}

async function parseResponse(res) {
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    const err = new Error(`ATRAY API error ${res.status}: ${msg}`);
    err.status = res.status;
    err.data   = data;
    throw err;
  }

  return data;
}

/**
 * Cliente padrão do uso stdio: credencial da env, um processo por usuário.
 *
 * O aviso de env ausente saiu daqui (T-924): no servidor remoto com OAuth não existe
 * ATRAY_API_KEY - a credencial vem do token da requisição - e o aviso assustava sem motivo.
 * Quem avisa agora é o index.js, que é o entrypoint em que a env de fato importa.
 */
export const api = createApi({ token: process.env.ATRAY_API_KEY || '' });
