import { wrap, reduce, last, sumBy, initial } from 'lodash'
import { SNSClient } from '@aws-sdk/client-sns'
import {
  SendMessageBatchCommand,
  SendMessageBatchRequestEntry,
  SQSClient,
} from '@aws-sdk/client-sqs'
import { logger } from '@/core/logger'
import { addSentryExtras } from '@/core/utils/context'

interface SenderClient {
  send: (command: any, options: any) => Promise<any>
}

function getRefreshingClient<T extends SenderClient>(client: T): T {
  client.send = wrap(
    client.send.bind(client),
    async (func: any, command: any, ...args: any) => {
      try {
        return await func(command, ...args)
      } catch (e: any) {
        if ((e as any)?.name === 'ExpiredTokenException') {
          // refresh credentials
          logger.info('Refreshing AWS credentials')
          const credentials = {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
            sessionToken: process.env.AWS_SESSION_TOKEN as string,
          }
          const retryClient = new (client.constructor({
            credentials,
          }))()
          return await retryClient(command, ...args)
        }
        throw e
      }
    }
  ) as any
  return client
}

export function getSNSClient(): SNSClient {
  const client = new SNSClient({})
  if (!process.env.ASSUME_ROLE_ARN) {
    return client
  }
  return getRefreshingClient(client)
}

export function getSQSClient(): SQSClient {
  const client = new SQSClient({})
  if (!process.env.ASSUME_ROLE_ARN) {
    return client
  }
  return getRefreshingClient(client)
}

export async function bulkSendMessages(
  sqsClient: SQSClient,
  queueUrl: string,
  batchRequestEntries: SendMessageBatchRequestEntry[]
) {
  const MAX_BATCH_SIZE_BYTES = 256 * 1024 // 256KB in bytes
  const MAX_BATCH_SIZE_COUNT = 10

  // Helper function to calculate the byte size of an entry
  const getEntrySize = (entry: SendMessageBatchRequestEntry): number =>
    Buffer.byteLength(JSON.stringify(entry), 'utf8')

  // Group entries into batches that don't exceed MAX_BATCH_SIZE_BYTES and MAX_BATCH_SIZE_COUNT
  const batches = reduce(
    batchRequestEntries,
    (acc, entry) => {
      const entrySize = getEntrySize(entry)
      if (entrySize > MAX_BATCH_SIZE_BYTES) {
        addSentryExtras({ entry })
        logger.error(
          `Skipping message with size ${entrySize} bytes because it exceeds the maximum batch size of ${MAX_BATCH_SIZE_BYTES} bytes`
        )
        return acc
      }
      const currentBatch = last(acc) || []
      const currentBatchSize = sumBy(currentBatch, getEntrySize)

      // Start a new batch if:
      // 1. Adding this entry would exceed MAX_BATCH_SIZE_BYTES, or
      // 2. The current batch already has MAX_BATCH_SIZE_COUNT entries
      if (
        currentBatchSize + entrySize > MAX_BATCH_SIZE_BYTES ||
        currentBatch.length >= MAX_BATCH_SIZE_COUNT
      ) {
        return [...acc, [entry]]
      }

      // Otherwise, add to the current batch
      return [...initial(acc), [...currentBatch, entry]]
    },
    [] as SendMessageBatchRequestEntry[][]
  )

  const results = await Promise.all(
    batches.map((batch) =>
      sqsClient.send(
        new SendMessageBatchCommand({
          QueueUrl: queueUrl,
          Entries: batch,
        })
      )
    )
  )

  return results
}
