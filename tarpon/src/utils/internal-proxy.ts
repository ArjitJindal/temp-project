import { createHmac } from 'crypto'
import { stageAndRegion } from '@flagright/lib/utils'
import axios, { AxiosError } from 'axios'
import { APIGatewayProxyEventHeaders } from 'aws-lambda'
import { FlagrightRegion } from '@/@types/openapi-internal/FlagrightRegion'
import { InternalProxyWebhookEvent } from '@/@types/openapi-internal/InternalProxyWebhookEvent'
import { logger } from '@/core/logger'

const INTERNAL_PROXY_WEBHOOK_SECRET = '2e01012c-ee69-4848-8c12-020bfd1e57bc'
const INTERNAL_PROXY_WEBHOOK_SIGNATURE_HEADER = 'x-internal-proxy-signature'

export type InternalProxyWebhookData = InternalProxyWebhookEvent['data']

export async function sendInternalProxyWebhook(
  destinationRegion: FlagrightRegion,
  payload: InternalProxyWebhookData,
  throwError: boolean = true
) {
  const [currentStage] = stageAndRegion()

  let url: string | undefined

  if (currentStage === 'local') {
    url = `http://localhost:3002/webhooks/internal-proxy`
  } else if (currentStage === 'dev') {
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

  const payloadToSend: InternalProxyWebhookEvent = {
    createdTimestamp: Date.now(),
    data: payload,
    destinationRegion,
    sourceRegion: stageAndRegion()[1] as FlagrightRegion,
  }

  const signature = createHmac('sha256', INTERNAL_PROXY_WEBHOOK_SECRET)
    .update(signatureKey(payloadToSend))
    .digest('hex')

  try {
    await axios.post(url, payloadToSend, {
      headers: { [INTERNAL_PROXY_WEBHOOK_SIGNATURE_HEADER]: signature },
    })
  } catch (e) {
    const error = e as AxiosError
    if (!throwError) {
      logger.error('Failed to send internal proxy webhook', {
        message: error.message,
        status: error.response?.status,
        errorMessage: error.response?.data,
        url,
        payload: payloadToSend,
      })
    } else {
      throw e
    }
  }
}

const signatureKey = (payload: InternalProxyWebhookEvent) => {
  return [
    payload.sourceRegion,
    payload.destinationRegion,
    payload.data.type,
    payload.createdTimestamp,
  ].join('|')
}

export function verifyInternalProxyWebhook(
  headers: APIGatewayProxyEventHeaders,
  payload: InternalProxyWebhookEvent
) {
  const signature = headers[INTERNAL_PROXY_WEBHOOK_SIGNATURE_HEADER]
  if (!signature) {
    return false
  }

  const hmac = createHmac('sha256', INTERNAL_PROXY_WEBHOOK_SECRET)
  hmac.update(signatureKey(payload))
  const computedSignature = hmac.digest('hex')
  return computedSignature === signature
}
