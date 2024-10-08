import * as readline from 'readline'
import { Readable } from 'stream'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import pMap from 'p-map'
import { Mutex, MutexInterface } from 'async-mutex'
import { compact } from 'lodash'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { RulesEngineService } from '../rules-engine'
import { BatchJobRunner } from './batch-job-runner-base'
import { PnbBackfillTransactions } from '@/@types/batch-job'
import { getS3Client } from '@/utils/s3'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { logger } from '@/core/logger'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '@/utils/migration-progress'

const userLocks = new Map<string, Mutex>()

const getUserLock = (userId): Mutex => {
  if (!userLocks.has(userId)) {
    userLocks.set(userId, new Mutex())
  }
  return userLocks.get(userId) as Mutex
}
const lockUsers = async (
  userIds: string[]
): Promise<MutexInterface.Releaser> => {
  userIds.sort()
  const locks = userIds.map(getUserLock)

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

export class PnbBackfillTransactionsBatchJobRunner extends BatchJobRunner {
  private rulesEngine!: RulesEngineService
  private progressKey!: string
  protected async run(job: PnbBackfillTransactions): Promise<void> {
    const { tenantId } = job
    const { importFileS3Key, concurrency = 50 } = job.parameters

    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    this.rulesEngine = new RulesEngineService(
      tenantId,
      dynamoDb,
      logicEvaluator
    )

    const s3 = getS3Client()
    const { Body } = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.IMPORT_BUCKET,
        Key: importFileS3Key,
      })
    )
    const stream = Body instanceof Readable ? Body : Readable.from(Body as any)
    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    })

    this.progressKey = `pnb-backfill-transactions-${importFileS3Key}`
    const lastCompletedTimestamp = await getMigrationLastCompletedTimestamp(
      this.progressKey
    )

    const start = Date.now()
    logger.warn('Starting to process transactions')

    let batchTransactions: Transaction[] = []
    for await (const line of rl) {
      const transaction = JSON.parse(line) as Transaction
      if (
        lastCompletedTimestamp &&
        transaction.timestamp &&
        transaction.timestamp < lastCompletedTimestamp
      ) {
        continue
      }
      batchTransactions.push(transaction)
      if (batchTransactions.length === 10000) {
        await this.processBatch(batchTransactions, concurrency)
        batchTransactions = []
        logger.warn(`Processed ${batchTransactions.length} transactions`)
      }
    }
    await this.processBatch(batchTransactions, concurrency)

    const duration = (Date.now() - start) / 1000
    logger.warn(`Finished processing transactions in ${duration}s`)
  }

  private async processBatch(
    batchTransactions: Transaction[],
    concurrency: number
  ) {
    await pMap(
      batchTransactions,
      async (transaction, index) => {
        const releaseLocks = await lockUsers(
          compact([transaction.originUserId, transaction.destinationUserId])
        )
        try {
          await this.rulesEngine.verifyTransaction({
            ...transaction,
          })
        } catch (e) {
          logger.error(e)
        } finally {
          releaseLocks()
        }
        if (index % 100 === 0) {
          await updateMigrationLastCompletedTimestamp(
            this.progressKey,
            transaction.timestamp
          )
        }
      },
      {
        concurrency,
      }
    )
  }
}
