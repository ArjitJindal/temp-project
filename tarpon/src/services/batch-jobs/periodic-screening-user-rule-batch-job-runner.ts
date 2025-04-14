import pMap from 'p-map'
import { FindCursor, WithId } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { getTimeDiff } from '../rules-engine/utils/time-utils'
import { getODDUsersForPNB } from '../rules-engine/pnb-custom-logic'
import {
  getUsersFromLists,
  ScreeningUserRuleBatchJobRunnerBase,
} from './screening-user-rule-batch-job-runner-base'
import { processCursorInBatch } from '@/utils/mongodb-utils'
import { PeriodicScreeningUserRuleBatchJob } from '@/@types/batch-job'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { logger } from '@/core/logger'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { traceable } from '@/core/xray'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import dayjs from '@/utils/dayjs'
import { hasFeature } from '@/core/utils/context'
import { getDynamoDbClient } from '@/utils/dynamodb'

const CONCURRENT_BATCH_SIZE = process.env.SCREENING_CONCURRENT_BATCH_SIZE
  ? parseInt(process.env.SCREENING_CONCURRENT_BATCH_SIZE)
  : 10

export async function getPeriodicScreeningUserRuleInstances(
  tenantId?: string,
  dynamoDb?: DynamoDBDocumentClient
) {
  if (!tenantId || !dynamoDb) {
    return []
  }
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
      const diffTimeInDays = getTimeDiff(
        dayjs(),
        dayjs(ruleInstance.createdAt),
        'day'
      )
      return (
        diffTime % schedule.value === 0 ||
        (diffTimeInDays === 1 && !ruleInstance.runCount) // if the rule is created after starting the cron job but on the same day,
      )
    }
    return false
  })

  return ruleInstances
}

@traceable
export class PeriodicScreeningUserRuleBatchJobRunner extends ScreeningUserRuleBatchJobRunnerBase {
  constructor(jobId: string, tenantId?: string) {
    super(jobId)
    if (tenantId) {
      this.tenantId = tenantId
    }
  }

  protected async run(job: PeriodicScreeningUserRuleBatchJob): Promise<void> {
    await this.init(job)
    const sequentialUserRuleInstances =
      await getPeriodicScreeningUserRuleInstances(this.tenantId, this.dynamoDb)
    const agglomerationUserRules =
      (await this.ruleInstanceRepository?.getActiveRuleInstances(
        'USER_ONGOING_SCREENING'
      )) ?? []
    await Promise.all([
      this.verifyUsersSequentialMode(sequentialUserRuleInstances),
      this.verifyUsersAgglomerationMode(agglomerationUserRules),
    ])
  }

  public async verifyUsersSequentialMode(
    ruleInstances: RuleInstance[],
    inputUserCursor?: FindCursor<WithId<InternalUser>>
  ) {
    if (inputUserCursor && this.tenantId) {
      await this.init({
        type: 'PERIODIC_SCREENING_USER_RULE',
        tenantId: this.tenantId,
      })
    }
    if (ruleInstances.length === 0) {
      logger.info('No active periodic screening user rule found. Skip.')
      return
    }
    const rules =
      (await this.ruleRepository?.getRulesByIds(
        ruleInstances.map((ruleInstance) => ruleInstance.ruleId ?? '')
      )) ?? []

    let usersCursor =
      inputUserCursor ?? this.userRepository?.getAllUsersCursor()

    if (hasFeature('PNB')) {
      const { targetUserIds: pnbTargetUserIds } = await getODDUsersForPNB(
        getUsersFromLists,
        this.tenantId ?? 'pnb',
        this.dynamoDb || getDynamoDbClient(),
        ruleInstances
      )
      usersCursor = this.userRepository?.getUsersCursor({
        userId: { $in: Array.from(pnbTargetUserIds) },
      })
    }

    if (usersCursor) {
      await processCursorInBatch<InternalUser>(
        usersCursor,
        async (usersChunk) => {
          await this.runUsersBatch(usersChunk, rules, ruleInstances)
        },
        { mongoBatchSize: 1000, processBatchSize: 1000, debug: true }
      )
    }
  }

  private async verifyUsersAgglomerationMode(
    ruleInstances: readonly RuleInstance[]
  ) {
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
        const { hitRules, executedRules } = data[userId]
        if (hitRules && hitRules.length > 0) {
          await this.createCase(user, executedRules ?? [], hitRules)
        }
      },
      { concurrency: CONCURRENT_BATCH_SIZE }
    )
  }
}
