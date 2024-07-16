import { migrateAllTenants } from '../utils/tenant'
import { ListRepository } from '@/services/list/repositories/list-repository'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  const tenantId = tenant.id
  if (tenantId === 'cypress-tenant') {
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(tenantId, dynamoDb)
    const exixtingLists = await listRepo.getListHeaders('BLACKLIST')
    for (const list of exixtingLists) {
      await listRepo.deleteList(list.listId)
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
