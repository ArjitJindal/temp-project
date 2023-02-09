import { DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@cdk/constants'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient, USERS_COLLECTION } from '@/utils/mongoDBUtils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'

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

  const userCursor = await collection.distinct('userId')
  for (const id of userCursor) {
    const userId = id.toString()
    console.log(`Migrating ${collectionName} for ${userId}`)

    const getInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      Key: DRS_RISK_DETAILS(tenant.id, userId, 'LATEST'),
    }

    const result = await dynamoDb.send(new GetCommand(getInput))

    if (result.Item) {
      console.log(`Deleting ${collectionName} for ${userId}`)
      const deleteInput: AWS.DynamoDB.DocumentClient.DeleteItemInput = {
        TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
        Key: DRS_RISK_DETAILS(tenant.id, userId, 'LATEST'),
      }

      await dynamoDb.send(new DeleteCommand(deleteInput))
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
