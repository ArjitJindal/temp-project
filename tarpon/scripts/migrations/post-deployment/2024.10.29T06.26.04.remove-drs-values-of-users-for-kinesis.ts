import { StackConstants } from '@lib/constants'
import { DeleteCommand, DeleteCommandInput } from '@aws-sdk/lib-dynamodb'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { getDynamoDbClient } from '@/utils/dynamodb'

const tenantId = '8dd4272ea1'
const userIds = [
  'fadd9ef4-b951-4cb2-93b6-ddd254b16b26',
  'd2ef38d1-20e6-498c-af05-7e61b6b19fd0',
  'e077d1e9-e5ee-4dcf-a6e6-ab2c4063745b',
  '4f201308-7d67-46bb-a7b0-b8c1c0bfa46f',
  '5e6c58fb-32fc-4b89-80ae-aa9eb9ac4ae9',
  '7ee3eef9-4b91-4b55-9d12-ae6a04a0135f',
  '68e5f097-f3f6-427b-8af5-defe9dd54983',
  '6ef23084-476a-4aaf-8bd8-bfc46d1e9d48',
  'ht7b4aca78-b44c-447e-900a-0bb236280e9f',
  '83cd5b75-91e9-419e-bace-4ee543091474',
  '91aeaa2f-b37c-4f8d-b12d-1e5a79d1c847',
  '92d005db-be26-4b92-8c3c-7fb1194630ef',
  'a8a02d7d-073d-48ed-8469-7d4f13d4848c',
  'afd08951-1b6d-49cb-9f82-6c2ad06a433d',
  'b7386fc6-9df2-4d69-8553-2a912234290d',
  'bde28880-b859-4669-b138-39c4cbe32964',
  'd291a63b-14ec-4e17-b5be-989de4a85568',
  'd60a997a-3b1d-400b-8b15-dfabede14faa',
  'e700acc3-3395-48e6-8980-188e971083c0',
  'f55d3399-b65c-4009-a75b-4cd781700972',
  '2dd9b0ce-b8d0-4b4d-bdda-ef2e1d98c323',
  '36b04425-2b3a-4a8e-a4fa-ea69d3f39ff0',
]

async function migrateTenant(tenant: Tenant) {
  if (tenant.id !== tenantId) {
    return
  }
  const dynamoDb = getDynamoDbClient()
  for (const userId of userIds) {
    const primaryKey = DynamoDbKeys.DRS_VALUE_ITEM(tenantId, userId, '1')
    const deleteItemInput: DeleteCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(tenantId),
      Key: primaryKey,
    }
    await dynamoDb.send(new DeleteCommand(deleteItemInput))
    console.log(`Deleted DRS for ${userId}`)
  }
  console.log(`Removed DRS for ${userIds.length} users`)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
