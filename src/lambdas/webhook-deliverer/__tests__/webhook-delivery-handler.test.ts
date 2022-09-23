import { createHmac } from 'crypto'
import { SQSEvent, SQSRecord } from 'aws-lambda'
import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import express from 'express'
import bodyParser from 'body-parser'
import { WebhookDeliveryRepository } from '../../../services/webhook/repositories/webhook-delivery-repository'
import { WebhookRepository } from '../../../services/webhook/repositories/webhook-repository'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { WebhookDeliveryAttempt } from '@/@types/openapi-internal/WebhookDeliveryAttempt'
import { WebhookEvent } from '@/@types/openapi-public/WebhookEvent'
import { WebhookDeliveryTask } from '@/@types/webhook'
import { WebhookEventType } from '@/@types/openapi-internal/WebhookEventType'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const getPort = require('get-port')

const MOCK_SECRET_KEY = 'MOCK_SECRET_KEY'

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

function getExpectedRequestHeaders(payload: any) {
  const hmac = createHmac('sha256', MOCK_SECRET_KEY)
  hmac.update(JSON.stringify(payload))
  const receiverCalculatedSignature = hmac.digest('hex')
  return {
    'content-type': 'application/json',
    'x-flagright-signature': receiverCalculatedSignature,
  }
}

function getExpectedPayload(deliveryTask: WebhookDeliveryTask): WebhookEvent {
  return {
    id: deliveryTask._id,
    type: deliveryTask.event as WebhookEventType,
    data: deliveryTask.payload,
    createdTimestamp: deliveryTask.createdAt,
  }
}

describe('Webhook delivery', () => {
  const ACTIVE_WEBHOOK_ID = 'ACTIVE_WEBHOOK_ID'
  const INACTIVE_WEBHOOK_ID = 'INACTIVE_WEBHOOK_ID'
  const mockSecretsManagerSend = jest.fn().mockReturnValue({
    SecretString: JSON.stringify({
      [MOCK_SECRET_KEY]: null,
    }),
  })
  let webhookDeliveryHandler: (event: SQSEvent) => void

  beforeAll(async () => {
    process.env.WEBHOOK_REQUEST_TIMEOUT_SEC = '2'
    jest.mock('@aws-sdk/client-secrets-manager', () => {
      return {
        ...jest.requireActual('@aws-sdk/client-secrets-manager'),
        SecretsManagerClient: class {
          async send(command: GetSecretValueCommand) {
            return mockSecretsManagerSend(command)
          }
        },
      }
    })
    webhookDeliveryHandler = (await import('../app'))
      .webhookDeliveryHandler as any as (event: SQSEvent) => void
  })

  afterEach(() => {
    mockSecretsManagerSend.mockClear()
  })

  describe('Enabled webhook', () => {
    test('POST to external webhook server with correct payload and headers', async () => {
      const TEST_TENANT_ID = getTestTenantId()
      const webhookDeliveryRepository = new WebhookDeliveryRepository(
        TEST_TENANT_ID,
        await getMongoDbClient()
      )
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
      const webhookRepository = new WebhookRepository(
        TEST_TENANT_ID,
        await getMongoDbClient()
      )
      await webhookRepository.saveWebhook({
        _id: ACTIVE_WEBHOOK_ID,
        webhookUrl: webhookUrl,
        events: ['USER_STATE_UPDATED'],
        enabled: true,
      })

      const deliveryTask: WebhookDeliveryTask = {
        event: 'USER_STATE_UPDATED',
        payload: { statusReason: 'reason', status: 'DELETED' },
        _id: 'task_id',
        tenantId: TEST_TENANT_ID,
        webhookId: ACTIVE_WEBHOOK_ID,
        createdAt: Date.now(),
      }
      const expectedPayload = getExpectedPayload(deliveryTask)
      await webhookDeliveryHandler({
        Records: [{ body: JSON.stringify(deliveryTask) } as SQSRecord],
      })

      const command = mockSecretsManagerSend.mock
        .calls[0][0] as GetSecretValueCommand
      expect(command.input.SecretId).toEqual(
        `${TEST_TENANT_ID}/webhooks/${deliveryTask.webhookId}`
      )

      // Check headers
      const expectedReceivedHeaders = getExpectedRequestHeaders(receivedPayload)
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
          body: JSON.stringify(receivedPayload),
        },
      })
      expect(attempt.response?.status).toEqual(200)
      expect(attempt.response?.headers).toMatchObject({ foo: ['bar'] })
      expect(attempt.response?.body).toEqual('OK')
    })

    test('POST to invalid webhook server should throw error', async () => {
      const TEST_TENANT_ID = getTestTenantId()
      const webhookDeliveryRepository = new WebhookDeliveryRepository(
        TEST_TENANT_ID,
        await getMongoDbClient()
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
        payload: {},
        _id: 'task_id',
        tenantId: TEST_TENANT_ID,
        webhookId: ACTIVE_WEBHOOK_ID,
        createdAt: Date.now(),
      }
      const expectedPayload = getExpectedPayload(deliveryTask)
      await expect(
        webhookDeliveryHandler({
          Records: [{ body: JSON.stringify(deliveryTask) } as SQSRecord],
        })
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
          body: JSON.stringify(expectedPayload),
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
      const webhookRepository = new WebhookRepository(
        TEST_TENANT_ID,
        await getMongoDbClient()
      )
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
        webhookDeliveryHandler({
          Records: [{ body: JSON.stringify(deliveryTask) } as SQSRecord],
        })
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
      const webhookRepository = new WebhookRepository(
        TEST_TENANT_ID,
        await getMongoDbClient()
      )
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
      await webhookDeliveryHandler({
        Records: [{ body: JSON.stringify(deliveryTask) } as SQSRecord],
      })
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
              Number(process.env.WEBHOOK_REQUEST_TIMEOUT_SEC) * 2 * 1000
            )
          )
        }
      )
      const webhookRepository = new WebhookRepository(
        TEST_TENANT_ID,
        await getMongoDbClient()
      )
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
      await webhookDeliveryHandler({
        Records: [{ body: JSON.stringify(deliveryTask) } as SQSRecord],
      })
    })
  })
  describe('Invalid webhook', () => {
    test('Skip non-existent webhook', async () => {
      const TEST_TENANT_ID = getTestTenantId()
      const webhookDeliveryRepository = new WebhookDeliveryRepository(
        TEST_TENANT_ID,
        await getMongoDbClient()
      )
      const deliveryTask = {
        event: 'USER_STATE_UPDATED',
        payload: {},
        _id: 'task_id',
        tenantId: TEST_TENANT_ID,
        webhookId: 'ghost-webhook-id',
        createdAt: Date.now(),
      }
      await webhookDeliveryHandler({
        Records: [{ body: JSON.stringify(deliveryTask) } as SQSRecord],
      })
      expect(
        await webhookDeliveryRepository.getWebhookDeliveryAttempts(
          'ghost-webhook-id',
          1
        )
      ).toHaveLength(0)
    })
    test('Skip disabled webhook', async () => {
      const TEST_TENANT_ID = getTestTenantId()
      const webhookDeliveryRepository = new WebhookDeliveryRepository(
        TEST_TENANT_ID,
        await getMongoDbClient()
      )
      const webhookRepository = new WebhookRepository(
        TEST_TENANT_ID,
        await getMongoDbClient()
      )
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
      await webhookDeliveryHandler({
        Records: [{ body: JSON.stringify(deliveryTask) } as SQSRecord],
      })
      expect(
        await webhookDeliveryRepository.getWebhookDeliveryAttempts(
          INACTIVE_WEBHOOK_ID,
          1
        )
      ).toHaveLength(0)
    })
    test("Skip webhook if the events don't include the task event", async () => {
      const TEST_TENANT_ID = getTestTenantId()
      const webhookDeliveryRepository = new WebhookDeliveryRepository(
        TEST_TENANT_ID,
        await getMongoDbClient()
      )
      const webhookRepository = new WebhookRepository(
        TEST_TENANT_ID,
        await getMongoDbClient()
      )
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
      await webhookDeliveryHandler({
        Records: [{ body: JSON.stringify(deliveryTask) } as SQSRecord],
      })
      expect(
        await webhookDeliveryRepository.getWebhookDeliveryAttempts(
          INACTIVE_WEBHOOK_ID,
          1
        )
      ).toHaveLength(0)
    })
  })
})
