/**
 * Thin HTTP client for the ATRAY API.
 * All requests are authenticated via the ATRAY_API_KEY environment variable.
 */

const BASE_URL = (process.env.ATRAY_API_URL || 'https://api.atray.app').replace(/\/$/, '');
const API_KEY  = process.env.ATRAY_API_KEY || '';

if (!API_KEY) {
  process.stderr.write('[atray-mcp] WARNING: ATRAY_API_KEY not set\n');
}

/**
 * @param {string} method  - HTTP method (GET, POST, PUT, PATCH, DELETE)
 * @param {string} path    - API path, e.g. '/campaigns'
 * @param {object} [body]  - Request body (JSON)
 * @param {object} [query] - Query string params
 */
async function request(method, path, { body, query } = {}) {
  let url = BASE_URL + path;

  if (query) {
    const params = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    if (params.length) url += '?' + params.join('&');
  }

  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

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

export const api = {
  get:    (path, query)       => request('GET',    path, { query }),
  post:   (path, body, query) => request('POST',   path, { body, query }),
  put:    (path, body)        => request('PUT',    path, { body }),
  patch:  (path, body)        => request('PATCH',  path, { body }),
  delete: (path)              => request('DELETE', path),
};
