import 'aws-sdk-client-mock-jest'
import { createHmac } from 'crypto'
import { SQSEvent } from 'aws-lambda'
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager'
import express from 'express'
import bodyParser from 'body-parser'
import { AwsStub, mockClient } from 'aws-sdk-client-mock'
import { WebhookRepository } from '../../../services/webhook/repositories/webhook-repository'
import { webhookDeliveryHandler as handler } from '../app'
import { getWebhookDeliveryRepository, getWebhookRepository } from './utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { WebhookDeliveryAttempt } from '@/@types/openapi-internal/WebhookDeliveryAttempt'
import { WebhookEvent } from '@/@types/openapi-public/WebhookEvent'
import { WebhookDeliveryTask } from '@/@types/webhook'
import { WebhookEventType } from '@/@types/openapi-internal/WebhookEventType'
import { createSqsEvent } from '@/test-utils/sqs-test-utils'
import dayjs from '@/utils/dayjs'
import * as TenantUtils from '@/utils/tenant'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { WebhookRetryRepository } from '@/services/webhook/repositories/webhook-retry-repository'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { retryWebhookTasks } from '@/services/webhook/utils'
import { withFeaturesToggled } from '@/test-utils/feature-test-utils'
import { withLocalChangeHandler } from '@/utils/local-change-handler'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const getPort = require('get-port')

const MOCK_SECRET_KEY = 'MOCK_SECRET_KEY'

dynamoDbSetupHook()

async function startTestWebhookServer(
  response: { status: number; headers: { [key: string]: any }; body: string },
  callback: (headers: any, payload: any) => Promise<any>
): Promise<string> {
  const app = express()
  const port = await getPort()
  app.use(bodyParser.json())
  app.post('/', async (req, res) => {
    await callback(req.headers, req.body)
    Object.entries(response.headers).forEach((entry) => {
      res.set(entry[0], entry[1])
    })
    res.status(response.status)
    res.send(response.body)
  })
  app.listen(port)
  return `http://localhost:${port}`
}

function getExpectedRequestHeaders(
  payload: any,
  isWhitelabelAuth0Domain: boolean = false
) {
  const hmac = createHmac('sha256', MOCK_SECRET_KEY)
  hmac.update(JSON.stringify(payload))
  const receiverCalculatedSignature = hmac.digest('hex')

  return {
    'content-type': 'application/json',
    [isWhitelabelAuth0Domain ? 'x-webhook-signature' : 'x-flagright-signature']:
      receiverCalculatedSignature,
  }
}

function getExpectedPayload(deliveryTask: WebhookDeliveryTask): WebhookEvent {
  return {
    id: deliveryTask._id,
    type: deliveryTask.event as WebhookEventType,
    data: deliveryTask.payload,
    createdTimestamp: deliveryTask.createdAt,
    triggeredBy: deliveryTask.triggeredBy,
  }
}

withLocalChangeHandler()
withFeaturesToggled([], ['CLICKHOUSE_ENABLED', 'CLICKHOUSE_MIGRATION'], () => {
  describe('Webhook delivery', () => {
    const ACTIVE_WEBHOOK_ID = 'ACTIVE_WEBHOOK_ID'
    const INACTIVE_WEBHOOK_ID = 'INACTIVE_WEBHOOK_ID'
    const webhookDeliveryHandler = handler as any as (
      event: SQSEvent
    ) => Promise<void>

    let smMock: AwsStub<any, any, any>

    beforeEach(() => {
      smMock = mockClient(SecretsManagerClient)
        .on(GetSecretValueCommand)
        .resolves({
          SecretString: JSON.stringify({
            [MOCK_SECRET_KEY]: null,
          }),
        })
    })

    describe('Enabled webhook', () => {
      for (const isWhitelabelAuth0Domain of [true, false]) {
        test(`POST to external webhook server with correct payload and headers (isWhitelabelAuth0Domain=${isWhitelabelAuth0Domain})`, async () => {
          const TEST_TENANT_ID = getTestTenantId()
          const webhookDeliveryRepository = await getWebhookDeliveryRepository(
            TEST_TENANT_ID
          )
          jest
            .spyOn(TenantUtils, 'isWhitelabeledTenantFromSettings')
            .mockReturnValue(isWhitelabelAuth0Domain)

          let receivedPayload = undefined
          let receivedHeaders = undefined
          const webhookUrl = await startTestWebhookServer(
            {
              status: 200,
              headers: {
                foo: 'bar',
              },
              body: 'OK',
            },
            async (headers, payload) => {
              receivedHeaders = headers
              receivedPayload = payload
            }
          )
          const webhookRepository = await getWebhookRepository(TEST_TENANT_ID)
          await webhookRepository.saveWebhook({
            _id: ACTIVE_WEBHOOK_ID,
            webhookUrl: webhookUrl,
            events: ['USER_STATE_UPDATED'],
            enabled: true,
          })

          const deliveryTask: WebhookDeliveryTask = {
            event: 'USER_STATE_UPDATED',
            entityId: 'entity_id',
            payload: { statusReason: 'reason', status: 'DELETED' },
            _id: 'task_id',
            tenantId: TEST_TENANT_ID,
            webhookId: ACTIVE_WEBHOOK_ID,
            createdAt: Date.now(),
            triggeredBy: 'SYSTEM',
          }
          const expectedPayload = getExpectedPayload(deliveryTask)
          await webhookDeliveryHandler(createSqsEvent([deliveryTask]))

          const command =
            smMock.commandCalls(GetSecretValueCommand)[1]?.firstArg ??
            smMock.commandCalls(GetSecretValueCommand)[0].firstArg
          expect(command.input.SecretId).toEqual(
            `${TEST_TENANT_ID}/webhooks/${deliveryTask.webhookId}`
          )

          // Check headers
          const expectedReceivedHeaders = getExpectedRequestHeaders(
            receivedPayload,
            isWhitelabelAuth0Domain
          )
          expect(receivedHeaders).toMatchObject(expectedReceivedHeaders)

          // Check payload
          expect(receivedPayload).toEqual(expectedPayload)

          // Check webhook delivery history
          const attempt =
            (await webhookDeliveryRepository.getLatestWebhookDeliveryAttempt(
              deliveryTask._id
            )) as WebhookDeliveryAttempt
          expect(attempt).toMatchObject({
            deliveryTaskId: deliveryTask._id,
            event: deliveryTask.event,
            eventCreatedAt: deliveryTask.createdAt,
            requestStartedAt: expect.any(Number),
            requestFinishedAt: expect.any(Number),
            request: {
              headers: expectedReceivedHeaders,
              body: receivedPayload,
            },
          })
          expect(attempt.response?.status).toEqual(200)
          expect(attempt.response?.body).toEqual('OK')
        })
      }
      test('POST to invalid webhook server should throw error', async () => {
        const TEST_TENANT_ID = getTestTenantId()
        const webhookDeliveryRepository = await getWebhookDeliveryRepository(
          TEST_TENANT_ID
        )
        const webhookRepository = new WebhookRepository(
          TEST_TENANT_ID,
          await getMongoDbClient()
        )
        await webhookRepository.saveWebhook({
          _id: ACTIVE_WEBHOOK_ID,
          webhookUrl: 'http://foo',
          events: ['USER_STATE_UPDATED'],
          enabled: true,
        })

        const deliveryTask: WebhookDeliveryTask = {
          event: 'USER_STATE_UPDATED',
          entityId: 'entity_id',
          payload: {},
          _id: 'task_id',
          tenantId: TEST_TENANT_ID,
          webhookId: ACTIVE_WEBHOOK_ID,
          createdAt: Date.now(),
          triggeredBy: 'SYSTEM',
        }
        const expectedPayload = getExpectedPayload(deliveryTask)
        await expect(
          webhookDeliveryHandler(createSqsEvent([deliveryTask]))
        ).rejects.toThrow()

        // Check webhook delivery history
        const attempt =
          (await webhookDeliveryRepository.getLatestWebhookDeliveryAttempt(
            deliveryTask._id
          )) as WebhookDeliveryAttempt
        expect(attempt).toMatchObject({
          deliveryTaskId: deliveryTask._id,
          event: deliveryTask.event,
          eventCreatedAt: deliveryTask.createdAt,
          requestStartedAt: expect.any(Number),
          requestFinishedAt: expect.any(Number),
          request: {
            headers: getExpectedRequestHeaders(expectedPayload),
            body: expectedPayload,
          },
          response: null,
        })
      })

      test('webhook server returns status 3xx-5xx should throw error', async () => {
        const TEST_TENANT_ID = getTestTenantId()
        const webhookUrl = await startTestWebhookServer(
          {
            status: 301,
            headers: {},
            body: 'ERROR',
          },
          async () => null
        )
        const webhookRepository = await getWebhookRepository(TEST_TENANT_ID)
        await webhookRepository.saveWebhook({
          _id: ACTIVE_WEBHOOK_ID,
          webhookUrl,
          events: ['USER_STATE_UPDATED'],
          enabled: true,
        })
        const deliveryTask = {
          event: 'USER_STATE_UPDATED',
          payload: {},
          _id: 'task_id',
          tenantId: TEST_TENANT_ID,
          webhookId: ACTIVE_WEBHOOK_ID,
          createdAt: Date.now(),
        }
        await expect(
          webhookDeliveryHandler(createSqsEvent([deliveryTask]))
        ).rejects.toThrow()
      })

      test('webhook server returns status 600 should not throw error', async () => {
        const TEST_TENANT_ID = getTestTenantId()
        const webhookUrl = await startTestWebhookServer(
          {
            status: 600,
            headers: {},
            body: 'ERROR',
          },
          async () => null
        )
        const webhookRepository = await getWebhookRepository(TEST_TENANT_ID)
        await webhookRepository.saveWebhook({
          _id: ACTIVE_WEBHOOK_ID,
          webhookUrl,
          events: ['USER_STATE_UPDATED'],
          enabled: true,
        })
        const deliveryTask = {
          event: 'USER_STATE_UPDATED',
          payload: {},
          _id: 'task_id',
          tenantId: TEST_TENANT_ID,
          webhookId: ACTIVE_WEBHOOK_ID,
          webhookUrl,
          createdAt: Date.now(),
        }

        // Should not throw
        await webhookDeliveryHandler(createSqsEvent([deliveryTask]))
      })

      test('webhook server failing to respond in WEBHOOK_REQUEST_TIMEOUT_SEC seconds should not throw error', async () => {
        const TEST_TENANT_ID = getTestTenantId()
        const webhookUrl = await startTestWebhookServer(
          {
            status: 200,
            headers: {},
            body: 'OK',
          },
          async () => {
            await new Promise((resolve) =>
              setTimeout(
                resolve,
                Number(process.env.WEBHOOK_REQUEST_TIMEOUT_SEC ?? 10) * 2 * 1000
              )
            )
          }
        )
        const webhookRepository = await getWebhookRepository(TEST_TENANT_ID)
        await webhookRepository.saveWebhook({
          _id: ACTIVE_WEBHOOK_ID,
          webhookUrl,
          events: ['USER_STATE_UPDATED'],
          enabled: true,
        })
        const deliveryTask = {
          event: 'USER_STATE_UPDATED',
          payload: {},
          _id: 'task_id',
          tenantId: TEST_TENANT_ID,
          webhookId: ACTIVE_WEBHOOK_ID,
          webhookUrl,
          createdAt: Date.now(),
        }
        await webhookDeliveryHandler(createSqsEvent([deliveryTask]))
      })

      test('Stop retrying after 24 hours (96 hours for production)', async () => {
        const TEST_TENANT_ID = getTestTenantId()
        const webhookUrl = await startTestWebhookServer(
          { status: 301, headers: {}, body: 'ERROR' },
          async () => null
        )

        const deliveryTask = {
          event: 'USER_STATE_UPDATED',
          payload: {},
          _id: 'task_id',
          tenantId: TEST_TENANT_ID,
          webhookId: ACTIVE_WEBHOOK_ID,
          createdAt: Date.now(),
        }

        const webhookDeliveryRepository = await getWebhookDeliveryRepository(
          TEST_TENANT_ID
        )

        const webhookRepository = await getWebhookRepository(TEST_TENANT_ID)

        await webhookRepository.saveWebhook({
          _id: ACTIVE_WEBHOOK_ID,
          webhookUrl,
          events: ['USER_STATE_UPDATED'],
          enabled: true,
        })

        await webhookDeliveryRepository.addWebhookDeliveryAttempt({
          _id: '1',
          deliveryTaskId: deliveryTask._id,
          entityId: 'entity_id',
          webhookId: ACTIVE_WEBHOOK_ID,
          webhookUrl: webhookUrl,
          requestStartedAt: dayjs().subtract(1, 'day').valueOf(),
          requestFinishedAt: dayjs().subtract(1, 'day').valueOf(),
          success: false,
          event: 'USER_STATE_UPDATED',
          eventCreatedAt: dayjs().subtract(1, 'day').valueOf(),
          request: {},
        })

        await webhookDeliveryHandler(createSqsEvent([deliveryTask]))

        expect(
          (await webhookRepository.getWebhook(ACTIVE_WEBHOOK_ID))?.enabled
        ).toBe(false)
      })

      test('Keep retrying before 24 hours (96 hours for production)', async () => {
        const TEST_TENANT_ID = getTestTenantId()
        const webhookUrl = await startTestWebhookServer(
          { status: 301, headers: {}, body: 'ERROR' },
          async () => null
        )
        const deliveryTask = {
          event: 'USER_STATE_UPDATED',
          payload: {},
          _id: 'task_id',
          tenantId: TEST_TENANT_ID,
          webhookId: ACTIVE_WEBHOOK_ID,
          createdAt: Date.now(),
        }
        const webhookDeliveryRepository = await getWebhookDeliveryRepository(
          TEST_TENANT_ID
        )
        const webhookRepository = await getWebhookRepository(TEST_TENANT_ID)
        await webhookRepository.saveWebhook({
          _id: ACTIVE_WEBHOOK_ID,
          webhookUrl,
          events: ['USER_STATE_UPDATED'],
          enabled: true,
        })
        await webhookDeliveryRepository.addWebhookDeliveryAttempt({
          _id: '1',
          deliveryTaskId: deliveryTask._id,
          entityId: 'entity_id',
          webhookId: ACTIVE_WEBHOOK_ID,
          webhookUrl: webhookUrl,
          requestStartedAt: dayjs().subtract(12, 'hour').valueOf(),
          requestFinishedAt: dayjs().subtract(12, 'hour').valueOf(),
          success: false,
          event: 'USER_STATE_UPDATED',
          eventCreatedAt: dayjs().subtract(12, 'hour').valueOf(),
          request: {},
        })
        await expect(
          webhookDeliveryHandler(createSqsEvent([deliveryTask]))
        ).rejects.toThrow()
        expect(
          (await webhookRepository.getWebhook(ACTIVE_WEBHOOK_ID))?.enabled
        ).toBe(true)
      })
    })
    describe('Invalid webhook', () => {
      test('Skip non-existent webhook', async () => {
        const TEST_TENANT_ID = getTestTenantId()
        const webhookDeliveryRepository = await getWebhookDeliveryRepository(
          TEST_TENANT_ID
        )
        const deliveryTask = {
          event: 'USER_STATE_UPDATED',
          payload: {},
          _id: 'task_id',
          tenantId: TEST_TENANT_ID,
          webhookId: 'ghost-webhook-id',
          createdAt: Date.now(),
        }
        await webhookDeliveryHandler(createSqsEvent([deliveryTask]))
        expect(
          await webhookDeliveryRepository.getWebhookDeliveryAttempts(
            'ghost-webhook-id',
            { page: 1, pageSize: 20, webhookId: 'ghost-webhook-id' }
          )
        ).toHaveLength(0)
      })
      test('Skip disabled webhook', async () => {
        const TEST_TENANT_ID = getTestTenantId()
        const webhookDeliveryRepository = await getWebhookDeliveryRepository(
          TEST_TENANT_ID
        )
        const webhookRepository = await getWebhookRepository(TEST_TENANT_ID)
        await webhookRepository.saveWebhook({
          _id: INACTIVE_WEBHOOK_ID,
          webhookUrl: 'http://foo',
          events: ['USER_STATE_UPDATED'],
          enabled: false,
        })
        const deliveryTask = {
          event: 'USER_STATE_UPDATED',
          payload: {},
          _id: 'task_id',
          tenantId: TEST_TENANT_ID,
          webhookId: INACTIVE_WEBHOOK_ID,
          createdAt: Date.now(),
        }
        await webhookDeliveryHandler(createSqsEvent([deliveryTask]))
        expect(
          await webhookDeliveryRepository.getWebhookDeliveryAttempts(
            INACTIVE_WEBHOOK_ID,
            { page: 1, pageSize: 20, webhookId: INACTIVE_WEBHOOK_ID }
          )
        ).toHaveLength(0)
      })
      test("Skip webhook if the events don't include the task event", async () => {
        const TEST_TENANT_ID = getTestTenantId()
        const webhookDeliveryRepository = await getWebhookDeliveryRepository(
          TEST_TENANT_ID
        )
        const webhookRepository = await getWebhookRepository(TEST_TENANT_ID)
        await webhookRepository.saveWebhook({
          _id: ACTIVE_WEBHOOK_ID,
          webhookUrl: 'http://foo',
          events: [],
          enabled: true,
        })
        const deliveryTask = {
          event: 'USER_STATE_UPDATED',
          payload: {},
          _id: 'task_id',
          tenantId: TEST_TENANT_ID,
          webhookId: ACTIVE_WEBHOOK_ID,
          createdAt: Date.now(),
        }
        await webhookDeliveryHandler(createSqsEvent([deliveryTask]))
        expect(
          await webhookDeliveryRepository.getWebhookDeliveryAttempts(
            INACTIVE_WEBHOOK_ID,
            { page: 1, pageSize: 20, webhookId: INACTIVE_WEBHOOK_ID }
          )
        ).toHaveLength(0)
      })
    })

    describe('Webhook delivery attempt when settings are configured on faliure', () => {
      test('Exponential backoff should add to webhook retry repository', async () => {
        jest
          .spyOn(TenantRepository.prototype, 'getTenantSettings')
          .mockResolvedValue({
            webhookSettings: {
              retryBackoffStrategy: 'EXPONENTIAL',
              maxRetryHours: 24,
              retryOnlyFor: ['3XX'],
              maxRetryReachedAction: 'DISABLE_WEBHOOK',
            },
          })
        const TEST_TENANT_ID = getTestTenantId()
        const webhookDeliveryRepository = await getWebhookDeliveryRepository(
          TEST_TENANT_ID
        )
        const webhookUrl = await startTestWebhookServer(
          { status: 301, headers: {}, body: 'ERROR' },
          async () => null
        )

        const webhookRepository = await getWebhookRepository(TEST_TENANT_ID)

        await webhookRepository.saveWebhook({
          _id: ACTIVE_WEBHOOK_ID,
          webhookUrl,
          events: ['USER_STATE_UPDATED'],
          enabled: true,
        })

        const deliveryTask = {
          event: 'USER_STATE_UPDATED',
          payload: {},
          _id: 'task_id',
          tenantId: TEST_TENANT_ID,
          webhookId: ACTIVE_WEBHOOK_ID,
          createdAt: Date.now(),
        }

        await webhookDeliveryHandler(createSqsEvent([deliveryTask]))

        const attempts =
          await webhookDeliveryRepository.getWebhookDeliveryAttempts(
            ACTIVE_WEBHOOK_ID,
            { page: 1, pageSize: 20, webhookId: ACTIVE_WEBHOOK_ID }
          )

        expect(attempts).toHaveLength(1)

        const webhookRetryRepository = new WebhookRetryRepository(
          TEST_TENANT_ID,
          await getMongoDbClient()
        )

        const time = dayjs().add(10, 'minutes').valueOf()
        const retries = await webhookRetryRepository.getAllWebhookRetryEvents(
          time
        )

        expect(retries).toHaveLength(1)
        expect(retries[0].lastRetryMinutes).toEqual(10)

        await retryWebhookTasks(
          TEST_TENANT_ID,
          retries.map((r) => r.task)
        )

        const time2 = dayjs().add(20, 'minutes').valueOf()
        const newRetries =
          await webhookRetryRepository.getAllWebhookRetryEvents(time2)

        expect(newRetries).toHaveLength(1)
        expect(newRetries[0].lastRetryMinutes).toEqual(20)
      })

      test('Linear backoff should not add to webhook retry repository', async () => {
        jest
          .spyOn(TenantRepository.prototype, 'getTenantSettings')
          .mockResolvedValue({
            webhookSettings: {
              retryBackoffStrategy: 'LINEAR',
              maxRetryHours: 24,
              retryOnlyFor: ['3XX'],
              maxRetryReachedAction: 'DISABLE_WEBHOOK',
            },
          })

        const TEST_TENANT_ID = getTestTenantId()
        const webhookDeliveryRepository = await getWebhookDeliveryRepository(
          TEST_TENANT_ID
        )

        const webhookUrl = await startTestWebhookServer(
          { status: 301, headers: {}, body: 'ERROR' },
          async () => null
        )

        const webhookRepository = await getWebhookRepository(TEST_TENANT_ID)

        await webhookRepository.saveWebhook({
          _id: ACTIVE_WEBHOOK_ID,
          webhookUrl,
          events: ['USER_STATE_UPDATED'],
          enabled: true,
        })

        const deliveryTask = {
          event: 'USER_STATE_UPDATED',
          payload: {},
          _id: 'task_id',
          tenantId: TEST_TENANT_ID,
          webhookId: ACTIVE_WEBHOOK_ID,
          createdAt: Date.now(),
        }

        const result = webhookDeliveryHandler(createSqsEvent([deliveryTask]))

        await expect(result).rejects.toThrow()

        const attempts =
          await webhookDeliveryRepository.getWebhookDeliveryAttempts(
            ACTIVE_WEBHOOK_ID,
            { page: 1, pageSize: 20, webhookId: ACTIVE_WEBHOOK_ID }
          )

        expect(attempts).toHaveLength(1)

        const webhookRetryRepository = new WebhookRetryRepository(
          TEST_TENANT_ID,
          await getMongoDbClient()
        )

        const time = dayjs().add(10, 'minutes').valueOf()

        const retries = await webhookRetryRepository.getAllWebhookRetryEvents(
          time
        )

        expect(retries).toHaveLength(0)
      })
    })
  })
})
