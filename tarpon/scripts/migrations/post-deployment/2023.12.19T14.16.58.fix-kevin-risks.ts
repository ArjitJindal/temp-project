import { migrateAllTenants } from '../utils/tenant'
import { envIs } from '@/utils/env'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { RiskScoringService } from '@/services/risk-scoring'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'
import dayjs from '@/utils/dayjs'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-internal/Business'

async function migrateTenant(tenant: Tenant) {
  if (!envIs('prod') && tenant.id !== 'QEO03JYKBT') {
    return
  }

  console.log(`Migrating tenant ${tenant.id}`)

  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()

  const riskScoring = new RiskScoringService(tenant.id, { dynamoDb, mongoDb })

  const usersCollectionName = USERS_COLLECTION(tenant.id)
  const db = mongoDb.db()
  const usersCollection = db.collection<User | Business>(usersCollectionName)

  console.log(`Removing KRS and DRS scores from users`)

  await usersCollection.updateMany(
    { drsScore: { createdAt: { $lt: dayjs('2023-12-19').valueOf() } } }, // For date before 2023-12-19, Day we enabled Risk Levels for Kevin
    { $unset: { krsScore: '', drsScore: '' } }
  )

  const usersWithRiskLevel = usersCollection.find({
    riskLevel: { $exists: true },
    drsScore: { $exists: false },
  })
  const count = await usersWithRiskLevel.count()
  console.log(`Handling risk levels for ${count} users`)
  let i = 0
  for await (const user of usersWithRiskLevel) {
    await riskScoring.handleManualRiskLevel(user)

    console.log(
      `Handled risk level for user ${user.userId} (${++i} / ${count})`
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
