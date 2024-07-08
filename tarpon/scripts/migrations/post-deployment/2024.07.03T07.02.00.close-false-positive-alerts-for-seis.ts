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
  if (tenantId !== '1PA0RZ0DON') {
    // Seis tenant id
    return
  }

  const db = await getMongoDbClientDb()
  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
  const ruleInstanceId = '80f96726'
  const alertIdDocuments = await casesCollection
    .aggregate([
      {
        $match: {
          'alerts.ruleInstanceId': ruleInstanceId,
        },
      },
      {
        $unwind: '$alerts',
      },
      {
        $match: {
          'alerts.ruleInstanceId': ruleInstanceId,
          'alerts.alertStatus': {
            $ne: 'CLOSED',
          },
        },
      },
      {
        $project: {
          alertId: '$alerts.alertId',
        },
      },
    ])
    .toArray()
  const alertIdsToClose = alertIdDocuments.map((doc) => doc.alertId)
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
      reason: ['Other'],
      comment: 'Created as part of rule testing',
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
