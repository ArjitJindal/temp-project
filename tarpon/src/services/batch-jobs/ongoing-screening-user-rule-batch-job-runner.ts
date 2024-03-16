import pMap from 'p-map'
import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { isEqual } from 'lodash'
import { BatchJobRunner } from './batch-job-runner-base'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { OngoingScreeningUserRuleBatchJob } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RulesEngineService } from '@/services/rules-engine'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { logger } from '@/core/logger'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { traceable } from '@/core/xray'
import { tenantHasFeature } from '@/core/utils/context'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { Rule } from '@/@types/openapi-internal/Rule'

const CONCURRENT_BATCH_SIZE = 100

export async function getOngoingScreeningUserRuleInstances(
  tenantId: string
): Promise<RuleInstance[]> {
  const dynamoDb = getDynamoDbClient()
  const isRiskLevelsEnabled = await tenantHasFeature(tenantId, 'RISK_LEVELS')
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })

  const allRuleInstancess = (
    await Promise.all([
      ruleInstanceRepository.getActiveRuleInstances('USER'),
      ruleInstanceRepository.getActiveRuleInstances('USER_ONGOING_SCREENING'),
    ])
  ).flat()

  const ruleInstances = allRuleInstancess.filter((ruleInstance) => {
    if (ruleInstance.type === 'USER_ONGOING_SCREENING') {
      return true
    }

    if (isRiskLevelsEnabled && ruleInstance.riskLevelParameters) {
      return Boolean(
        Object.values(ruleInstance.riskLevelParameters).find(
          (parameters) => parameters?.ongoingScreening
        )
      )
    }
    return Boolean(ruleInstance.parameters?.ongoingScreening)
  })

  return ruleInstances
}

@traceable
export class OngoingScreeningUserRuleBatchJobRunner extends BatchJobRunner {
  protected async run(job: OngoingScreeningUserRuleBatchJob): Promise<void> {
    const { tenantId } = job
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const ruleRepository = new RuleRepository(tenantId, {
      dynamoDb,
    })
    const userRepository = new UserRepository(tenantId, {
      dynamoDb,
      mongoDb,
    })

    const ruleInstances = await getOngoingScreeningUserRuleInstances(tenantId)
    if (ruleInstances.length === 0) {
      logger.info('No active ongoing screening user rule found. Abort.')
      return
    }
    const rules = await ruleRepository.getRulesByIds(
      ruleInstances.map((ruleInstance) => ruleInstance.ruleId!)
    )

    const usersCursor = await userRepository.getAllUsersCursor()

    await processCursorInBatch<InternalUser>(
      usersCursor,
      async (usersChunk) => {
        await this.runUsersBatch(
          tenantId,
          usersChunk,
          { mongoDb, dynamoDb },
          rules,
          ruleInstances,
          userRepository
        )
      },
      { mongoBatchSize: 1000, processBatchSize: 1000 }
    )
  }

  private async runUsersBatch(
    tenantId: string,
    usersChunk: InternalUser[],
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient },
    rules: readonly Rule[],
    ruleInstances: readonly RuleInstance[],
    userRepository: UserRepository
  ) {
    const { mongoDb, dynamoDb } = connections
    const rulesEngine = new RulesEngineService(tenantId, dynamoDb, mongoDb)

    await pMap(
      usersChunk,
      async (user) => {
        const result = await rulesEngine.verifyUserByRules(
          user,
          ruleInstances,
          rules,
          { ongoingScreeningMode: true }
        )

        if (
          result.hitRules?.length &&
          !isEqual(user.hitRules ?? [], result.hitRules ?? [])
        ) {
          await userRepository.updateUserWithExecutedRules(
            user.userId,
            result.executedRules ?? [],
            result.hitRules ?? []
          )
        }
      },
      { concurrency: CONCURRENT_BATCH_SIZE }
    )
  }
}
