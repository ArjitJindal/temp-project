import { KinesisStreamEvent } from 'aws-lambda'
import { SendMessageCommand } from '@aws-sdk/client-sqs'
import { PutRecordCommand } from '@aws-sdk/client-kinesis'
import { WebhookRepository } from '../repositories/webhook-repository'
import { getTestUser } from '@/test-utils/user-test-utils'
import { createKinesisStreamEvent } from '@/utils/local-dynamodb-change-handler'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { WebhookConfiguration } from '@/@types/openapi-internal/WebhookConfiguration'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

dynamoDbSetupHook()

describe('Create webhook delivery tasks', () => {
  let tarponChangeCaptureHandler: (event: KinesisStreamEvent) => void
  let mockSqsSend = jest.fn()
  const mockKinesisSend = jest.fn()
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
    jest.mock('@aws-sdk/client-kinesis', () => {
      return {
        ...jest.requireActual('@aws-sdk/client-kinesis'),
        KinesisClient: class {
          send(command: PutRecordCommand) {
            mockKinesisSend(command)
            return { SequenceNumber: 'mock-sequence-number' }
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
      await getMongoDbClient()
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
      createdAt: Date.now(),
      webhookUrl: 'https://example.com',
      events: ['USER_STATE_UPDATED'],
      enabled: true,
    }
    await webhookRepository.saveWebhook(webhook)

    await tarponChangeCaptureHandler(event)

    expect(mockSqsSend).toHaveBeenCalledTimes(1)
    const command = mockSqsSend.mock.calls[0][0] as SendMessageCommand
    expect(command.input.QueueUrl).toBe(MOCK_WEBHOOK_DELIVERY_QUEUE_URL)
    const messageBody = JSON.parse(command.input.MessageBody as string)
    expect(messageBody).toMatchObject({
      event: 'USER_STATE_UPDATED',
      payload: {
        userId: user.userId,
        reason: 'reason',
        state: 'DELETED',
      },
      _id: expect.any(String),
      tenantId: TEST_TENANT_ID,
      webhookId: webhook._id,
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
      await getMongoDbClient()
    )
    const webhook: WebhookConfiguration = {
      _id: 'webhook_id',
      createdAt: Date.now(),
      webhookUrl: 'https://example.com',
      events: ['USER_STATE_UPDATED'],
      enabled: true,
    }
    await webhookRepository.saveWebhook(webhook)
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

  test('Send to retry stream in case of failure', async () => {
    mockSqsSend = jest.fn().mockImplementation(() => {
      throw new Error('Intentional Error')
    })
    const TEST_TENANT_ID = getTestTenantId()
    const webhookRepository = new WebhookRepository(
      TEST_TENANT_ID,
      await getMongoDbClient()
    )
    const webhook: WebhookConfiguration = {
      _id: 'webhook_id',
      createdAt: Date.now(),
      webhookUrl: 'https://example.com',
      events: ['USER_STATE_UPDATED'],
      enabled: true,
    }
    await webhookRepository.saveWebhook(webhook)
    const user = getTestUser({
      userStateDetails: {
        reason: 'reason',
        state: 'DELETED',
      },
    })
    const event = createKinesisStreamEvent(
      `${TEST_TENANT_ID}#user#primary`,
      user.userId,
      null,
      user
    )

    await tarponChangeCaptureHandler(event)

    expect(mockKinesisSend).toHaveBeenCalledTimes(1)
    const command = mockKinesisSend.mock.calls[0][0] as PutRecordCommand
    expect(command.input.StreamName).toEqual('mock-retry-stream')
    expect(command.input.Data).toEqual(
      Buffer.from(event.Records[0].kinesis.data, 'base64')
    )
  })
})
