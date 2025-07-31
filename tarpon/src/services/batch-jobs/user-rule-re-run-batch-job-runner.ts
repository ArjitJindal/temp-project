import { MongoClient } from 'mongodb'
import pMap from 'p-map'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { RuleInstanceRepository } from '../rules-engine/repositories/rule-instance-repository'
import { RuleRepository } from '../rules-engine/repositories/rule-repository'
import {
  RuleIdsFor314ABusiness,
  RuleIdsFor314AConsumer,
} from '../rules-engine/utils/user-rule-utils'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { RulesEngineService } from '../rules-engine/rules-engine-service'
import { UserRepository } from '../users/repositories/user-repository'
import { mergeRules } from '../rules-engine/utils/rule-utils'
import { BatchJobRunner } from './batch-job-runner-base'
import { UserRuleReRunBatchJob } from '@/@types/batch-job'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { Rule } from '@/@types/openapi-internal/Rule'
import { pickKnownEntityFields } from '@/utils/object'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { logger } from '@/core/logger'

async function runRulesForUser(
  tenantId: string,
  type: 'BUSINESS' | 'CONSUMER',
  ruleInstances: RuleInstance[],
  rules: readonly Rule[],
  dynamoDb: DynamoDBDocumentClient,
  mongoDb: MongoClient,
  rulesEngineService: RulesEngineService
) {
  const userRepository = new UserRepository(tenantId, { dynamoDb, mongoDb })

  // get user cursor
  const db = mongoDb.db()
  const collectionName = USERS_COLLECTION(tenantId)
  const collection = db.collection<InternalConsumerUser | InternalBusinessUser>(
    collectionName
  )

  const cursor = collection.find({
    type,
  })

  await processCursorInBatch(
    cursor,
    async (users) => {
      await pMap(
        users,
        async (u) => {
          try {
            const user = pickKnownEntityFields(u, UserWithRulesResult)
            const { hitRules, executedRules } =
              await rulesEngineService.verifyUserByRules(
                user,
                ruleInstances,
                rules,
                'UPDATE'
              )
            const userToSave = {
              ...user,
              hitRules: mergeRules(user?.hitRules || [], hitRules || []),
              executedRules: mergeRules(
                user?.executedRules || [],
                executedRules || []
              ),
            }
            await userRepository.saveUser(userToSave, type)
          } catch (error) {
            logger.error(`Rule run failed for ${u.userId} : ${error}`)
          }
        },
        { concurrency: 50 }
      )
    },
    { mongoBatchSize: 1000, processBatchSize: 1000 }
  )
}

export class UserRuleReRunBatchJobRunner extends BatchJobRunner {
  protected async run(job: UserRuleReRunBatchJob): Promise<void> {
    const { ruleInstanceIds } = job.parameters
    const { tenantId } = job
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })
    const ruleInstances = await ruleInstanceRepository.getRuleInstancesByIds(
      ruleInstanceIds
    )
    const businessRuleInstances = ruleInstances.filter((ruleInstance) =>
      RuleIdsFor314ABusiness.includes(ruleInstance.ruleId ?? '')
    )
    const consumerRuleInstances = ruleInstances.filter((ruleInstance) =>
      RuleIdsFor314AConsumer.includes(ruleInstance.ruleId ?? '')
    )

    const ruleRepository = new RuleRepository(tenantId, { mongoDb, dynamoDb })
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const rulesEngineService = new RulesEngineService(
      tenantId,
      dynamoDb,
      logicEvaluator,
      mongoDb
    )

    if (consumerRuleInstances.length > 0) {
      // running for consumer user
      const consumerRules = await ruleRepository.getRulesByIds(
        consumerRuleInstances
          .map((ruleInstance) => ruleInstance.ruleId)
          .filter((ruleId): ruleId is string => ruleId !== undefined)
      )

      await runRulesForUser(
        tenantId,
        'CONSUMER',
        consumerRuleInstances,
        consumerRules,
        dynamoDb,
        mongoDb,
        rulesEngineService
      )
    }
    if (businessRuleInstances.length > 0) {
      // running for business user
      const businessRules = await ruleRepository.getRulesByIds(
        businessRuleInstances
          .map((ruleInstance) => ruleInstance.ruleId)
          .filter((ruleId): ruleId is string => ruleId !== undefined)
      )
      await runRulesForUser(
        tenantId,
        'BUSINESS',
        businessRuleInstances,
        businessRules,
        dynamoDb,
        mongoDb,
        rulesEngineService
      )
    }
  }
}
