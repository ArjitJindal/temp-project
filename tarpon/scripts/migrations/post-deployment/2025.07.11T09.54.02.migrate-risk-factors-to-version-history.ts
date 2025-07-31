import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts/repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { RiskService } from '@/services/risk'
import { VersionHistoryService } from '@/services/version-history'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const riskService = new RiskService(tenant.id, {
    mongoDb,
    dynamoDb,
  })

  const riskFactors = await riskService.getAllRiskFactors()
  const versionHistoryService = new VersionHistoryService(tenant.id, {
    mongoDb,
    dynamoDb,
  })

  await versionHistoryService.createVersionHistory(
    'RiskFactors',
    riskFactors,
    'Initial version of risk factors'
  )

  const riskClassificationScores = await riskService.getRiskClassificationItem()

  await versionHistoryService.createVersionHistory(
    'RiskClassification',
    riskClassificationScores.classificationValues,
    'Initial version of risk classification scores'
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
