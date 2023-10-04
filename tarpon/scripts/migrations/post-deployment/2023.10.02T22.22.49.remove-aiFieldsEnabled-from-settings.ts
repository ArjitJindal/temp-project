import { StackConstants } from '@lib/constants'
import { UpdateCommand, UpdateCommandInput } from '@aws-sdk/lib-dynamodb'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const updateItemInput: UpdateCommandInput = {
    TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
    Key: DynamoDbKeys.TENANT_SETTINGS(tenant.id),
    ReturnValues: 'UPDATED_NEW',
    UpdateExpression: `REMOVE aiFieldsEnabled`,
  }

  await dynamoDb.send(new UpdateCommand(updateItemInput))
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
