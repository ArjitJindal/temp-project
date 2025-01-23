import { chunk } from 'lodash'
import { WithId } from 'mongodb'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { logger } from '@/core/logger'

async function migrateTenant(tenant: Tenant) {
  if (
    tenant.id === 'pnb-stress' ||
    tenant.id === 'QEO03JYKBT' ||
    tenant.id === 'U7O12AVVL9'
  ) {
    return
  }

  const db = (await getMongoDbClient()).db()

  const transactionsCollection = db.collection<InternalTransaction>(
    TRANSACTIONS_COLLECTION(tenant.id)
  )

  let count = 0

  const filter = {
    $or: [
      { executedRules: { $exists: true, $ne: [] } },
      { hitRules: { $exists: true, $ne: [] } },
    ],
    'executedRules.executedAt': { $exists: false },
    'hitRules.executedAt': { $exists: false },
  }

  const transactionsCursor = transactionsCollection
    .find(filter)
    .batchSize(10000)

  const updatedTransactions: WithId<InternalTransaction>[] = []

  for await (const transaction of transactionsCursor) {
    logger.info(`Processing transaction ${count++}`)
    const updatedTransaction = {
      ...transaction,
      executedRules: transaction.executedRules.map((rule) => ({
        ...rule,
        executedAt: transaction.updatedAt,
      })),
      hitRules: transaction.hitRules.map((rule) => ({
        ...rule,
        executedAt: transaction.updatedAt,
      })),
    }

    updatedTransactions.push(updatedTransaction)
  }

  const chunkSize = 2000
  const chunks = chunk(updatedTransactions, chunkSize)
  let chunkCount = 0
  for (const chunk of chunks) {
    logger.info(`Processing chunk ${chunkCount++}`)
    await transactionsCollection.bulkWrite(
      chunk.map((transaction) => ({
        updateOne: {
          filter: { _id: transaction._id },
          update: { $set: transaction },
        },
      }))
    )
    logger.info(`Updated chunk ${chunkCount}`)
  }

  const usersCollection = db.collection<
    InternalConsumerUser | InternalBusinessUser
  >(USERS_COLLECTION(tenant.id))

  let userCount = 0

  const usersCursor = usersCollection.find(filter).batchSize(10000)

  const updatedUsers: WithId<InternalConsumerUser | InternalBusinessUser>[] = []

  for await (const user of usersCursor) {
    const updatedUser = {
      ...user,
      executedRules:
        user?.executedRules?.map((rule) => ({
          ...rule,
          executedAt: user.updatedAt,
        })) ?? [],
      hitRules:
        user?.hitRules?.map((rule) => ({
          ...rule,
          executedAt: user.updatedAt,
        })) ?? [],
    }

    updatedUsers.push(updatedUser)

    logger.info(`Processed user ${userCount++}`)
  }

  const userChunkSize = 1000
  const userChunks = chunk(updatedUsers, userChunkSize)
  let userChunkCount = 0
  for (const userChunk of userChunks) {
    logger.info(`Processing user chunk ${userChunkCount++}`)
    await usersCollection.bulkWrite(
      userChunk.map((user) => ({
        updateOne: { filter: { _id: user._id }, update: { $set: user } },
      }))
    )
    logger.info(`Updated user chunk ${userChunkCount}`)
  }

  logger.info(
    `Updated ${count} transactions and ${userCount} users for tenant ${tenant.id}`
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down = async () => {
  // skip
}
