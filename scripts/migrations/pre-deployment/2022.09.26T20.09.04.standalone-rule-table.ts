import { StackConstants } from '@cdk/constants'
import { migrateAllTenants } from '../utils/tenant'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { getDynamoDbClient, paginateQuery } from '@/utils/dynamodb'
import { Tenant } from '@/lambdas/console-api-account/services/accounts-service'

async function moveItem(item: any, fromTable: string, toTable: string) {
  const dynamodb = await getDynamoDbClient()
  const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
    TableName: toTable,
    Item: item,
  }
  await dynamodb.put(putItemInput).promise()

  const deleteItemInput: AWS.DynamoDB.DocumentClient.DeleteItemInput = {
    TableName: fromTable,
    Key: {
      PartitionKeyID: item.PartitionKeyID,
      SortKeyID: item.SortKeyID,
    },
    ReturnConsumedCapacity: 'TOTAL',
  }
  await dynamodb.delete(deleteItemInput).promise()
}

async function migrateTenant(
  tenant: Tenant,
  fromTable: string,
  toTable: string
) {
  const dynamodb = await getDynamoDbClient()
  const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
    TableName: fromTable,
    KeyConditionExpression: 'PartitionKeyID = :pk',
    ReturnConsumedCapacity: 'TOTAL',
    ExpressionAttributeValues: {
      ':pk': DynamoDbKeys.RULE_INSTANCE(tenant.id).PartitionKeyID,
    },
  }
  const result = await paginateQuery(dynamodb, queryInput)
  for (const item of result.Items || []) {
    await moveItem(item, fromTable, toTable)
    console.info(`Migrated rule instance ${item.ruleId} (${item.id})`)
  }
}

async function migrateRules(fromTable: string, toTable: string) {
  const dynamodb = await getDynamoDbClient()
  const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
    TableName: fromTable,
    KeyConditionExpression: 'PartitionKeyID = :pk',
    ReturnConsumedCapacity: 'TOTAL',
    ExpressionAttributeValues: {
      ':pk': DynamoDbKeys.RULE().PartitionKeyID,
    },
  }

  const result = await paginateQuery(dynamodb, queryInput)
  for (const item of result.Items || []) {
    await moveItem(item, fromTable, toTable)
    console.info(`Migrated rule ${item.id}`)
  }
}

export const up = async () => {
  await migrateRules(
    StackConstants.TARPON_DYNAMODB_TABLE_NAME,
    StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME
  )
  // Migrate rule instances
  await migrateAllTenants((tenant) =>
    migrateTenant(
      tenant,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME
    )
  )
}
export const down = async () => {
  await migrateRules(
    StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
    StackConstants.TARPON_DYNAMODB_TABLE_NAME
  )
  // Migrate rule instances
  await migrateAllTenants((tenant) =>
    migrateTenant(
      tenant,
      StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME
    )
  )
}
