import { createHmac } from 'node:crypto'
import { SQSEvent, SQSRecord } from 'aws-lambda'

import fetch, { Response } from 'node-fetch'
import timeoutSignal from 'timeout-signal'
import { v4 as uuidv4 } from 'uuid'
import { getWebhookSecrets } from './utils'
import { WebhookDeliveryRepository } from './repositories/webhook-delivery-repository'
import { WebhookRepository } from './repositories/webhook-repository'
import {
  WebhookDeliveryTask,
  SecretsManagerWebhookSecrets,
} from '@/@types/webhook'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { logger } from '@/core/logger'
import { connectToDB } from '@/utils/mongoDBUtils'
import { WebhookConfiguration } from '@/@types/openapi-internal/WebhookConfiguration'
import { WebhookEvent } from '@/@types/openapi-public/WebhookEvent'

function getNotExpiredSecrets(keys: SecretsManagerWebhookSecrets): string[] {
  return Object.keys(keys).filter(
    (secret) => (keys?.[secret] || Number.MAX_SAFE_INTEGER) > Date.now()
  )
}

async function deliverWebhookEvent(
  webhook: WebhookConfiguration,
  secrets: string[],
  webhookDeliveryTask: WebhookDeliveryTask
) {
  const webhookDeliveryRepository = new WebhookDeliveryRepository(
    webhookDeliveryTask.tenantId,
    await connectToDB()
  )
  const hmacs = secrets.map((secret) => createHmac('sha256', secret))
  const postPayload: WebhookEvent = {
    id: webhookDeliveryTask._id,
    type: webhookDeliveryTask.event,
    data: webhookDeliveryTask.payload,
    createdTimestamp: webhookDeliveryTask.createdAt,
  }
  const postPayloadString = JSON.stringify(postPayload)
  const hmacSignatures = hmacs
    .map((hmac) => {
      hmac.update(postPayloadString)
      return hmac.digest('hex')
    })
    .join(',')
  const requestTimeoutSec = process.env.WEBHOOK_REQUEST_TIMEOUT_SEC
    ? Number(process.env.WEBHOOK_REQUEST_TIMEOUT_SEC)
    : 10

  const fetchOptions = {
    method: 'POST',
    headers: {
      'x-flagright-signature': hmacSignatures,
      'content-type': 'application/json',
    },
    body: postPayloadString,
    signal: timeoutSignal(requestTimeoutSec * 1000),
  }
  const requestStartedAt = Date.now()
  let response: Response | undefined = undefined
  try {
    response = await fetch(webhook.webhookUrl, fetchOptions)
    if (response.status >= 300 && response.status < 600) {
      throw new Error(
        `Client server returned status ${response.status}. Will retry`
      )
    }
  } catch (e) {
    if ((e as any)?.type === 'aborted') {
      // We don't retry if customer server fails to respond before the timeout
      logger.error(`Request timeout after ${requestTimeoutSec} seconds`)
    } else {
      throw e
    }
  } finally {
    const requestFinishedAt = Date.now()
    const success = response
      ? response.status >= 200 && response.status < 300
      : false
    if (success) {
      logger.info(
        `Successfully delivered event ${webhookDeliveryTask.event} to ${webhook.webhookUrl}`
      )
    }
    await webhookDeliveryRepository.addWebhookDeliveryAttempt({
      _id: uuidv4(),
      deliveryTaskId: webhookDeliveryTask._id,
      webhookId: webhookDeliveryTask.webhookId,
      webhookUrl: webhook.webhookUrl,
      requestStartedAt,
      requestFinishedAt,
      success,
      event: webhookDeliveryTask.event,
      eventCreatedAt: webhookDeliveryTask.createdAt,
      request: {
        headers: fetchOptions.headers,
        body: fetchOptions.body,
      },
      response: response && {
        status: response.status,
        headers: response.headers.raw(),
        body: await response.text(),
      },
    })
  }
}

async function handleWebhookDeliveryTask(record: SQSRecord) {
  const webhookDeliveryTask = JSON.parse(record.body) as WebhookDeliveryTask
  const mongoClient = await connectToDB()
  const webhookRepository = new WebhookRepository(
    webhookDeliveryTask.tenantId,
    mongoClient
  )
  const webhook = await webhookRepository.getWebhook(
    webhookDeliveryTask.webhookId
  )
  if (
    !webhook?.enabled ||
    !webhook.events.includes(webhookDeliveryTask.event)
  ) {
    return
  }

  const webhookDeliveryRepository = new WebhookDeliveryRepository(
    webhookDeliveryTask.tenantId,
    mongoClient
  )
  const latestAttempt =
    await webhookDeliveryRepository.getLatestWebhookDeliveryAttempt(
      webhookDeliveryTask._id
    )
  if (latestAttempt?.success) {
    return
  }
  const secretKeys = await getWebhookSecrets(
    webhookDeliveryTask.tenantId,
    webhookDeliveryTask.webhookId
  )
  await deliverWebhookEvent(
    webhook,
    getNotExpiredSecrets(secretKeys),
    webhookDeliveryTask
  )
}

export const deliveryHandler = lambdaConsumer()(async (event: SQSEvent) => {
  const results = await Promise.allSettled(
    event.Records.map(async (record) => {
      try {
        await handleWebhookDeliveryTask(record)
      } catch (e) {
        logger.error(e)
        throw e
      }
    })
  )
  if (results.find((result) => result.status === 'rejected')) {
    throw new Error(
      'Failed to process all the SQS messages in the same batch. Will retry'
    )
  }
})
