import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { logger } from '@/core/logger'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'

async function migrateTenant(tenant: Tenant) {
  const db = (await getMongoDbClient()).db()

  const transactionsCollection = db.collection<InternalTransaction>(
    TRANSACTIONS_COLLECTION(tenant.id)
  )

  const transactionResult = await transactionsCollection.updateMany(
    {
      $or: [
        { executedRules: { $exists: true, $ne: [] } },
        { hitRules: { $exists: true, $ne: [] } },
      ],
    },
    [
      {
        $set: {
          executedRules: {
            $map: {
              input: '$executedRules',
              as: 'rule',
              in: {
                $mergeObjects: ['$$rule', { executedAt: '$updatedAt' }],
              },
            },
          },
          hitRules: {
            $map: {
              input: '$hitRules',
              as: 'rule',
              in: {
                $mergeObjects: ['$$rule', { executedAt: '$updatedAt' }],
              },
            },
          },
        },
      },
    ]
  )

  const usersCollection = db.collection<
    InternalConsumerUser | InternalBusinessUser
  >(USERS_COLLECTION(tenant.id))

  const userResult = await usersCollection.updateMany(
    {
      $or: [
        { executedRules: { $exists: true, $ne: [] } },
        { hitRules: { $exists: true, $ne: [] } },
      ],
    },
    [
      {
        $set: {
          executedRules: {
            $map: {
              input: '$executedRules',
              as: 'rule',
              in: {
                $mergeObjects: ['$$rule', { executedAt: '$updatedAt' }],
              },
            },
          },
          hitRules: {
            $map: {
              input: '$hitRules',
              as: 'rule',
              in: {
                $mergeObjects: ['$$rule', { executedAt: '$updatedAt' }],
              },
            },
          },
        },
      },
    ]
  )

  logger.info(
    `Updated ${transactionResult.modifiedCount} transactions and ${userResult.modifiedCount} users for tenant ${tenant.id}`
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down = async () => {
  // skip
}
