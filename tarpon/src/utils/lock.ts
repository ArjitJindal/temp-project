import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { backOff } from 'exponential-backoff'

const DEFAULT_TTL = 600
const DEFAULT_DELAY = 5
const DEFAULT_NUM_OF_ATTEMPTS = DEFAULT_TTL / DEFAULT_DELAY

export async function acquireLock(
  client: DynamoDBDocumentClient,
  lockKey: string,
  retryOptions?: {
    startingDelay?: number
    maxDelay?: number
    numOfAttempts?: number
  }
): Promise<void> {
  await backOff(
    async () => {
      await acquireLockInternal(client, lockKey, DEFAULT_TTL)
    },
    {
      startingDelay: retryOptions?.startingDelay ?? DEFAULT_DELAY * 1000,
      maxDelay: retryOptions?.maxDelay ?? DEFAULT_DELAY * 1000,
      numOfAttempts: retryOptions?.numOfAttempts ?? DEFAULT_NUM_OF_ATTEMPTS,
    }
  )
}

async function acquireLockInternal(
  client: DynamoDBDocumentClient,
  lockKey: string,
  ttl = 60
): Promise<void> {
  const nowInSeconds = Math.floor(Date.now() / 1000)
  await client.send(
    new PutCommand({
      TableName: StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
      Item: {
        PartitionKeyID: lockKey,
        SortKeyID: 'default',
        ttl: (nowInSeconds + ttl).toString(),
      },
      ConditionExpression: 'attribute_not_exists(PartitionKeyID)',
    })
  )
}

export async function releaseLock(
  client: DynamoDBDocumentClient,
  lockKey: string
): Promise<void> {
  await client.send(
    new DeleteCommand({
      TableName: StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
      Key: {
        PartitionKeyID: lockKey,
        SortKeyID: 'default',
      },
    })
  )
}
