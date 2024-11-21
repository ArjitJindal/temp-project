import { createHmac } from 'node:crypto'
import { BadRequest } from 'http-errors'
import { SQSEvent } from 'aws-lambda'
// No types defined for this polyfill
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { abortableFetch } from 'abortcontroller-polyfill/dist/cjs-ponyfill'
import fetch, { FetchError, Response } from 'node-fetch'
import timeoutSignal from 'timeout-signal'
import { v4 as uuidv4 } from 'uuid'
import { WebhookDeliveryRepository } from '../../services/webhook/repositories/webhook-delivery-repository'
import { WebhookRepository } from '../../services/webhook/repositories/webhook-repository'
import { handleWebhookDeliveryTask } from './utils'
import { WebhookDeliveryTask } from '@/@types/webhook'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { logger } from '@/core/logger'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { WebhookConfiguration } from '@/@types/openapi-internal/WebhookConfiguration'
import { WebhookEvent } from '@/@types/openapi-public/WebhookEvent'
import { tenantHasFeature, withContext } from '@/core/utils/context'
import dayjs from '@/utils/dayjs'
import { envIs } from '@/utils/env'
import { isTenantWhitelabeled } from '@/utils/tenant'

export class ClientServerError extends Error {}

// For non-production env, we only retry up to 1 day
const MAX_RETRY_HOURS = envIs('prod') ? 4 * 24 : 24

export async function deliverWebhookEvent(
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

  const postPayload: WebhookEvent = {
    id: webhookDeliveryTask._id,
    type: webhookDeliveryTask.event,
    data: webhookDeliveryTask.payload,
    createdTimestamp: webhookDeliveryTask.createdAt,
    triggeredBy: webhookDeliveryTask.triggeredBy,
  }

  const hmacs = secrets.map((secret) => createHmac('sha256', secret))
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

  const isWhitelabeledTenant = await isTenantWhitelabeled(
    webhookDeliveryTask.tenantId
  )

  const header = isWhitelabeledTenant
    ? 'x-webhook-signature'
    : 'x-flagright-signature'

  const fetchOptions = {
    method: 'POST',
    headers: {
      [header]: hmacSignatures,
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
    let retryErrorMessage = ''
    if (response && response.status >= 300 && response.status < 600) {
      retryErrorMessage = `Client server returned status ${response.status}. Will retry`
    } else if (!response) {
      retryErrorMessage = 'Client server did not respond. Will retry'
    }
    if (retryErrorMessage) {
      const firstAttempt =
        await webhookDeliveryRepository.getFirstWebhookDeliveryAttempt(
          webhookDeliveryTask._id
        )

      const retryHours = dayjs().diff(
        dayjs(firstAttempt?.requestStartedAt),
        'hour'
      )
      if (retryHours >= MAX_RETRY_HOURS) {
        logger.error(
          `Failed to deliver event ${webhookDeliveryTask.event} to ${webhook.webhookUrl} after ${MAX_RETRY_HOURS} hours. Will not retry`
        )

        if (await tenantHasFeature(webhookDeliveryTask.tenantId, 'PNB')) {
          // Don't disable webhooks for PNB
          logger.error(
            `Webhook task for PNB failed with ID ${webhookDeliveryTask._id}`
          )
          return
        }
        await webhookRepository.disableWebhook(
          webhook._id as string,
          `Automatically deactivated at ${dayjs().format()} by the system as it has reached the maximum retry limit (${MAX_RETRY_HOURS} hours)`
        )
      } else {
        throw new ClientServerError(retryErrorMessage)
      }
    }
  } catch (e) {
    logger.warn(`Failed to deliver event: ${(e as Error).message}`)
    if ((e as any)?.name === 'AbortError') {
      logger.warn(`Request timeout after ${requestTimeoutSec} seconds`)
      return
    }
    if ((e as any)?.type === 'aborted') {
      // We don't retry if customer server fails to respond before the timeout
      logger.warn(`Request timeout after ${requestTimeoutSec} seconds`)
      return
    }

    if (e instanceof FetchError) {
      throw new ClientServerError(`Client server failed to respond. Will retry`)
    } else {
      throw e
    }
  } finally {
    const requestFinishedAt = Date.now()
    const success = response
      ? response.status >= 200 && response.status < 300
      : false
    if (success) {
      logger.info('Successfully delivered event')
    } else {
      logger.warn(`Failed to deliver event`)
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

export const webhookDeliveryHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    const results = await Promise.allSettled(
      event.Records.map(async (record) => {
        try {
          await withContext(async () => {
            const webhookDeliveryTask = JSON.parse(
              record.body
            ) as WebhookDeliveryTask
            await handleWebhookDeliveryTask(webhookDeliveryTask)
          })
        } catch (e) {
          if (!(e instanceof ClientServerError)) {
            logger.error(e)
          }
          throw e
        }
      })
    )
    if (results.find((result) => result.status === 'rejected')) {
      // We throw BadRequest here to avoid sending error to Sentry
      throw new BadRequest(
        'Failed to process all the SQS messages in the same batch. Will retry'
      )
    }
  }
)
