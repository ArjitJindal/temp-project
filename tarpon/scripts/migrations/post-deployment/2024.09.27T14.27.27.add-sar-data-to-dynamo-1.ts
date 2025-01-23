import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts/repository'
import { REPORT_COLLECTION } from '@/utils/mongodb-definitions'
import { ReportRepository } from '@/services/sar/repositories/report-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { CountryCode } from '@/@types/openapi-public/CountryCode'
import { ReportStatus } from '@/@types/openapi-internal/ReportStatus'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const db = mongoDb.db()
  const collection = db.collection<Report>(REPORT_COLLECTION(tenant.id))
  const data = await collection
    .find()
    .project<{
      id: string
      status: ReportStatus
      reportTypeId: string
      caseUserId: string
    }>({
      id: 1,
      status: 1,
      reportTypeId: 1,
      caseUserId: 1,
    })
    .toArray()
  const reportRepository = new ReportRepository(tenant.id, mongoDb, dynamoDb)
  for (const entry of data) {
    if (!entry || !entry.reportTypeId) {
      return
    }
    await reportRepository.addOrUpdateSarItemsInDynamo(entry.caseUserId, {
      reportId: entry.id,
      status: entry.status,
      region: entry.reportTypeId.split('-')[0] as CountryCode,
    })
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
