import {
  DynamoDBDocumentClient,
  GetCommand,
  NativeAttributeValue,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { migrateAllTenants } from '../utils/tenant'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { Tenant } from '@/@types/tenant'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { isDemoTenant } from '@/utils/tenant-id'

async function getBackfillStatus(
  tenantId: string,
  dynamoDb: DynamoDBDocumentClient,
  key: Record<string, NativeAttributeValue>
): Promise<boolean> {
  const command = new GetCommand({
    TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
    Key: key,
  })
  const result = await dynamoDb.send(command)
  return result.Item?.isBackfillDone === true
}

async function migrateTenant(tenant: Tenant) {
  if (isDemoTenant(tenant.id)) {
    return
  }
  const dynamoDb = getDynamoDbClient()
  const [isWhiteBackfillDone, isSearchBackfillDone] = await Promise.all([
    getBackfillStatus(
      tenant.id,
      dynamoDb,
      DynamoDbKeys.SANCTIONS_WHITELIST_BATCH_JOB_STATUS(tenant.id)
    ),
    getBackfillStatus(
      tenant.id,
      dynamoDb,
      DynamoDbKeys.SANCTIONS_SEARCH_BATCH_JOB_STATUS(tenant.id)
    ),
  ])
  if (!isSearchBackfillDone) {
    await sendBatchJobCommand({
      type: 'BACKFILL_SEARCH_HITS',
      tenantId: tenant.id,
    })
  }
  if (!isWhiteBackfillDone) {
    await sendBatchJobCommand({
      type: 'BACKFILL_WHITELIST_ENTITIES',
      tenantId: tenant.id,
    })
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
