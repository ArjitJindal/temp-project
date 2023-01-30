import { MigrationFn } from 'umzug'
import { StackConstants } from '@cdk/constants'
import { getConfig } from '../utils/config'
import { AccountsConfig } from '@/lambdas/console-api-account/app'
import {
  Tenant,
  AccountsService,
} from '@/lambdas/console-api-account/services/accounts-service'
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
  const config = getConfig()
  const accountsService = new AccountsService(
    config.application as AccountsConfig
  )
  const flagrightTenant = await accountsService.getTenantById('flagright')
  await migrateTenant(flagrightTenant, 1671446984000)
}

export const down: MigrationFn = async () => {
  // skip
}
