import pMap from 'p-map'
import { compact } from 'lodash'
import { BatchJobRunner } from './batch-job-runner-base'
import { PnbBackfillTransactions } from '@/@types/batch-job'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { logger } from '@/core/logger'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '@/utils/migration-progress'
import { acquireInMemoryLocks } from '@/utils/lock'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { pickKnownEntityFields } from '@/utils/object'

export class PnbBackfillTransactionsBatchJobRunner extends BatchJobRunner {
  private tenantId!: string
  private progressKey!: string
  private publicApiKey!: string
  private publicApiEndpoint!: string
  private type!: 'transactions' | 'ars'

  public async run(
    job: PnbBackfillTransactions,
    type: 'transactions' | 'ars' = 'transactions'
  ): Promise<void> {
    const { tenantId } = job
    const {
      startTimestamp,
      concurrency = 50,
      publicApiKey,
      publicApiEndpoint,
      filters,
    } = job.parameters
    const db = await getMongoDbClientDb()

    this.progressKey = this.jobId
    this.publicApiKey = publicApiKey
    this.publicApiEndpoint = publicApiEndpoint
    this.tenantId = tenantId
    this.type = type

    const lastCompletedTimestamp =
      (await getMigrationLastCompletedTimestamp(this.progressKey)) ?? 0
    const actualStartTimestamp = Math.max(
      lastCompletedTimestamp,
      startTimestamp
    )
    const cursor = db
      .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))
      .find({
        timestamp: { $gte: actualStartTimestamp },
        ...filters,
      })
      .sort({ timestamp: 1 })
      .addCursorFlag('noCursorTimeout', true)
      .allowDiskUse(true)

    const start = Date.now()
    logger.warn(
      `Starting to process transactions from ${new Date(
        actualStartTimestamp
      ).toISOString()}`
    )

    let batchTransactions: InternalTransaction[] = []
    for await (const transaction of cursor) {
      batchTransactions.push(transaction)
      if (batchTransactions.length === 10000) {
        await this.processBatch(batchTransactions, concurrency)
        logger.warn(`Processed ${batchTransactions.length} transactions`)
        batchTransactions = []
      }
    }
    await this.processBatch(batchTransactions, concurrency)

    const duration = (Date.now() - start) / 1000
    logger.warn(`Finished processing transactions in ${duration}s`)
  }

  private async processTransaction(internalTransaction: InternalTransaction) {
    const transaction = pickKnownEntityFields(internalTransaction, Transaction)
    const releaseLocks = await acquireInMemoryLocks(
      compact([transaction.originUserId, transaction.destinationUserId])
    )
    let url = `${this.publicApiEndpoint}?validateTransactionId=false&validateDestinationUserId=false&validateOriginUserId=false`
    if (this.type === 'ars') {
      url += '&_trsOnly=true'
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.publicApiKey,
      },
      body: JSON.stringify(transaction),
    })
    if (response.status === 504) {
      // Wait for the rebuild to complete
      await new Promise((resolve) => setTimeout(resolve, 15 * 60 * 1000))
    }
    releaseLocks()
    if (response.status >= 300) {
      logger.warn(
        `[${response.status}] Error processing transaction ${internalTransaction.transactionId}`
      )
      const db = await getMongoDbClientDb()
      await db.collection('backfill-failure').insertOne({
        job:
          this.type === 'transactions'
            ? 'PNB_BACKFILL_TRANSACTIONS'
            : 'PNB_BACKFILL_ARS',
        tenantId: this.tenantId,
        transactionId: internalTransaction.transactionId,
        status: response.status,
        reason: await response.json(),
      })
    }
  }

  private async processBatch(
    batchTransactions: InternalTransaction[],
    concurrency: number
  ) {
    await pMap(
      batchTransactions,
      async (internalTransaction, index) => {
        await this.processTransaction(internalTransaction)

        if (index % 100 === 0) {
          await updateMigrationLastCompletedTimestamp(
            this.progressKey,
            internalTransaction.timestamp
          )
        }
      },
      {
        concurrency,
      }
    )
  }
}
