import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient, getMongoDbClientDb } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { Case } from '@/@types/openapi-internal/Case'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { getS3Client } from '@/utils/s3'
import { CaseConfig } from '@/lambdas/console-api-case/app'
import { AlertsRepository } from '@/services/alerts/repository'
import { AlertsService } from '@/services/alerts'

async function migrateTenant(tenant: Tenant) {
  const tenantId = tenant.id
  if (tenantId !== 'e5eb4e1664') {
    // Palla tenant id
    return
  }

  const db = await getMongoDbClientDb()
  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
  const alertIdDocuments = await casesCollection
    .aggregate([
      {
        $unwind: {
          path: '$alerts',
        },
      },
      {
        $match: {
          'alerts.alertStatus': 'OPEN',
        },
      },
      {
        $addFields: {
          'alerts.totalTransactions': {
            $size: '$alerts.transactionIds',
          },
        },
      },
      {
        $unwind: {
          path: '$alerts.transactionIds',
        },
      },
      {
        $lookup: {
          from: 'e5eb4e1664-transactions',
          localField: 'alerts.transactionIds',
          foreignField: 'transactionId',
          as: 'transaction',
        },
      },
      {
        $unwind: {
          path: '$transaction',
        },
      },
      {
        $match: {
          'transaction.timestamp': {
            $lte: 1725148800000,
          },
        },
      },
      {
        $group: {
          _id: '$alerts.alertId',
          transactionCount: {
            $sum: 1,
          },
          totalTransactions: {
            $first: '$alerts.totalTransactions',
          },
        },
      },
      {
        $match: {
          $expr: {
            $eq: ['$transactionCount', '$totalTransactions'],
          },
        },
      },
      {
        $project: {
          _id: 1,
        },
      },
    ])
    .toArray()
  const alertIdsToClose = alertIdDocuments.map((doc) => doc._id)
  const mongoDb = await getMongoDbClient()
  const alertsRepository = new AlertsRepository(tenantId, {
    mongoDb: mongoDb,
  })
  const s3 = getS3Client()
  const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as CaseConfig
  const alertsService = new AlertsService(alertsRepository, s3, {
    tmpBucketName: TMP_BUCKET,
    documentBucketName: DOCUMENT_BUCKET,
  })
  await alertsService.updateStatus(
    alertIdsToClose,
    {
      reason: ['False positive'],
      comment: 'Alert falsely created during data migration',
      alertStatus: 'CLOSED',
    },
    {
      bySystem: true,
      skipReview: true,
    }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
