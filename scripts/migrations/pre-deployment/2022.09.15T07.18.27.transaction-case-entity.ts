import { StackConstants } from '@cdk/constants'
import { migrateAllTenants } from '../utils/tenant'
import { COUNTER_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { Case } from '@/@types/openapi-internal/Case'
import { Tenant } from '@/@types/openapi-internal/Tenant'
import { DefaultApiGetTransactionsListRequest } from '@/@types/openapi-internal/RequestParameters'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { CaseCreationService } from '@/lambdas/console-api-case/services/case-creation-service'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { CaseCaseUsers } from '@/@types/openapi-internal/CaseCaseUsers'
import { EntityCounter } from '@/@types/openapi-internal/EntityCounter'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { OptionalPagination } from '@/utils/pagination'

export async function migrateTenant(tenant: Tenant) {
  const dynamodb = await getDynamoDbClient()
  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)
  const mongoDbTransactionRepository = new MongoDbTransactionRepository(
    tenant.id,
    mongodb
  )
  const caseRepository = new CaseRepository(tenant.id, {
    mongoDb: mongodb,
  })
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb: dynamodb,
  })
  const userRepository = new UserRepository(tenant.id, {
    dynamoDb: dynamodb,
    mongoDb: mongodb,
  })
  const caseCreationService = new CaseCreationService(
    caseRepository,
    userRepository,
    ruleInstanceRepository,
    mongoDbTransactionRepository
  )
  const db = mongodb.db()
  const counterCollection = db.collection<EntityCounter>(
    COUNTER_COLLECTION(tenant.id)
  )

  const queryParams: OptionalPagination<DefaultApiGetTransactionsListRequest> =
    {
      pageSize: 'DISABLED',
    }
  queryParams.afterTimestamp = 0
  queryParams.beforeTimestamp = Date.now()
  const transactionsCursor =
    await mongoDbTransactionRepository.getTransactionsCursor(queryParams)
  let transaction = await transactionsCursor.next()
  while (transaction) {
    let createCase = false
    if (
      transaction?.caseStatus == 'OPEN' ||
      transaction?.caseStatus == 'REOPENED'
    ) {
      createCase = true
    } else {
      const transactionStatus =
        MongoDbTransactionRepository.getAggregatedRuleStatus(
          transaction.executedRules
            .filter((rule) => rule.ruleHit)
            .map((rule) => rule.ruleAction)
        )
      if (transactionStatus != 'ALLOW') {
        createCase = true
      }
    }
    if (createCase && transaction.transactionId) {
      // check existing case
      const existingCases = await caseRepository.getCasesByTransactionId(
        transaction.transactionId
      )
      let id: number
      if (!existingCases.length) {
        id =
          (
            await counterCollection.findOneAndUpdate(
              { entity: 'Case' },
              { $inc: { count: 1 } },
              { upsert: true, returnDocument: 'after' }
            )
          ).value?.count || 0
      } else {
        id = existingCases[0]._id as number
      }

      const transactionUsers = await caseCreationService.getUsers(
        transaction as TransactionWithRulesResult
      )
      const caseEntity = getCase(transaction, transactionUsers, id)
      await caseRepository.addCaseMongo(caseEntity)
    }
    transaction = await transactionsCursor.next()
  }
}

function getCase(
  transaction: TransactionCaseManagement,
  transactionUsers: (InternalBusinessUser | InternalConsumerUser)[],
  id: number
): Case {
  const caseUsers: CaseCaseUsers = {}
  for (const user of transactionUsers) {
    if (user.userId == transaction.originUserId) {
      caseUsers.origin = user
    } else if (user.userId == transaction.destinationUserId) {
      caseUsers.destination = user
    }
  }
  // in case user not in db yet
  if (!caseUsers.origin && transaction.originUserId) {
    caseUsers.origin = {
      userId: transaction.originUserId,
    }
  }
  if (!caseUsers.destination && transaction.destinationUserId) {
    caseUsers.destination = {
      userId: transaction.destinationUserId,
    }
  }

  const caseEntity: Case = {
    _id: id,
    caseId: `C-${id}`,
    comments: transaction.comments || [],
    assignments: transaction.assignments || [],
    createdTimestamp: transaction.timestamp,
    latestTransactionArrivalTimestamp: transaction.timestamp,
    priority: 'P1',
    relatedCases: [],
    statusChanges: transaction.statusChanges || [],
    caseUsers: caseUsers,
    caseTransactions: [transaction as TransactionWithRulesResult],
    caseStatus: transaction.caseStatus || 'OPEN',
  }
  return caseEntity
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skipping
}
