import { createHmac } from 'crypto'
import { stageAndRegion } from '@flagright/lib/utils'
import axios from 'axios'
import { APIGatewayProxyEventHeaders } from 'aws-lambda'
import { FlagrightRegion } from '@/@types/openapi-internal/FlagrightRegion'
import { InternalProxyWebhookEvent } from '@/@types/openapi-internal/InternalProxyWebhookEvent'

const INTERNAL_PROXY_WEBHOOK_SECRET = '2e01012c-ee69-4848-8c12-020bfd1e57bc'
const INTERNAL_PROXY_WEBHOOK_SIGNATURE_HEADER = 'X-Internal-Proxy-Signature'

export type InternalProxyWebhookData = InternalProxyWebhookEvent['data']

export async function sendInternalProxyWebhook(
  destinationRegion: FlagrightRegion,
  payload: InternalProxyWebhookData
) {
  const [currentStage] = stageAndRegion()

  let url: string | undefined

  if (currentStage === 'dev') {
    url = `https://api.flagright.dev/console/webhooks/internal-proxy`
  } else if (currentStage === 'sandbox') {
    if (destinationRegion === 'eu-1') {
      url = `https://sandbox.api.flagright.com/console/webhooks/internal-proxy`
    } else {
      url = `https://sandbox-asia-1.api.flagright.com/console/webhooks/internal-proxy`
    }
  } else if (currentStage === 'prod') {
    url = `https://${destinationRegion}.api.flagright.com/console/webhooks/internal-proxy`
  }

  if (!url) {
    throw new Error('Invalid region for internal proxy webhook')
  }

  const signature = createHmac('sha256', INTERNAL_PROXY_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex')

  await axios.post(url, payload, {
    headers: { [INTERNAL_PROXY_WEBHOOK_SIGNATURE_HEADER]: signature },
  })
}

export function verifyInternalProxyWebhook(
  headers: APIGatewayProxyEventHeaders,
  payload: InternalProxyWebhookData
) {
  const signature = headers[INTERNAL_PROXY_WEBHOOK_SIGNATURE_HEADER]
  if (!signature) {
    return false
  }

  const hmac = createHmac('sha256', INTERNAL_PROXY_WEBHOOK_SECRET)
  hmac.update(JSON.stringify(payload))
  const computedSignature = hmac.digest('hex')
  return computedSignature === signature
}
