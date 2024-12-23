import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { Case } from '@/@types/openapi-internal/Case'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { DynamoAlertRepository } from '@/services/alerts/dynamo-repository'
import { envIs } from '@/utils/env'

async function migrateTenant(tenant: Tenant) {
  if (!envIs('dev')) {
    return
  }

  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const dynamoDbAlertRepository = new DynamoAlertRepository(tenant.id, dynamoDb)
  const casesCollectionName = CASES_COLLECTION(tenant.id)
  const db = mongoDb.db()
  const casesCollection = db.collection<Case>(casesCollectionName)
  const cases = casesCollection.find({})

  for await (const caseItem of cases) {
    await Promise.all(
      (caseItem?.alerts ?? [])?.map(async (alert) => {
        await dynamoDbAlertRepository.saveAlert(alert)
      })
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
