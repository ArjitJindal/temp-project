import _ from 'lodash'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { ListRepository } from '@/lambdas/console-api-list-importer/repositories/list-repository'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import usersData from '@/core/seed/data/users'
import { UserType } from '@/@types/user/user-type'
import listsData from '@/core/seed/data/lists'
import { FEATURES } from '@/@types/openapi-internal-custom/Feature'

export async function seedDynamo(
  dynamoDb: DynamoDBDocumentClient,
  tenantId: string
) {
  const userRepo = new UserRepository(tenantId, {
    dynamoDb: dynamoDb,
  })
  const listRepo = new ListRepository(tenantId, dynamoDb)
  const tenantRepo = new TenantRepository(tenantId, { dynamoDb })

  for (const user of usersData) {
    await userRepo.saveUser(_.omit(user, '_id'), (user as any).type as UserType)
  }
  for (const list of listsData) {
    await listRepo.createList(list.listType, list.subtype, list.data)
  }
  await tenantRepo.createOrUpdateTenantSettings({
    features: FEATURES,
  })
}
