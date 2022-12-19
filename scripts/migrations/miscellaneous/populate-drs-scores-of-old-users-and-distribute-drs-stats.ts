import { getConfig } from '../utils/config'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { AccountsConfig } from '@/lambdas/console-api-account/app'
import { AccountsService } from '@/lambdas/console-api-account/services/accounts-service'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'
import { updateInitialRiskScores } from '@/services/risk-scoring'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient, USERS_COLLECTION } from '@/utils/mongoDBUtils'

const startMigration = async (tenantId: string, timestamp: string) => {
  const config = getConfig()
  const accountsService = new AccountsService(
    config.application as AccountsConfig
  )

  const tenant = await accountsService.getTenantById(tenantId)
  if (!tenant) {
    throw new Error(`Tenant ${tenantId} not found`)
  }
  const mongoDb = await getMongoDbClient()
  const dynamoDb = await getDynamoDbClient()
  const usersCollectionName = USERS_COLLECTION(tenant.id)
  const db = mongoDb.db()

  const usersBeforeTimestamp = await db
    .collection<User | Business>(usersCollectionName)
    .find({ createdAt: { $lte: new Date(timestamp) } })
    .toArray()

  for await (const user of usersBeforeTimestamp) {
    await updateInitialRiskScores(tenant.id, dynamoDb, user)
  }

  const dashboardStatsRepository = new DashboardStatsRepository(tenant.id, {
    mongoDb,
  })

  await dashboardStatsRepository.refreshUserStats()
}

let tenantId
let timestamp

for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--tenant-id')) {
    tenantId = process.argv[i].split('=')[1]
  }
  if (process.argv[i].startsWith('--timestamp')) {
    timestamp = process.argv[i].split('=')[1]
  }
}

if (!tenantId) {
  throw new Error('tenantId is required')
}

if (!timestamp) {
  throw new Error('timestamp is required')
}

startMigration(tenantId, timestamp)
