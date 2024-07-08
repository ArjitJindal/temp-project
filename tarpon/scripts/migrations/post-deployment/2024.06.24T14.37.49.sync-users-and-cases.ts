import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { CaseRepository } from '@/services/cases/repository'
import { Case } from '@/@types/openapi-internal/Case'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { logger } from '@/core/logger'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()

  const usersRepository = new UserRepository(tenant.id, {
    mongoDb,
  })
  const caseRepository = new CaseRepository(tenant.id, {
    mongoDb,
    dynamoDb,
  })

  const db = mongoDb.db()
  const collection = db.collection<Case>(CASES_COLLECTION(tenant.id))
  const syncedUsers = new Set<string>()
  for await (const c of collection.find({})) {
    const originUserId = c.caseUsers?.origin?.userId
    const destinationUserId = c.caseUsers?.destination?.userId
    if (originUserId && !syncedUsers.has(originUserId)) {
      const user = await usersRepository.getMongoUser(originUserId)
      if (user) {
        logger.info(`Syncing case users for user ${originUserId}`)
        await caseRepository.syncCaseUsers(user)
      }
      syncedUsers.add(originUserId)
    }
    if (destinationUserId && !syncedUsers.has(destinationUserId)) {
      const user = await usersRepository.getMongoUser(destinationUserId)
      if (user) {
        logger.info(`Syncing case users for user ${destinationUserId}`)
        await caseRepository.syncCaseUsers(user)
      }
      syncedUsers.add(destinationUserId)
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
