import { createHmac } from 'node:crypto'
import { SQSEvent, SQSRecord } from 'aws-lambda'
// No types defined for this polyfill
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { abortableFetch } from 'abortcontroller-polyfill/dist/cjs-ponyfill'
import fetch, { Response } from 'cross-fetch'
import timeoutSignal from 'timeout-signal'
import { v4 as uuidv4 } from 'uuid'
import _ from 'lodash'
import { getWebhookSecrets } from '../../services/webhook/utils'
import { WebhookDeliveryRepository } from '../../services/webhook/repositories/webhook-delivery-repository'
import { WebhookRepository } from '../../services/webhook/repositories/webhook-repository'
import {
  WebhookDeliveryTask,
  SecretsManagerWebhookSecrets,
} from '@/@types/webhook'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { logger } from '@/core/logger'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { WebhookConfiguration } from '@/@types/openapi-internal/WebhookConfiguration'
import { WebhookEvent } from '@/@types/openapi-public/WebhookEvent'
import {
  getContext,
  getContextStorage,
  updateLogMetadata,
} from '@/core/utils/context'

function getNotExpiredSecrets(keys: SecretsManagerWebhookSecrets): string[] {
  return Object.keys(keys).filter(
    (secret) => (keys?.[secret] || Number.MAX_SAFE_INTEGER) > Date.now()
  )
}

const MAX_RETRY_ATTEMPTS = Number.MAX_SAFE_INTEGER

async function deliverWebhookEvent(
  webhook: WebhookConfiguration,
  secrets: string[],
  webhookDeliveryTask: WebhookDeliveryTask
) {
  const mongoDb = await getMongoDbClient()
  const webhookDeliveryRepository = new WebhookDeliveryRepository(
    webhookDeliveryTask.tenantId,
    mongoDb
  )
  const webhookRepository = new WebhookRepository(
    webhookDeliveryTask.tenantId,
    mongoDb
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
    response = await abortableFetch(fetch).fetch(
      webhook.webhookUrl,
      fetchOptions
    )
    if (response && response.status >= 300 && response.status < 600) {
      throw new Error(
        `Client server returned status ${response.status}. Will retry`
      )
      if (webhook._id) {
        await webhookRepository.incrementRetryCount(webhook._id as string)
      }
    } else if (!response) {
      throw new Error('Client server did not respond. Will retry')
      if (webhook._id) {
        await webhookRepository.incrementRetryCount(webhook._id as string)
      }
    } else {
      logger.info(
        `Successfully delivered event ${webhookDeliveryTask.event} to ${webhook.webhookUrl}`
      )
      if (webhook._id) {
        await webhookRepository.resetRetryCount(webhook._id as string)
      }
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
    } else {
      if (webhook._id) {
        const retryCount = await webhookRepository.getRetryCount(
          webhook._id as string
        )
        if (retryCount >= MAX_RETRY_ATTEMPTS) {
          logger.error(
            `Failed to deliver event ${webhookDeliveryTask.event} to ${webhook.webhookUrl} after ${MAX_RETRY_ATTEMPTS} attempts. Will not retry`
          )
          await webhookRepository.disableWebhook(webhook._id as string)
        }
      }
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
        headers: JSON.stringify(response.headers),
        body: await response.text(),
      },
    })
  }
}

async function handleWebhookDeliveryTask(record: SQSRecord) {
  const webhookDeliveryTask = JSON.parse(record.body) as WebhookDeliveryTask
  updateLogMetadata({
    tenantId: webhookDeliveryTask.tenantId,
    event: webhookDeliveryTask.event,
    webhookId: webhookDeliveryTask.webhookId,
  })

  const mongoClient = await getMongoDbClient()
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

export const webhookDeliveryHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    const results = await Promise.allSettled(
      event.Records.map(async (record) => {
        try {
          await getContextStorage().run(getContext() || {}, async () => {
            await handleWebhookDeliveryTask(record)
          })
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
  }
)
