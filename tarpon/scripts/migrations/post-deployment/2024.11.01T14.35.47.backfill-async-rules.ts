import { memoize, omit } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient, getMongoDbClientDb } from '@/utils/mongodb-utils'
import dayjs from '@/utils/dayjs'
import {
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { RulesEngineService } from '@/services/rules-engine'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { pickKnownEntityFields } from '@/utils/object'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { logger } from '@/core/logger'
import { envIs } from '@/utils/env'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '@/utils/migration-progress'

const ASYNC_RULE_STOPPED_RUNNING_TIME = dayjs(
  '2024-10-31T13:00:00.000Z'
).valueOf()

async function migrateTenant(tenant: Tenant) {
  // only b4b is using async rules in prod
  if (envIs('prod') && tenant.id !== '0789ad73b8') {
    return
  }

  const dynamoDb = getDynamoDbClient()
  const db = await getMongoDbClientDb()
  const logicEvaluator = new LogicEvaluator(tenant.id, dynamoDb)
  const rulesEngineService = new RulesEngineService(
    tenant.id,
    dynamoDb,
    logicEvaluator,
    await getMongoDbClient()
  )
  const userRepository = new UserRepository(tenant.id, { dynamoDb })
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const ruleInstances = await ruleInstanceRepository.getActiveRuleInstances()
  const transactionAsyncRuleInstances = ruleInstances.filter(
    (ruleInstance) =>
      ruleInstance.type === 'TRANSACTION' &&
      ruleInstance.ruleExecutionMode === 'ASYNC'
  )
  const userAsyncRuleInstances = ruleInstances.filter(
    (ruleInstance) =>
      ruleInstance.type === 'USER' && ruleInstance.ruleExecutionMode === 'ASYNC'
  )
  const getUser = memoize(userRepository.getUser.bind(userRepository))

  if (transactionAsyncRuleInstances.length > 0) {
    const ruleInstanceIds = transactionAsyncRuleInstances.map((v) => v.id)
    const migrationKey = `2024.11.01T14.35.47.backfill-async-rules-tx-${tenant.id}`
    const lastCompletedTimestamp =
      (await getMigrationLastCompletedTimestamp(migrationKey)) ?? 0
    const txCursor = db
      .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenant.id))
      .find({
        updatedAt: {
          $gte: Math.max(
            lastCompletedTimestamp,
            ASYNC_RULE_STOPPED_RUNNING_TIME
          ),
        },
        executedRules: {
          $not: {
            $elemMatch: {
              ruleInstanceId: {
                $in: ruleInstanceIds,
              },
            },
          },
        },
      })
      .sort({ updatedAt: 1 })
    let count = 0
    for await (const tx of txCursor) {
      count++
      const [senderUser, receiverUser] = await Promise.all([
        tx.originUserId ? getUser<User | Business>(tx.originUserId) : undefined,
        tx.destinationUserId
          ? getUser<User | Business>(tx.destinationUserId)
          : undefined,
      ])
      await rulesEngineService.sendAsyncRuleTask({
        tenantId: tenant.id,
        type: 'TRANSACTION',
        transaction: pickKnownEntityFields(tx, Transaction),
        senderUser: omit<User | Business>(senderUser, [
          'executedRules',
          'hitRules',
          'status',
        ]) as User | Business | null,
        receiverUser: omit<User | Business>(receiverUser, [
          'executedRules',
          'hitRules',
          'status',
        ]) as User | Business | null,
      })
      await updateMigrationLastCompletedTimestamp(
        migrationKey,
        tx.updatedAt as number
      )
    }
    logger.info(`Processed ${count} transactions`)
  }
  if (userAsyncRuleInstances.length > 0) {
    const migrationKey = `2024.11.01T14.35.47.backfill-async-rules-user-${tenant.id}`
    const lastCompletedTimestamp =
      (await getMigrationLastCompletedTimestamp(migrationKey)) ?? 0
    const ruleInstanceIds = userAsyncRuleInstances.map((v) => v.id)
    const userCursor = db
      .collection<InternalConsumerUser | InternalBusinessUser>(
        USERS_COLLECTION(tenant.id)
      )
      .find({
        updatedAt: {
          $gte: Math.max(
            lastCompletedTimestamp,
            ASYNC_RULE_STOPPED_RUNNING_TIME
          ),
        },
        executedRules: {
          $not: {
            $elemMatch: {
              ruleInstanceId: {
                $in: ruleInstanceIds,
              },
            },
          },
        },
      })
      .sort({ updatedAt: 1 })
    let count = 0
    for await (const user of userCursor) {
      count++
      await rulesEngineService.sendAsyncRuleTask({
        type: 'USER',
        user:
          user.type === 'CONSUMER'
            ? pickKnownEntityFields(user, User)
            : pickKnownEntityFields(user, Business),
        tenantId: tenant.id,
        userType: user.type,
      })
      await updateMigrationLastCompletedTimestamp(
        migrationKey,
        user.updatedAt as number
      )
    }
    logger.info(`Processed ${count} users`)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
  throw new Error('stop')
}
export const down = async () => {
  // skip
}
