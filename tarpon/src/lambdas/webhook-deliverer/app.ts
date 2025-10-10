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
import { humanizeConstant } from '@flagright/lib/utils/humanize'
import { WebhookDeliveryRepository } from '../../services/webhook/repositories/webhook-delivery-repository'
import { WebhookRepository } from '../../services/webhook/repositories/webhook-repository'
import { getApiBasePath } from '../../../test-resources/integration-tests/test-utils/apiBasePath'
import { handleWebhookDeliveryTask } from './utils'
import { WebhookDeliveryTask } from '@/@types/webhook'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { logger } from '@/core/logger'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { WebhookConfiguration } from '@/@types/openapi-internal/WebhookConfiguration'
import { WebhookEvent } from '@/@types/openapi-public/WebhookEvent'
import { initializeTenantContext, withContext } from '@/core/utils/context'
import dayjs from '@/utils/dayjs'
import { envIs } from '@/utils/env'
import { isWhitelabeledTenantFromSettings } from '@/utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { WebhookRetryRepository } from '@/services/webhook/repositories/webhook-retry-repository'
import { WebhookRetryOnlyFor } from '@/@types/openapi-internal/WebhookRetryOnlyFor'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'
import {
  getNotExpiredSecrets,
  getWebhookSecrets,
} from '@/services/webhook/utils'
import { isJsonString } from '@/utils/object'

export class ClientServerError extends Error {}

// For non-production env, we only retry up to 1 day
const MAX_RETRY_HOURS = envIs('prod') ? 4 * 24 : 24

async function buildWebhookRequest(
  tenantSettings: TenantSettings,
  secrets: string[],
  webhookDeliveryTask: WebhookDeliveryTask
) {
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

  const header = isWhitelabeledTenantFromSettings(tenantSettings)
    ? 'x-webhook-signature'
    : 'x-flagright-signature'

  const fetchOptions = {
    method: 'POST',
    headers: {
      [header]: hmacSignatures,
      'content-type': 'application/json',
      'x-flagright-url': getApiBasePath(),
    },
    body: postPayloadString,
  }

  return fetchOptions
}

export async function simpleSendWebhookRequest(
  webhookDeliveryTask: WebhookDeliveryTask
): Promise<Response | undefined> {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()

  const tenantRepository = new TenantRepository(webhookDeliveryTask.tenantId, {
    dynamoDb,
  })
  const webhookRepository = new WebhookRepository(
    webhookDeliveryTask.tenantId,
    mongoDb
  )
  const webhookDeliveryRepository = new WebhookDeliveryRepository(
    webhookDeliveryTask.tenantId,
    mongoDb
  )
  const webhook = await webhookRepository.getWebhook(
    webhookDeliveryTask.webhookId
  )
  if (!webhook) {
    throw new Error('Webhook not found')
  }

  const secretKeys = await getWebhookSecrets(
    webhookDeliveryTask.tenantId,
    webhookDeliveryTask.webhookId
  )
  const settings = await tenantRepository.getTenantSettings([
    'webhookSettings',
    'auth0Domain',
    'features',
  ])

  const requestTimeoutSec = process.env.WEBHOOK_REQUEST_TIMEOUT_SEC
    ? Number(process.env.WEBHOOK_REQUEST_TIMEOUT_SEC)
    : 10
  const fetchOptions = {
    ...(await buildWebhookRequest(
      settings,
      getNotExpiredSecrets(secretKeys),
      webhookDeliveryTask
    )),
    signal: timeoutSignal(requestTimeoutSec * 1000),
  }
  const requestStartedAt = Date.now()
  let response: Response | undefined = undefined
  try {
    response = await abortableFetch(fetch).fetch(
      webhook.webhookUrl,
      fetchOptions
    )
    return response
  } catch (e) {
    logger.error(e)
    throw e
  } finally {
    const requestFinishedAt = Date.now()
    const success = response
      ? response.status >= 200 && response.status < 300
      : false

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
        body: isJsonString(fetchOptions.body)
          ? JSON.parse(fetchOptions.body)
          : fetchOptions.body,
      },
      entityId: webhookDeliveryTask.entityId,
      response: response
        ? {
            status: response.status,
            headers: JSON.stringify(response.headers),
            body: await response.text(),
          }
        : null,
      manualRetry: true,
    })
  }
}

export async function deliverWebhookEvent(
  webhook: WebhookConfiguration,
  secrets: string[],
  webhookDeliveryTask: WebhookDeliveryTask
) {
  const dynamoDb = getDynamoDbClient()
  const tenantRepository = new TenantRepository(webhookDeliveryTask.tenantId, {
    dynamoDb,
  })
  const mongoDb = await getMongoDbClient()
  const webhookDeliveryRepository = new WebhookDeliveryRepository(
    webhookDeliveryTask.tenantId,
    mongoDb
  )
  const webhookRetryRepository = new WebhookRetryRepository(
    webhookDeliveryTask.tenantId,
    mongoDb
  )

  const webhookRepository = new WebhookRepository(
    webhookDeliveryTask.tenantId,
    mongoDb
  )

  const settings = await tenantRepository.getTenantSettings([
    'webhookSettings',
    'auth0Domain',
    'features',
  ])
  const webhookSettings = settings.webhookSettings

  const requestTimeoutSec = process.env.WEBHOOK_REQUEST_TIMEOUT_SEC
    ? Number(process.env.WEBHOOK_REQUEST_TIMEOUT_SEC)
    : 10

  const fetchOptions = {
    ...(await buildWebhookRequest(settings, secrets, webhookDeliveryTask)),
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

    const retryOnlyFor = webhookSettings?.retryOnlyFor ?? []

    if (
      retryOnlyFor?.length &&
      !shouldRetryOnStatusCode((response as Response)?.status, retryOnlyFor)
    ) {
      logger.warn(
        `Webhook ${webhookDeliveryTask.webhookId} will not retry as the status code ${response?.status} is not in the retryOnlyFor list`
      )

      return
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

      const hoursForRetry = webhookSettings?.maxRetryHours ?? MAX_RETRY_HOURS

      if (retryHours >= hoursForRetry) {
        logger.warn(
          `Failed to deliver event ${webhookDeliveryTask.event} to ${webhook.webhookUrl} after ${hoursForRetry} hours. Will not retry`
        )

        const maxRetryReachedAction =
          webhookSettings?.maxRetryReachedAction ?? ''

        if (
          !maxRetryReachedAction ||
          maxRetryReachedAction === 'DISABLE_WEBHOOK'
        ) {
          await Promise.all([
            webhookRepository.disableWebhook(
              webhook,
              `Automatically deactivated at ${dayjs().format()} by the system as it has reached the maximum retry limit (${hoursForRetry} hours)`
            ),
            webhookRetryRepository.deleteWebhookRetryEvent(
              webhookDeliveryTask._id
            ),
          ])
        }

        logger.warn(
          `Failed to deliver event ${webhookDeliveryTask.event} to ${
            webhook.webhookUrl
          } after ${hoursForRetry} hours. Will not retry action: ${humanizeConstant(
            maxRetryReachedAction
          )}`
        )
      } else {
        if (webhookSettings?.retryBackoffStrategy === 'EXPONENTIAL') {
          // In Exponential we need to retry with a delay so we will add it to the mongo collection
          await handleExponentialRetry(
            webhookDeliveryTask,
            webhookRetryRepository
          )
        } else {
          throw new ClientServerError(retryErrorMessage)
        }
      }
    }
  } catch (e) {
    logger.warn(`Failed to deliver event: ${(e as Error).message}`)

    if ((e as any)?.name === 'AbortError') {
      // We don't retry if customer server fails to respond before the timeout
      logger.warn(`Request timeout after ${requestTimeoutSec} seconds`)
      return
    }

    if ((e as any)?.type === 'aborted') {
      // We don't retry if customer server fails to respond before the timeout
      logger.warn(`Request timeout after ${requestTimeoutSec} seconds`)
      return
    }

    if (e instanceof FetchError) {
      if (webhookSettings?.retryBackoffStrategy === 'EXPONENTIAL') {
        await handleExponentialRetry(
          webhookDeliveryTask,
          webhookRetryRepository
        )
      } else {
        throw new ClientServerError(
          `Client server failed to respond. Will retry`
        )
      }
    } else {
      throw e
    }
  } finally {
    const requestFinishedAt = Date.now()
    const success = response
      ? response.status >= 200 && response.status < 300
      : false
    if (success) {
      await webhookRetryRepository.deleteWebhookRetryEvent(
        webhookDeliveryTask._id
      )
      logger.info('Successfully delivered event')
    } else {
      logger.warn(`Failed to deliver event`)
    }
    const requestBody = JSON.parse(fetchOptions.body)
    await webhookDeliveryRepository.addWebhookDeliveryAttempt({
      _id: uuidv4(),
      deliveryTaskId: webhookDeliveryTask._id,
      webhookId: webhookDeliveryTask.webhookId,
      webhookUrl: webhook.webhookUrl,
      requestStartedAt,
      requestFinishedAt,
      success,
      event: webhookDeliveryTask.event,
      entityId: webhookDeliveryTask.entityId,
      eventCreatedAt: webhookDeliveryTask.createdAt,
      request: {
        headers: fetchOptions.headers,
        body: requestBody,
      },
      response: response
        ? {
            status: response.status,
            headers: JSON.stringify(response.headers),
            body: await response.text(),
          }
        : null,
      manualRetry: false,
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
            await initializeTenantContext(webhookDeliveryTask.tenantId)
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

async function handleExponentialRetry(
  webhookDeliveryTask: WebhookDeliveryTask,
  webhookRetryRepository: WebhookRetryRepository
) {
  const webhookRetryEvent = await webhookRetryRepository.getWebhookRetryEvent(
    webhookDeliveryTask._id
  )

  const MAX_RETRY_MINUTES = 360 // 6 hours

  const lastRetryMinutes = webhookRetryEvent?.lastRetryMinutes || 0
  let newRetryMinutes: number = 0

  logger.debug(`Last retry minutes: ${lastRetryMinutes}`)

  if (lastRetryMinutes === 0) {
    newRetryMinutes = 10
  } else {
    const tempNewRetryMinutes = lastRetryMinutes * 2
    newRetryMinutes = Math.min(MAX_RETRY_MINUTES, tempNewRetryMinutes)
  }

  const now = Date.now()

  await webhookRetryRepository.addOrUpdateWebhookRetryEvent({
    eventId: webhookDeliveryTask._id,
    task: webhookDeliveryTask,
    lastRetryAt: now,
    retryAfter: dayjs(now)
      .add(newRetryMinutes - 1, 'minute')
      .valueOf(), // -1 because we want cron job doesn't skip the first retry
    lastRetryMinutes: newRetryMinutes,
  })
}

export function shouldRetryOnStatusCode(
  statusCode: number,
  retryOnlyFor: WebhookRetryOnlyFor[]
) {
  const derivedStatusCode =
    statusCode >= 300 && statusCode < 400
      ? '3XX'
      : statusCode >= 400 && statusCode < 500
      ? '4XX'
      : '5XX'

  return retryOnlyFor.includes(derivedStatusCode as WebhookRetryOnlyFor)
}
