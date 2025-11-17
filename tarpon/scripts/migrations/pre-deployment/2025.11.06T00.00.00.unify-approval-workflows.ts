import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/@types/tenant'
import { getDynamoDbClient, dangerouslyDeletePartition } from '@/utils/dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

/**
 * Migration: Clean up old approval workflows
 *
 * Deletes all approval workflows and clears tenant workflow settings.
 * Tenants will need to create new change-approval workflows after migration.
 */

async function deleteWorkflowsOfType(
  dynamoDb: DynamoDBDocumentClient,
  tenantId: string,
  workflowType: string
): Promise<void> {
  const tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
  const partitionKey = DynamoDbKeys.WORKFLOWS(
    tenantId,
    workflowType
  ).PartitionKeyID

  await dangerouslyDeletePartition(
    dynamoDb,
    tenantId,
    partitionKey,
    tableName,
    `${workflowType} workflows`
  )
}

async function deleteApprovalObjects(
  dynamoDb: DynamoDBDocumentClient,
  tenantId: string
): Promise<void> {
  const hammerhead = StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(tenantId)
  const tarponTableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)

  // Delete all approval types
  await dangerouslyDeletePartition(
    dynamoDb,
    tenantId,
    DynamoDbKeys.RISK_CLASSIFICATION_APPROVAL(tenantId).PartitionKeyID,
    hammerhead,
    'risk classification approvals'
  )

  await dangerouslyDeletePartition(
    dynamoDb,
    tenantId,
    DynamoDbKeys.RISK_FACTORS_APPROVAL(tenantId).PartitionKeyID,
    hammerhead,
    'risk factor approvals'
  )

  await dangerouslyDeletePartition(
    dynamoDb,
    tenantId,
    DynamoDbKeys.USERS_PROPOSAL(tenantId, '').PartitionKeyID,
    tarponTableName,
    'user approvals'
  )
}

async function migrateTenant(tenant: Tenant): Promise<void> {
  console.log(`\nMigrating tenant: ${tenant.id}`)

  const dynamoDb = getDynamoDbClient()

  // Delete workflows
  const workflowTypes = [
    'risk-levels-approval',
    'risk-factors-approval',
    'user-update-approval',
    'change-approval',
  ]
  for (const type of workflowTypes) {
    await deleteWorkflowsOfType(dynamoDb, tenant.id, type)
  }

  // Delete approval objects
  await deleteApprovalObjects(dynamoDb, tenant.id)

  // Clear workflow settings with raw DynamoDB update
  await dynamoDb.send(
    new UpdateCommand({
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenant.id),
      Key: DynamoDbKeys.TENANT_SETTINGS(tenant.id),
      UpdateExpression: 'SET #ws = :emptyObj',
      ExpressionAttributeNames: {
        '#ws': 'workflowSettings',
      },
      ExpressionAttributeValues: {
        ':emptyObj': {},
      },
    })
  )

  console.log('Completed: deleted all workflows and approvals')
}

export const up = async () => {
  console.log('Starting approval workflows cleanup migration...')
  await migrateAllTenants(migrateTenant)
  console.log('\nMigration completed successfully')
}

export const down = async () => {
  console.log('Rollback not implemented - restore from backup if needed')
}

if (require.main === module) {
  process.env.NODE_ENV = 'local'
  process.env.STAGE = 'local'
  process.env.ENV = 'local'

  up()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration failed:', error)
      process.exit(1)
    })
}
