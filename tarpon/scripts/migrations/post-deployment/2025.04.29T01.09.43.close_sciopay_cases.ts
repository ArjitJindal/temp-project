import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { Tenant } from '@/@types/tenant'
import { CASES_COLLECTION } from '@/utils/mongo-table-names'
import { Case } from '@/@types/openapi-internal/Case'
import { CaseService } from '@/services/cases'
import { CaseRepository } from '@/services/cases/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getS3Client } from '@/utils/s3'
import { CaseConfig } from '@/@types/cases/case-config'

async function migrateTenant(tenant: Tenant) {
  const tenantId = tenant.id

  // should only run for sciopay production
  if (tenantId !== '198bb88f6a') {
    return
  }
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const dynamoDb = getDynamoDbClient()

  const caseCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
  const casesCursor = caseCollection.find(
    {
      caseStatus: { $ne: 'CLOSED' },
      $expr: {
        $eq: [
          { $size: '$alerts' },
          {
            $size: {
              $filter: {
                input: '$alerts',
                as: 'item',
                cond: { $eq: ['$$item.alertStatus', 'CLOSED'] },
              },
            },
          },
        ],
      },
    },
    { projection: { caseId: 1 } }
  )

  const caseRepository = new CaseRepository(tenantId, {
    mongoDb,
    dynamoDb,
  })
  const s3 = getS3Client()
  const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as CaseConfig

  const caseService = new CaseService(caseRepository, s3, {
    documentBucketName: DOCUMENT_BUCKET,
    tmpBucketName: TMP_BUCKET,
  })

  await processCursorInBatch(
    casesCursor,
    async (batch) => {
      const caseIds = batch
        .map((c) => c.caseId)
        .filter((caseId): caseId is string => typeof caseId === 'string')

      await caseService.updateStatus(
        caseIds,
        {
          reason: ['Other'],
          caseStatus: 'CLOSED',
          comment: 'All of the alerts of this case are closed',
        },
        { bySystem: true, cascadeAlertsUpdate: false }
      )
    },
    {
      mongoBatchSize: 1000,
      processBatchSize: 200,
    }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
