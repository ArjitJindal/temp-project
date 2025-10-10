import range from 'lodash/range'
import { bulkSendMessages } from '../sns-sqs-client'

const MOCK_QUEUE_URL = 'https://sqs.us-west-2.amazonaws.com/1234567890/my-queue'

describe('bulkSendMessages', () => {
  it('less than 10 entries', async () => {
    const sqsClient = {
      send: jest.fn().mockResolvedValue({}),
    }
    const batchRequestEntries = range(0, 5).map((i) => ({
      Id: `${i}`,
      MessageBody: `Message ${i}`,
    }))
    await bulkSendMessages(
      sqsClient as any,
      MOCK_QUEUE_URL,
      batchRequestEntries
    )

    expect(sqsClient.send).toBeCalledTimes(1)
    expect(sqsClient.send.mock.calls[0][0].input).toEqual({
      QueueUrl: MOCK_QUEUE_URL,
      Entries: batchRequestEntries,
    })
  })

  it('less than 10 entries, bigger than 256KB', async () => {
    const sqsClient = {
      send: jest.fn().mockResolvedValue({}),
    }
    const batchRequestEntries = range(0, 5).map((i) => ({
      Id: `${i}`,
      MessageBody: Buffer.alloc(100 * 1024, `${i}`).toString('utf8'),
    }))
    await bulkSendMessages(
      sqsClient as any,
      MOCK_QUEUE_URL,
      batchRequestEntries
    )

    expect(sqsClient.send).toBeCalledTimes(3)
    expect(sqsClient.send.mock.calls[0][0].input).toEqual({
      QueueUrl: MOCK_QUEUE_URL,
      Entries: batchRequestEntries.slice(0, 2),
    })
    expect(sqsClient.send.mock.calls[1][0].input).toEqual({
      QueueUrl: MOCK_QUEUE_URL,
      Entries: batchRequestEntries.slice(2, 4),
    })
    expect(sqsClient.send.mock.calls[2][0].input).toEqual({
      QueueUrl: MOCK_QUEUE_URL,
      Entries: batchRequestEntries.slice(4),
    })
  })

  it('more than 10 entries', async () => {
    const sqsClient = {
      send: jest.fn().mockResolvedValue({}),
    }
    const batchRequestEntries = range(0, 20).map((i) => ({
      Id: `${i}`,
      MessageBody: `Message ${i}`,
    }))
    await bulkSendMessages(
      sqsClient as any,
      MOCK_QUEUE_URL,
      batchRequestEntries
    )

    expect(sqsClient.send).toBeCalledTimes(2)
    expect(sqsClient.send.mock.calls[0][0].input).toEqual({
      QueueUrl: MOCK_QUEUE_URL,
      Entries: batchRequestEntries.slice(0, 10),
    })
    expect(sqsClient.send.mock.calls[1][0].input).toEqual({
      QueueUrl: MOCK_QUEUE_URL,
      Entries: batchRequestEntries.slice(10),
    })
  })

  it('more than 10 entries, > 256KB', async () => {
    const sqsClient = {
      send: jest.fn().mockResolvedValue({}),
    }
    const batchRequestEntries = range(0, 20).map((i) => ({
      Id: `${i}`,
      MessageBody: Buffer.alloc(30 * 1024, `${i}`).toString('utf8'),
    }))
    await bulkSendMessages(
      sqsClient as any,
      MOCK_QUEUE_URL,
      batchRequestEntries
    )

    expect(sqsClient.send).toBeCalledTimes(3)
    expect(sqsClient.send.mock.calls[0][0].input).toEqual({
      QueueUrl: MOCK_QUEUE_URL,
      Entries: batchRequestEntries.slice(0, 8),
    })
    expect(sqsClient.send.mock.calls[1][0].input).toEqual({
      QueueUrl: MOCK_QUEUE_URL,
      Entries: batchRequestEntries.slice(8, 16),
    })
    expect(sqsClient.send.mock.calls[2][0].input).toEqual({
      QueueUrl: MOCK_QUEUE_URL,
      Entries: batchRequestEntries.slice(16),
    })
  })
})
