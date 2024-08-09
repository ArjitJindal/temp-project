import { wrap, chunk } from 'lodash'
import { SNSClient } from '@aws-sdk/client-sns'
import {
  SendMessageBatchCommand,
  SendMessageBatchRequestEntry,
  SQSClient,
} from '@aws-sdk/client-sqs'
import { logger } from '@/core/logger'

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
  // Max batch size is 10. Do not change the value
  for (const batch of chunk(batchRequestEntries, 10)) {
    await sqsClient.send(
      new SendMessageBatchCommand({
        Entries: batch,
        QueueUrl: queueUrl,
      })
    )
  }
}
