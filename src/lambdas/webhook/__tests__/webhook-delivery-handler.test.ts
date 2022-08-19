import { createHmac } from 'crypto'
import { SQSEvent, SQSRecord } from 'aws-lambda'
import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import express from 'express'
import bodyParser from 'body-parser'
import { WebhookDeliveryRepository } from '../repositories/webhook-delivery-repository'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { connectToDB } from '@/utils/mongoDBUtils'
import { WebhookDeliveryAttempt } from '@/@types/openapi-internal/WebhookDeliveryAttempt'

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

describe('Webhook delivery', () => {
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
    webhookDeliveryHandler = (await import('../webhook-delivery-handler'))
      .deliveryHandler as any as (event: SQSEvent) => void
  })

  afterEach(() => {
    mockSecretsManagerSend.mockClear()
  })

  test('POST to external webhook server with correct payload and headers', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const webhookDeliveryRepository = new WebhookDeliveryRepository(
      TEST_TENANT_ID,
      await connectToDB()
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

    const expectedPayload = { statusReason: 'reason', status: 'DELETED' }
    const deliveryTask = {
      event: 'USER_STATE_UPDATED',
      payload: expectedPayload,
      _id: 'task_id',
      tenantId: TEST_TENANT_ID,
      webhookId: 'webhook_id',
      webhookUrl,
      createdAt: Date.now(),
    }
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
      await connectToDB()
    )

    const deliveryTask = {
      event: 'USER_STATE_UPDATED',
      payload: {},
      _id: 'task_id',
      tenantId: TEST_TENANT_ID,
      webhookId: 'webhook_id',
      webhookUrl: 'http://foo',
      createdAt: Date.now(),
    }
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
    console.log(attempt)
    expect(attempt).toMatchObject({
      deliveryTaskId: deliveryTask._id,
      event: deliveryTask.event,
      eventCreatedAt: deliveryTask.createdAt,
      requestStartedAt: expect.any(Number),
      requestFinishedAt: expect.any(Number),
      request: {
        headers: getExpectedRequestHeaders({}),
        body: JSON.stringify({}),
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
    const deliveryTask = {
      event: 'USER_STATE_UPDATED',
      payload: {},
      _id: 'task_id',
      tenantId: TEST_TENANT_ID,
      webhookId: 'webhook_id',
      webhookUrl,
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
    const deliveryTask = {
      event: 'USER_STATE_UPDATED',
      payload: {},
      _id: 'task_id',
      tenantId: TEST_TENANT_ID,
      webhookId: 'webhook_id',
      webhookUrl,
      createdAt: Date.now(),
    }

    // Should not throw
    await webhookDeliveryHandler({
      Records: [{ body: JSON.stringify(deliveryTask) } as SQSRecord],
    })
  })

  test('webhook server failing to respond in WEBHOOK_REQUEST_TIMEOUT_SEC seconds should throw error', async () => {
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
    const deliveryTask = {
      event: 'USER_STATE_UPDATED',
      payload: {},
      _id: 'task_id',
      tenantId: TEST_TENANT_ID,
      webhookId: 'webhook_id',
      webhookUrl,
      createdAt: Date.now(),
    }
    await expect(
      webhookDeliveryHandler({
        Records: [{ body: JSON.stringify(deliveryTask) } as SQSRecord],
      })
    ).rejects.toThrow()
  })
})
