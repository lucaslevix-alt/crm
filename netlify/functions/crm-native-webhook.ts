import type { Handler, HandlerEvent } from '@netlify/functions'
import { runCrmNativeWebhookHttp } from '../../server/crmNativeWebhook'

function parseBody(event: HandlerEvent): unknown {
  if (!event.body) return null
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

export const handler: Handler = async (event) => {
  const query: Record<string, string | undefined> = {}
  if (event.queryStringParameters) {
    for (const [k, v] of Object.entries(event.queryStringParameters)) {
      query[k] = v ?? undefined
    }
  }

  const headers: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(event.headers ?? {})) {
    headers[k.toLowerCase()] = v
  }

  const { status, body } = await runCrmNativeWebhookHttp({
    method: event.httpMethod,
    headers,
    query,
    body: parseBody(event)
  })

  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
}
