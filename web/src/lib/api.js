export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request(path, { tenant, method = 'GET', body } = {}) {
  const headers = {}
  if (tenant) headers['x-tenant-id'] = tenant
  if (body) headers['content-type'] = 'application/json'

  let res
  try {
    res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the API. Is the server running?')
  }

  const json = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(
      res.status,
      json?.error?.code || 'HTTP_ERROR',
      json?.error?.message || `Request failed with status ${res.status}`
    )
  }
  return json
}

export const api = {
  health: () =>
    fetch('/health')
      .then(res => res.json())
      .catch(() => ({ status: 'error', database: 'down' })),

  createMessage: (tenant, message) =>
    request('/api/v1/messages', { tenant, method: 'POST', body: message }).then(res => res.data),

  getMessage: (tenant, id) =>
    request(`/api/v1/messages/${encodeURIComponent(id)}`, { tenant }).then(res => res.data),

  listConversation: (tenant, conversationId, { limit, cursor } = {}) => {
    const params = new URLSearchParams()
    if (limit) params.set('limit', limit)
    if (cursor) params.set('cursor', cursor)
    return request(`/api/v1/conversations/${encodeURIComponent(conversationId)}/messages?${params}`, { tenant })
  },

  sendWebhook: event =>
    request('/api/v1/webhooks/provider', { method: 'POST', body: event }).then(res => res.data)
}
