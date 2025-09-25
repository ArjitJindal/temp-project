import chunk from 'lodash/chunk'
import difference from 'lodash/difference'
import { migrateAllTenants } from '../utils/tenant'
import { envIsNot } from '@/utils/env'
import { Tenant } from '@/services/accounts/repository'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import {
  CASES_COLLECTION,
  TRANSACTIONS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { Case } from '@/@types/openapi-internal/Case'
import { getS3Client } from '@/utils/s3'
import { CaseConfig } from '@/@types/cases/case-config'
import { AlertsRepository } from '@/services/alerts/repository'
import { AlertsService } from '@/services/alerts'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id !== 'pnb' || envIsNot('prod')) {
    return
  }
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const db = mongoDb.db()
  const transactionsCollection = db.collection<InternalTransaction>(
    TRANSACTIONS_COLLECTION(tenant.id)
  )
  // Around 13000 transactions were hit, thus can be processed in memory
  const alertsDataCursor = transactionsCollection.aggregate<{
    transactionIds: string[]
    _id: string
  }>([
    {
      $match: {
        timestamp: {
          $gt: 1732464000000, // Go live timestamp
          $lt: 1735401600000, // Timestamp before 29 Dec 2024
        },
        createdAt: {
          $gt: 1732464000000, // Go live timestamp
          $lt: 1735401600000, // Timestamp before 29 Dec 2024
        },
        alertIds: {
          $exists: true,
          $ne: [],
        },
      },
    },
    {
      $unwind: '$alertIds',
    },
    {
      $group: {
        _id: '$alertIds',
        transactionIds: {
          $push: '$transactionId',
        },
      },
    },
  ])
  const alertIdsToClose: string[] = []
  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenant.id))
  await processCursorInBatch(alertsDataCursor, async (alertsData) => {
    for (const alertData of chunk(alertsData, 100)) {
      const alertIds = alertData.map((x) => x._id)
      const targetAlerts = await casesCollection
        .aggregate([
          {
            $match: {
              'alerts.alertId': {
                $in: alertIds,
              },
              'alerts.alertStatus': { $ne: 'CLOSED' },
            },
          },
          {
            $unwind: '$alerts',
          },
          {
            $match: {
              'alerts.alertId': {
                $in: alertIds,
              },
              'alerts.alertStatus': { $ne: 'CLOSED' },
            },
          },
          {
            $project: {
              _id: 0,
              alertId: '$alerts.alertId',
              transactionIds: '$alerts.transactionIds',
            },
          },
        ])
        .toArray()
      for (const targetAlert of targetAlerts) {
        const a = alertsData.find((x) => x._id === targetAlert.alertId)
        if (
          a &&
          a.transactionIds &&
          targetAlert.transactionIds &&
          difference(targetAlert.transactionIds, a.transactionIds).length === 0
        ) {
          alertIdsToClose.push(targetAlert.alertId)
        }
      }
    }
  })

  const alertsRepository = new AlertsRepository(tenant.id, {
    mongoDb: mongoDb,
    dynamoDb: dynamoDb,
  })
  const s3 = getS3Client()
  const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as CaseConfig
  const alertsService = new AlertsService(alertsRepository, s3, {
    tmpBucketName: TMP_BUCKET,
    documentBucketName: DOCUMENT_BUCKET,
  })
  for (const alertIds of chunk(alertIdsToClose, 10)) {
    await alertsService.updateStatus(
      alertIds,
      {
        reason: ['Other'],
        comment: 'Part of alerts closed by system created before 29 Dec 2024',
        alertStatus: 'CLOSED',
      },
      {
        bySystem: true,
        skipReview: true,
      }
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
