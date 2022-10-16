// import { getTestDynamoDbClient } from '../src/test-utils/dynamodb-test-utils'

import { UserRepository } from '../src/services/users/repositories/user-repository'
import { UserType } from '../src/@types/user/user-type'
import { TENANT } from './settings'
import users from './mongo_users'
import { getDynamoDbClient } from '@/utils/dynamodb'

export default async function main() {
  // const dynamoDb = getTestDynamoDbClient()
  const dynamoDb = getDynamoDbClient()
  const userRepo = new UserRepository(TENANT, {
    dynamoDb: dynamoDb,
  })
  for (const user of users) {
    await userRepo.saveUser(user, (user as any).type as UserType)
  }
}
