import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { Mutex, MutexInterface } from 'async-mutex'
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

const inMemoryLocks = new Map<string, Mutex>()

const getInMemoryLock = (lockKey: string): Mutex => {
  if (!inMemoryLocks.has(lockKey)) {
    inMemoryLocks.set(lockKey, new Mutex())
  }
  return inMemoryLocks.get(lockKey) as Mutex
}
export const acquireInMemoryLocks = async (
  lockKeys: string[]
): Promise<MutexInterface.Releaser> => {
  lockKeys.sort()
  const locks = lockKeys.map(getInMemoryLock)

  const releaseLocks: MutexInterface.Releaser[] = []
  for (const lock of locks) {
    releaseLocks.push(await lock.acquire())
  }

  return () => {
    for (const releaseLock of releaseLocks) {
      releaseLock()
    }
  }
}
