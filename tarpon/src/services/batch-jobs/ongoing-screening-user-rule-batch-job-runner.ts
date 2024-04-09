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
import { CaseCreationService } from '@/lambdas/console-api-case/services/case-creation-service'

const CONCURRENT_BATCH_SIZE = 100

export async function getOngoingScreeningUserRuleInstances(tenantId: string) {
  const isRiskLevelsEnabled = await tenantHasFeature(tenantId, 'RISK_LEVELS')
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })

  const ruleInstances = (
    await ruleInstanceRepository.getActiveRuleInstances('USER')
  ).filter((ruleInstance) => {
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
  mongoDb?: MongoClient
  tenantId?: string
  dynamoDb?: DynamoDBDocumentClient
  ruleInstanceRepository?: RuleInstanceRepository
  rulesEngineService?: RulesEngineService
  userRepository?: UserRepository
  caseCreationService?: CaseCreationService

  protected async run(job: OngoingScreeningUserRuleBatchJob): Promise<void> {
    const { tenantId } = job
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()

    this.mongoDb = mongoDb
    this.dynamoDb = dynamoDb
    this.tenantId = tenantId
    this.ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })
    this.rulesEngineService = new RulesEngineService(
      tenantId,
      dynamoDb,
      mongoDb
    )
    this.caseCreationService = new CaseCreationService(tenantId, {
      dynamoDb,
      mongoDb,
    })

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

    const usersCursor = userRepository.getAllUsersCursor()

    await processCursorInBatch<InternalUser>(
      usersCursor,
      async (usersChunk) => {
        await this.runUsersBatch(usersChunk, rules, ruleInstances)
      },
      { mongoBatchSize: 1000, processBatchSize: 1000 }
    )

    await this.verifyAllUserRules()
  }

  private async verifyAllUserRules() {
    const ruleInstances = await this.getUserOngoingScreeningRuleInstances()
    if (!ruleInstances.length) {
      return
    }

    const data = await this.rulesEngineService!.verifyAllUsersRules()

    await pMap(
      Object.keys(data),
      async (userId) => {
        const user = await this.userRepository!.getUserById(userId)

        if (!user) {
          return
        }

        const hitResults = data[userId].executedRules
        const existingHitResults = user.hitRules ?? []

        if (!isEqual(hitResults, existingHitResults)) {
          await this.userRepository!.updateUserWithExecutedRules(
            userId,
            data[userId].executedRules ?? [],
            data[userId].hitRules ?? []
          )
        }
      },
      { concurrency: CONCURRENT_BATCH_SIZE }
    )
  }

  private async getUserOngoingScreeningRuleInstances() {
    return await this.ruleInstanceRepository!.getActiveRuleInstances(
      'USER_ONGOING_SCREENING'
    )
  }

  private async runUsersBatch(
    usersChunk: InternalUser[],
    rules: readonly Rule[],
    ruleInstances: readonly RuleInstance[]
  ) {
    await pMap(
      usersChunk,
      async (user) => {
        const result = await this.rulesEngineService!.verifyUserByRules(
          user,
          ruleInstances,
          rules,
          { ongoingScreeningMode: true }
        )

        if (
          result.hitRules?.length &&
          !isEqual(user.hitRules ?? [], result.hitRules ?? [])
        ) {
          const timestampBeforeCasesCreation = Date.now()

          const cases = await this.caseCreationService!.handleUser({
            ...user,
            hitRules: result.hitRules,
            executedRules: result.executedRules,
          })

          await this.caseCreationService!.handleNewCases(
            this.tenantId!,
            timestampBeforeCasesCreation,
            cases
          )
        }
      },
      { concurrency: CONCURRENT_BATCH_SIZE }
    )
  }
}
