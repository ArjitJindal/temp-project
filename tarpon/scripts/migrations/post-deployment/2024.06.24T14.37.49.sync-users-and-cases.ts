import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { UserUpdateRequest } from '@/@types/openapi-internal/UserUpdateRequest'
import { CaseRepository } from '@/services/cases/repository'

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

  const allUsersCursor = usersRepository.getAllUsersCursor()
  for await (const user of allUsersCursor) {
    const updateRequest: UserUpdateRequest = {}
    if (user.userStateDetails) {
      updateRequest.userStateDetails = {
        ...user.userStateDetails,
        reason: user.userStateDetails.reason ?? 'Migration',
      }
    }
    if (user.kycStatusDetails) {
      updateRequest.kycStatusDetails = {
        ...user.kycStatusDetails,
        reason: user.kycStatusDetails.reason ?? 'Migration',
      }
    }
    if (user.transactionLimits) {
      updateRequest.transactionLimits = user.transactionLimits
    }

    await caseRepository.syncUsersCases(user.userId, updateRequest)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
