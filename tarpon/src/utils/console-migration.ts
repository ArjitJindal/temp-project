import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { isBackfillDone } from './dynamodb'
import { isClickhouseEnabledInRegion } from './clickhouse/checks'

export async function isTenantMigratedToDynamo(
  tenantId: string,
  dynamoDb: DynamoDBDocumentClient,
  entity: string
) {
  return (
    isClickhouseEnabledInRegion() &&
    (await isBackfillDone(tenantId, dynamoDb, entity)) &&
    // TODO: To be removed once console migration is done
    (tenantId === 'sia-partners' ||
      tenantId === 'sia-partners-test' ||
      tenantId === 'ffe367a89f' ||
      tenantId === 'ffe367a89f-test' ||
      tenantId === 'pnb' ||
      tenantId === 'pnb-test')
  )
}

export function isTenantConsoleMigrated(tenantId: string) {
  return (
    isClickhouseEnabledInRegion() &&
    (tenantId === 'sia-partners' ||
      tenantId === 'sia-partners-test' ||
      tenantId === 'ffe367a89f' ||
      tenantId === 'ffe367a89f-test' ||
      tenantId === 'pnb' ||
      tenantId === 'pnb-test')
  )
}
