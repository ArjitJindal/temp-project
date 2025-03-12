import { omit, pick } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient, withTransaction } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts/repository'
import {
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { RiskScoringService } from '@/services/risk-scoring/risk-scoring-service'
import {
  INTERNAL_ONLY_TX_ATTRIBUTES,
  INTERNAL_ONLY_USER_ATTRIBUTES,
} from '@/lambdas/tarpon-change-mongodb-consumer/app'
import { DYNAMO_KEYS } from '@/core/seed/dynamodb'
import { TransactionWithRulesResult } from '@/@types/openapi-internal/TransactionWithRulesResult'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { isBusinessUser } from '@/services/rules-engine/utils/user-rule-utils'
import { Business } from '@/@types/openapi-internal/Business'
import { User } from '@/@types/openapi-public/User'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'

const fixDuplicateTransactions = async (tenant: Tenant) => {
  const mongoClient = await getMongoDbClient()
  const dynamoDbClient = getDynamoDbClient()
  const dynamoDbTransactionRepo = new DynamoDbTransactionRepository(
    tenant.id,
    dynamoDbClient
  )
  const mongoTransactionRepo = new MongoDbTransactionRepository(
    tenant.id,
    mongoClient,
    dynamoDbClient
  )
  const riskScoringService = new RiskScoringService(tenant.id, {
    dynamoDb: dynamoDbClient,
    mongoDb: mongoClient,
  })
  const db = mongoClient.db()

  const collection = db.collection<InternalTransaction>(
    TRANSACTIONS_COLLECTION(tenant.id)
  )

  const transactions = collection.aggregate<{ transactionId: string }>(
    [
      {
        $group: {
          _id: '$transactionId',
          count: { $sum: 1 },
          transactionIds: { $addToSet: '$transactionId' },
        },
      },
      { $match: { count: { $gt: 1 } } },
      {
        $project: {
          transactionId: '$_id',
          _id: 0,
        },
      },
    ],
    { allowDiskUse: true }
  )

  for await (const transaction of transactions) {
    const id = transaction.transactionId

    console.log(`Fixing duplicate transactions for tenant ${tenant.id} - ${id}`)

    const [transactionInDynamo, arsScore] = await Promise.all([
      dynamoDbTransactionRepo.getTransactionById(id),
      riskScoringService.getArsScore(id),
    ])

    if (!transactionInDynamo) {
      console.log(`Transaction ${id} not found in dynamo`)
      continue
    }

    console.log(
      `Deleting duplicate transactions for tenant ${tenant.id} - ${id}`
    )

    await withTransaction(async (session) => {
      await collection.deleteMany({ transactionId: id }, { session })

      console.log(`Saving transaction to mongo for tenant ${tenant.id} - ${id}`)

      const transactionToSave = {
        ...pick(transactionInDynamo, INTERNAL_ONLY_TX_ATTRIBUTES),
        ...(omit(
          transactionInDynamo,
          DYNAMO_KEYS
        ) as TransactionWithRulesResult),
      }

      const plainTransaction = JSON.parse(JSON.stringify(transactionToSave))

      if (plainTransaction._id && plainTransaction._id.$oid) {
        plainTransaction._id = plainTransaction._id.$oid
      }

      await mongoTransactionRepo.addTransactionToMongo(
        plainTransaction,
        arsScore,
        { session }
      )
    })

    console.log(`Transaction saved to mongo for tenant ${tenant.id} - ${id}`)
  }
}

const fixDuplicateUsers = async (tenant: Tenant) => {
  const mongoClient = await getMongoDbClient()
  const dynamoDbClient = getDynamoDbClient()
  const userRepository = new UserRepository(tenant.id, {
    dynamoDb: dynamoDbClient,
    mongoDb: mongoClient,
  })
  const riskRepository = new RiskRepository(tenant.id, {
    dynamoDb: dynamoDbClient,
    mongoDb: mongoClient,
  })

  const collection = mongoClient
    .db()
    .collection<InternalUser>(USERS_COLLECTION(tenant.id))

  const users = collection.aggregate<{ userId: string }>([
    {
      $group: {
        _id: '$userId',
        count: { $sum: 1 },
        userIds: { $addToSet: '$userId' },
      },
    },
    { $match: { count: { $gt: 1 } } },
    {
      $project: {
        userId: '$_id',
        _id: 0,
      },
    },
  ])

  for await (const user of users) {
    const id = user.userId

    console.log(`Fixing duplicate users for tenant ${tenant.id} - ${id}`)

    const [userInDynamo, drsScore, krsScore] = await Promise.all([
      userRepository.getUser<User | Business>(id),
      riskRepository.getDrsScore(id),
      riskRepository.getKrsScore(id),
    ])

    if (!userInDynamo) {
      console.log(`User ${id} not found in dynamo`)
      continue
    }

    console.log(`Deleting duplicate users for tenant ${tenant.id} - ${id}`)

    await withTransaction(async (session) => {
      await collection.deleteMany({ userId: id }, { session })

      console.log(`Saving user to mongo for tenant ${tenant.id} - ${id}`)

      const userToSave: InternalConsumerUser | InternalBusinessUser = {
        ...pick(userInDynamo, INTERNAL_ONLY_USER_ATTRIBUTES),
        ...(omit(userInDynamo, DYNAMO_KEYS) as InternalUser),
        ...(drsScore && { drsScore }),
        ...(krsScore && { krsScore }),
        type: isBusinessUser(userInDynamo) ? 'BUSINESS' : 'CONSUMER',
      }

      console.log(`Saving user to mongo for tenant ${tenant.id} - ${id}`)
      await userRepository.saveUserMongo(userToSave, { session })
    })

    console.log(`User saved to mongo for tenant ${tenant.id} - ${id}`)
  }
}

const TENANT_IDS_TO_SKIP = ['QEO03JYKBT', 'U7O12AVVL9'].map((id) =>
  id.toLocaleLowerCase()
)

async function migrateTenant(tenant: Tenant) {
  if (TENANT_IDS_TO_SKIP.includes(tenant.id.toLocaleLowerCase())) {
    return
  }

  console.log(`Migrating tenant ${tenant.id}`)
  console.log(`Fixing duplicate users for tenant ${tenant.id}`)
  await fixDuplicateUsers(tenant)
  console.log(`Done fixing duplicate users for tenant ${tenant.id}`)
  console.log(`Fixing duplicate transactions for tenant ${tenant.id}`)
  await fixDuplicateTransactions(tenant)
  console.log(`Done fixing duplicate transactions for tenant ${tenant.id}`)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
