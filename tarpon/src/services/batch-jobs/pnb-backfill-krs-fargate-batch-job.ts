import pMap from 'p-map'
import omit from 'lodash/omit'
import { BatchJobRunner } from './batch-job-runner-base'
import { PnbBackfillKrs } from '@/@types/batch-job'
import { logger } from '@/core/logger'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '@/utils/migration-progress'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { USERS_COLLECTION } from '@/utils/mongo-table-names'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { pickKnownEntityFields } from '@/utils/object'
import { User } from '@/@types/openapi-public/User'

export class PnbBackfillKrsBatchJobRunner extends BatchJobRunner {
  private tenantId!: string
  private publicApiKey!: string
  private publicApiEndpoint!: string
  private cursor!:
    | { type: 'START_TIMESTAMP'; value: number }
    | { type: 'IDS'; value: string[] }

  protected async run(job: PnbBackfillKrs): Promise<void> {
    const { tenantId } = job
    const {
      concurrency = 50,
      publicApiKey,
      publicApiEndpoint,
      cursor: dataCursor,
    } = job.parameters
    this.cursor = dataCursor

    const db = await getMongoDbClientDb()
    this.publicApiKey = publicApiKey
    this.publicApiEndpoint = publicApiEndpoint
    this.tenantId = tenantId

    const lastCompletedTimestamp =
      (await getMigrationLastCompletedTimestamp(this.jobId)) ?? 0

    const cursor = db
      .collection<InternalUser>(USERS_COLLECTION(tenantId))
      .find({
        ...(this.cursor.type === 'START_TIMESTAMP'
          ? {
              createdTimestamp: {
                $gte: Math.max(lastCompletedTimestamp, this.cursor.value),
              },
            }
          : {}),
        ...(this.cursor.type === 'IDS'
          ? { userId: { $in: this.cursor.value } }
          : {}),
      })
      .sort({ createdTimestamp: 1 })
      .addCursorFlag('noCursorTimeout', true)

    let batchUsers: InternalUser[] = []
    for await (const user of cursor) {
      batchUsers.push(user)
      if (batchUsers.length === 10000) {
        await this.processBatch(batchUsers, concurrency)
        logger.warn(`Processed ${batchUsers.length} users`)
        batchUsers = []
      }
    }
    await this.processBatch(batchUsers, concurrency)
  }

  private async processUser(user: InternalUser) {
    if (user.lastTransactionTimestamp === 0) {
      delete user.lastTransactionTimestamp
    }
    if (user.userStateDetails) {
      if (user.userStateDetails.state.includes('CLOSED')) {
        user.userStateDetails.state = 'TERMINATED'
      }
      if (user.userStateDetails.state.includes('DECEASED')) {
        user.userStateDetails.state = 'TERMINATED'
      }
      if (user.userStateDetails.state.includes('PENDING')) {
        user.userStateDetails.state = 'SUSPENDED'
      }
    }
    if (user.contactDetails?.addresses) {
      user.contactDetails.addresses.forEach((address) => {
        if (!address.city) {
          address.city = ' '
        }
        if (!address.country) {
          address.country = ' '
        }
      })
    }

    const url = `${this.publicApiEndpoint}?validateUserId=false&_krsOnly=true`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.publicApiKey,
      },
      body: JSON.stringify(
        omit(pickKnownEntityFields(user, User), 'riskLevel')
      ),
    })
    if (response.status >= 300) {
      logger.warn(`[${response.status}] Error processing user ${user.userId}`)
      const db = await getMongoDbClientDb()
      await db.collection('backfill-failure').insertOne({
        job: 'PNB_BACKFILL_KRS',
        tenantId: this.tenantId,
        userId: user.userId,
        status: response.status,
        reason: await response.json(),
      })
    }
  }

  private async processBatch(batchUsers: InternalUser[], concurrency: number) {
    await pMap(
      batchUsers,
      async (user, index) => {
        await this.processUser(user)
        if (index % 100 === 0) {
          await updateMigrationLastCompletedTimestamp(
            this.jobId,
            user.createdTimestamp
          )
        }
      },
      {
        concurrency,
      }
    )
  }
}
