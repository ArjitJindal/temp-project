import pMap from 'p-map'
import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/@types/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { DRS_SCORES_COLLECTION } from '@/utils/mongo-table-names'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id !== '989e80b1a3') {
    return
  }
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const drsCollection = db.collection(DRS_SCORES_COLLECTION(tenant.id))
  const cursor = await drsCollection
    .aggregate<{ userIds: string[]; _id: string }>([
      {
        $match: {
          triggeredBy: 'BATCH',
          isUpdatable: false,
          transactionId: 'RISK_SCORING_RERUN',
        },
      },
      {
        $group: {
          _id: 'userIds',
          userIds: {
            $addToSet: '$userId',
          },
        },
      },
    ])
    .toArray() // Only ~900 userIds
  const dynamoDb = getDynamoDbClient()
  const userIds = cursor.flatMap((v) => v.userIds)
  await pMap(
    userIds,
    async (userId) => {
      const key = DynamoDbKeys.DRS_VALUE_ITEM(tenant.id, userId, '1')
      const tableName = StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(tenant.id)
      await dynamoDb.send(
        new UpdateCommand({
          TableName: tableName,
          Key: key,
          UpdateExpression: 'SET isUpdatable = :isUpdatable',
          ExpressionAttributeValues: {
            ':isUpdatable': true,
          },
        })
      )
    },
    {
      concurrency: 100,
    }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
