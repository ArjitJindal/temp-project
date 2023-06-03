import { MigrationFn } from 'umzug'
import { StackConstants } from '@lib/constants'
import { Tenant, AccountsService } from '@/services/accounts'
import { getMongoDbClient, USERS_COLLECTION } from '@/utils/mongoDBUtils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'
import { RiskScoringService } from '@/services/risk-scoring'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'

async function migrateTenant(tenant: Tenant | null, timestamp: number) {
  if (!tenant) {
    console.info(`Tenant not found`)
    return
  }
  console.info(`Starting to migrate tenant ${tenant.name} (ID: ${tenant.id})`)
  const dynamoDb = await getDynamoDbClient()
  const mongoDb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)
  const usersCollectionName = USERS_COLLECTION(tenant.id)
  const db = mongoDb.db()
  const riskScoringService = new RiskScoringService(tenant.id, {
    dynamoDb,
    mongoDb,
  })

  const usersBeforeTimestamp = await db
    .collection<User | Business>(usersCollectionName)
    .find({ createdAt: { $lte: new Date(timestamp) } })
    .toArray()

  for await (const user of usersBeforeTimestamp) {
    await riskScoringService.updateInitialRiskScores(user)
  }

  const dashboardStatsRepository = new DashboardStatsRepository(tenant.id, {
    mongoDb,
  })

  await dashboardStatsRepository.refreshUserStats()
}

export const up: MigrationFn = async () => {
  if (!process.env.ENV?.startsWith('prod')) {
    return
  }
  const mongoDb = await getMongoDbClient()
  const accountsService = new AccountsService(
    { auth0Domain: 'flagright.eu.auth0.com' },
    { mongoDb }
  )
  const flagrightTenant = await accountsService.getTenantById('flagright')
  await migrateTenant(flagrightTenant, 1671446984000)
}

export const down: MigrationFn = async () => {
  // skip
}
