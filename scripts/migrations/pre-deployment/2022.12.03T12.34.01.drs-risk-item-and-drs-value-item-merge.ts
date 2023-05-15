import { StackConstants } from '@lib/constants'
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import _ from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'
import { getMongoDbClient, USERS_COLLECTION } from '@/utils/mongoDBUtils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'

const DRS_RISK_DETAILS = (
  tenantId: string,
  userId: string,
  version?: string
) => ({
  PartitionKeyID: `${tenantId}#userId#${userId}#drs-value`,
  SortKeyID: version,
})

async function migrateTenant(tenant: Tenant) {
  if (!(await tenantHasFeature(tenant.id, 'PULSE'))) {
    return
  }
  const mongoDb = await getMongoDbClient()
  const dynamoDb = await getDynamoDbClient()
  const db = mongoDb.db()
  const collectionName = USERS_COLLECTION(tenant.id)
  const collection = db.collection<InternalUser>(collectionName)

  const usersCursor = await collection.distinct('userId')
  console.log(
    `Found ${usersCursor.length} scores for tenant ${tenant.id}`,
    usersCursor
  )

  for (const id of usersCursor) {
    const userId = id.toString()
    console.log(`Migrating ${collectionName} for ${userId}`)

    const getInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      Key: DRS_RISK_DETAILS(tenant.id, userId, 'LATEST'),
    }

    const result = await dynamoDb.send(new GetCommand(getInput))

    if (!result.Item) {
      continue
    }
    console.log(`Found existing risk details for ${userId}`, result.Item)

    const riskRepository = new RiskRepository(tenant.id, {
      dynamoDb,
      mongoDb,
    })

    await riskRepository.createOrUpdateManualDRSRiskItem(
      userId,
      result.Item.riskLevel,
      result?.Item?.isUpdatable ?? true
    )
    console.log(`Migrated ${collectionName} for ${userId}`)
  }
}
export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
