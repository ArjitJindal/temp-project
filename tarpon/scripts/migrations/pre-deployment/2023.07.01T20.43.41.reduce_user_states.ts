import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { BusinessWithRulesResult } from '@/@types/openapi-internal/BusinessWithRulesResult'

const TRANSITIONS = {
  INACTIVE: 'DORMANT',
  DELETED: 'TERMINATED',
  UNDECIDED: 'CREATED',
} as const

async function migrateTenant(tenant: Tenant) {
  const { id: tenantId } = tenant
  const mongoDb = await getMongoDbClient()
  const dynamoDb = await getDynamoDbClient()
  const userRepo = new UserRepository(tenantId, { dynamoDb, mongoDb })

  // Strategy: find all users in deprecated states, then iterate through them and update both in dynamo and mongo

  const collectionName = USERS_COLLECTION(tenantId)
  const collection = mongoDb.db().collection<InternalUser>(collectionName)
  await collection.createIndex({ ['userStateDetails.state']: 1, _id: 1 })
  const usersToUpdateCursor = collection.find({
    'userStateDetails.state': { $in: Object.keys(TRANSITIONS) },
  })
  let counter = 0
  for await (const nextUser of usersToUpdateCursor) {
    const dynamoUser = await userRepo.getUser<
      UserWithRulesResult | BusinessWithRulesResult
    >(nextUser.userId)
    if (dynamoUser) {
      await userRepo.saveUser(
        {
          ...dynamoUser,
          userStateDetails: dynamoUser.userStateDetails && {
            ...dynamoUser.userStateDetails,
            state:
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              TRANSITIONS[nextUser.userStateDetails.state] ??
              dynamoUser.userStateDetails.state,
          },
        },
        nextUser.type
      )
    } else {
      console.warn(`User ${nextUser.userId} not found in dynamo`)
    }
    counter++
  }
  console.log(`Updated ${counter} users`)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
