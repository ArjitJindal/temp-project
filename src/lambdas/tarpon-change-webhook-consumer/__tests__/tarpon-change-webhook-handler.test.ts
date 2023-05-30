import { SendMessageBatchRequestEntry } from '@aws-sdk/client-sqs/dist-types/models/models_0'

const MOCK_WEBHOOK_DELIVERY_QUEUE_URL = 'mock-sqs-queue-url'
const MOCK_WEBHOOK_TARPON_CHANGE_CAPTURE_RETRY_QUEUE_URL =
  'mock-retry-sqs-queue-url'
process.env.WEBHOOK_DELIVERY_QUEUE_URL = MOCK_WEBHOOK_DELIVERY_QUEUE_URL
process.env.WEBHOOK_TARPON_CHANGE_CAPTURE_RETRY_QUEUE_URL =
  MOCK_WEBHOOK_TARPON_CHANGE_CAPTURE_RETRY_QUEUE_URL

import 'aws-sdk-client-mock-jest'
import { KinesisStreamEvent } from 'aws-lambda'
import { AwsStub, mockClient } from 'aws-sdk-client-mock'
import {
  SendMessageBatchCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs'
import { WebhookRepository } from '../../../services/webhook/repositories/webhook-repository'
import { tarponChangeWebhookHandler as handler } from '../app'
import { getTestUser } from '@/test-utils/user-test-utils'
import { createKinesisStreamEvent } from '@/utils/local-dynamodb-change-handler'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { WebhookConfiguration } from '@/@types/openapi-internal/WebhookConfiguration'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

dynamoDbSetupHook()

describe('Create webhook delivery tasks', () => {
  let sqsMock: AwsStub<any, any>
  const tarponChangeWebhookHandler = handler as any as (
    event: KinesisStreamEvent
  ) => void

  beforeEach(() => {
    sqsMock = mockClient(SQSClient)
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
      retryCount: 0,
    }
    await webhookRepository.saveWebhook(webhook)

    await tarponChangeWebhookHandler(event)

    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageBatchCommand, 1)
    const message = sqsMock.commandCalls(SendMessageBatchCommand)[0].firstArg
      .input
    expect(message.QueueUrl).toBe(MOCK_WEBHOOK_DELIVERY_QUEUE_URL)
    const entries = message.Entries as SendMessageBatchRequestEntry[]
    expect(JSON.parse(entries[0].MessageBody as string)).toMatchObject({
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

    await tarponChangeWebhookHandler(event)

    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageBatchCommand, 0)
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
      retryCount: 0,
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

    await tarponChangeWebhookHandler(event)

    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageBatchCommand, 0)
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

    await tarponChangeWebhookHandler(event)

    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageBatchCommand, 0)
  })

  test('Send to retry queue in case of failure', async () => {
    sqsMock.rejectsOnce()
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
      retryCount: 0,
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

    await tarponChangeWebhookHandler(event)

    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageBatchCommand, 1)
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: MOCK_WEBHOOK_TARPON_CHANGE_CAPTURE_RETRY_QUEUE_URL,
      MessageBody: JSON.stringify(event.Records[0]),
    })
  })
})
