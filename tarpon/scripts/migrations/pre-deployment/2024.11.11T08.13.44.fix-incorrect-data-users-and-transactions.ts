import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts/repository'
import {
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const userRepository = new UserRepository(tenant.id, {
    dynamoDb,
    mongoDb,
  })
  const dynamoTransactionRepository = new DynamoDbTransactionRepository(
    tenant.id,

    dynamoDb
  )
  const mongoTransactionRepository = new MongoDbTransactionRepository(
    tenant.id,
    mongoDb
  )
  const db = mongoDb.db()

  const users = db.collection<InternalUser>(USERS_COLLECTION(tenant.id)).find({
    createdTimestamp: { $exists: false },
  })

  for await (const user of users) {
    const userData = (await userRepository.getUser(user.userId)) as InternalUser

    if (userData) {
      await userRepository.saveUserMongo(userData)
    }
  }

  const transactions = db
    .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenant.id))
    .find({
      timestamp: { $exists: false },
    })

  for await (const transaction of transactions) {
    const transactionData =
      (await dynamoTransactionRepository.getTransactionById(
        transaction.transactionId
      )) as InternalTransaction

    if (transactionData) {
      await mongoTransactionRepository.addTransactionToMongo(transactionData)
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
