import { KinesisStreamEvent } from 'aws-lambda'
import { SendMessageCommand } from '@aws-sdk/client-sqs'
import { WebhookRepository } from '../repositories/webhook-repository'
import { getTestUser } from '@/test-utils/user-test-utils'
import { createKinesisStreamEvent } from '@/utils/local-dynamodb-change-handler'
import { connectToDB } from '@/utils/mongoDBUtils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { WebhookConfiguration } from '@/@types/webhook'

describe('Create webhook delivery tasks', () => {
  let tarponChangeCaptureHandler: (event: KinesisStreamEvent) => void
  const mockSqsSend = jest.fn()
  const MOCK_WEBHOOK_DELIVERY_QUEUE_URL = 'mock-sqs-queue-url'

  beforeAll(async () => {
    process.env.WEBHOOK_DELIVERY_QUEUE_URL = MOCK_WEBHOOK_DELIVERY_QUEUE_URL
    jest.mock('@aws-sdk/client-sqs', () => {
      return {
        ...jest.requireActual('@aws-sdk/client-sqs'),
        SQSClient: class {
          send(command: SendMessageCommand) {
            mockSqsSend(command)
          }
        },
      }
    })
    tarponChangeCaptureHandler = (
      await import('../tarpon-change-capture-handler')
    ).tarponChangeCaptureHandler as any as (event: KinesisStreamEvent) => void
  })

  afterEach(() => {
    mockSqsSend.mockClear()
  })

  test('Sends SQS meessage when there is an update and webhooks exist', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const webhookRepository = new WebhookRepository(
      TEST_TENANT_ID,
      await connectToDB()
    )
    const user = getTestUser()
    const event = createKinesisStreamEvent(
      `${TEST_TENANT_ID}#user#primary`,
      user.userId,
      user,
      {
        ...user,
        userStateDetails: {
          reason: 'reason',
          state: 'DELETED',
        },
      }
    )
    const webhook: WebhookConfiguration = {
      _id: 'webhook_id',
      created: Date.now(),
      webhookUrl: 'https://example.com',
      events: ['USER_STATUS_UPDATED'],
      enabled: true,
    }
    await webhookRepository.addWebhook(webhook)

    await tarponChangeCaptureHandler(event)

    expect(mockSqsSend).toHaveBeenCalledTimes(1)
    const command = mockSqsSend.mock.calls[0][0] as SendMessageCommand
    expect(command.input.QueueUrl).toBe(MOCK_WEBHOOK_DELIVERY_QUEUE_URL)
    const messageBody = JSON.parse(command.input.MessageBody as string)
    expect(messageBody).toMatchObject({
      event: 'USER_STATUS_UPDATED',
      payload: { reason: 'reason', state: 'DELETED' },
      _id: expect.any(String),
      tenantId: TEST_TENANT_ID,
      webhookId: webhook._id,
      webhookUrl: webhook.webhookUrl,
      createdAt: expect.any(Number),
    })
  })

  test("Don't send SQS meessage when there is an update but no webhooks exist", async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const user = getTestUser()
    const event = createKinesisStreamEvent(
      `${TEST_TENANT_ID}#user#primary`,
      user.userId,
      user,
      {
        ...user,
        userStateDetails: {
          reason: 'reason',
          state: 'DELETED',
        },
      }
    )

    await tarponChangeCaptureHandler(event)

    expect(mockSqsSend).toHaveBeenCalledTimes(0)
  })

  test("Don't send SQS meessage when there is not update but webhooks exist", async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const webhookRepository = new WebhookRepository(
      TEST_TENANT_ID,
      await connectToDB()
    )
    const webhook: WebhookConfiguration = {
      _id: 'webhook_id',
      created: Date.now(),
      webhookUrl: 'https://example.com',
      events: ['USER_STATUS_UPDATED'],
      enabled: true,
    }
    await webhookRepository.addWebhook(webhook)
    const user = getTestUser({
      userStateDetails: {
        reason: 'reason',
        state: 'DELETED',
      },
    })
    const event = createKinesisStreamEvent(
      `${TEST_TENANT_ID}#user#primary`,
      user.userId,
      user,
      user
    )

    await tarponChangeCaptureHandler(event)

    expect(mockSqsSend).toHaveBeenCalledTimes(0)
  })

  test("Don't send SQS meessage when there is not update and no webhooks exist", async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const user = getTestUser({
      userStateDetails: {
        reason: 'reason',
        state: 'DELETED',
      },
    })
    const event = createKinesisStreamEvent(
      `${TEST_TENANT_ID}#user#primary`,
      user.userId,
      user,
      user
    )

    await tarponChangeCaptureHandler(event)

    expect(mockSqsSend).toHaveBeenCalledTimes(0)
  })
})
