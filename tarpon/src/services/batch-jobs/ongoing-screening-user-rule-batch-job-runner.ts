import pMap from 'p-map'
import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { isEqual } from 'lodash'
import { getTimeDiff } from '../rules-engine/utils/time-utils'
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
import { CaseCreationService } from '@/services/cases/case-creation-service'
import dayjs from '@/utils/dayjs'

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
    const schedule = ruleInstance.userRuleRunCondition?.schedule
    if (schedule) {
      // For now the frequency depends on the createdAt date of the rule instance. When a rule instance is created,
      // the rule will be run on the same day once and then every x time units.
      // TODO: Allow setting the start date (e.g every Monday, every 1st of the month, etc.)
      const diffTime = getTimeDiff(
        dayjs(),
        dayjs(ruleInstance.createdAt),
        schedule.unit.toLowerCase() as any
      )
      return diffTime % schedule.value === 0
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
  mongoDb?: MongoClient
  tenantId?: string
  dynamoDb?: DynamoDBDocumentClient
  ruleRepository?: RuleRepository
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
    this.ruleRepository = new RuleRepository(tenantId, {
      dynamoDb,
    })
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
    this.userRepository = new UserRepository(tenantId, {
      dynamoDb,
      mongoDb,
    })
    await Promise.all([
      this.verifyUsersSequentialMode(),
      this.verifyUsersAgglomerationMode(),
    ])
  }

  private async verifyUsersSequentialMode() {
    const ruleInstances = await getOngoingScreeningUserRuleInstances(
      this.tenantId ?? ''
    )

    if (ruleInstances.length === 0) {
      logger.info('No active ongoing screening user rule found. Skip.')
      return
    }
    const rules =
      (await this.ruleRepository?.getRulesByIds(
        ruleInstances.map((ruleInstance) => ruleInstance.ruleId ?? '')
      )) ?? []

    const usersCursor = this.userRepository?.getAllUsersCursor()
    if (usersCursor) {
      await processCursorInBatch<InternalUser>(
        usersCursor,
        async (usersChunk) => {
          await this.runUsersBatch(usersChunk, rules, ruleInstances)
        },
        { mongoBatchSize: 1000, processBatchSize: 1000 }
      )
    }
  }

  private async verifyUsersAgglomerationMode() {
    const ruleInstances =
      await this.ruleInstanceRepository?.getActiveRuleInstances(
        'USER_ONGOING_SCREENING'
      )
    if (!ruleInstances?.length) {
      logger.info('No active ongoing screening user rule (all) found. Skip.')
      return
    }
    if (!this.rulesEngineService) {
      throw new Error('Rules Engine Service is not initialized')
    }
    const data = await this.rulesEngineService.verifyAllUsersRules()
    if (!this.userRepository) {
      throw new Error('User Repository is not initialized')
    }
    await pMap(
      Object.keys(data),
      async (userId) => {
        const user = await this.userRepository?.getUserById(userId)
        if (!user) {
          return
        }

        const hitResults = data[userId].executedRules
        const existingHitResults = user.hitRules ?? []

        if (!isEqual(hitResults, existingHitResults)) {
          await this.userRepository?.updateUserWithExecutedRules(
            userId,
            data[userId].executedRules ?? [],
            data[userId].hitRules ?? []
          )
        }
      },
      { concurrency: CONCURRENT_BATCH_SIZE }
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
        const result = await this.rulesEngineService?.verifyUserByRules(
          user,
          ruleInstances,
          rules,
          { ongoingScreeningMode: true }
        )

        if (
          result?.hitRules?.length &&
          !isEqual(user.hitRules ?? [], result.hitRules ?? [])
        ) {
          const timestampBeforeCasesCreation = Date.now()

          const cases = await this.caseCreationService?.handleUser({
            ...user,
            hitRules: result.hitRules,
            executedRules: result.executedRules,
          })

          await this.caseCreationService?.handleNewCases(
            this.tenantId ?? '',
            timestampBeforeCasesCreation,
            cases ?? []
          )
        }
      },
      { concurrency: CONCURRENT_BATCH_SIZE }
    )
  }
}
