import { StackConstants } from '@lib/constants'
import { UpdateCommand, UpdateCommandInput } from '@aws-sdk/lib-dynamodb'
import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts/repository'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id === 'pnb') {
    const dynamoDb = getDynamoDbClient()
    const updateItemInput: UpdateCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenant.id),
      Key: DynamoDbKeys.TENANT_SETTINGS(tenant.id),
      UpdateExpression: 'SET bruteForceAccountBlockingEnabled = :value',
      ExpressionAttributeValues: {
        ':value': true,
      },
    }
    await dynamoDb.send(new UpdateCommand(updateItemInput))
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
