import pMap from 'p-map'

import { chunk, isEqual } from 'lodash'
import { BatchJobRunner } from './batch-job-runner-base'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { OngoingScreeningUserRuleBatchJob } from '@/@types/batch-job'
import { cleanUpDynamoDbResources, getDynamoDbClient } from '@/utils/dynamodb'
import { RulesEngineService } from '@/services/rules-engine'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { logger } from '@/core/logger'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'

const CONCURRENT_BATCH_SIZE = 10

export async function getOngoingScreeningUserRuleInstances(
  tenantId: string
): Promise<RuleInstance[]> {
  const dynamoDb = await getDynamoDbClient()
  const isPulseEnabled = await tenantHasFeature(tenantId, 'PULSE')
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })
  const ruleInstances = (
    await ruleInstanceRepository.getActiveRuleInstances('USER')
  ).filter((ruleInstance) => {
    if (isPulseEnabled) {
      return Boolean(
        Object.values(ruleInstance.riskLevelParameters ?? {}).find(
          (parameters) => parameters?.ongoingScreening
        )
      )
    }
    return Boolean(ruleInstance.parameters?.ongoingScreening)
  })
  return ruleInstances
}

export class OngoingScreeningUserRuleBatchJobRunner extends BatchJobRunner {
  protected async run(job: OngoingScreeningUserRuleBatchJob): Promise<any> {
    const { tenantId, userIds } = job
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const ruleRepository = new RuleRepository(tenantId, {
      dynamoDb,
    })
    const userRepository = new UserRepository(tenantId, {
      mongoDb,
    })

    const ruleInstances = await getOngoingScreeningUserRuleInstances(tenantId)
    if (ruleInstances.length === 0) {
      logger.info('No active ongoing screening user rule found. Abort.')
      return
    }
    const rules = await ruleRepository.getRulesByIds(
      ruleInstances.map((ruleInstance) => ruleInstance.ruleId)
    )
    const users = await userRepository.getMongoUsersByIds(userIds)
    let processedUsers = 0
    for (const usersChunk of chunk(users, CONCURRENT_BATCH_SIZE)) {
      const dynamoDb = getDynamoDbClient()
      const rulesEngine = new RulesEngineService(tenantId, dynamoDb, mongoDb)
      const userRepository = new UserRepository(tenantId, { dynamoDb })
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
            !isEqual(user.executedRules || [], result.executedRules || []) ||
            !isEqual(user.hitRules || [], result.hitRules || [])
          ) {
            await userRepository.updateUserWithExecutedRules(
              user.userId,
              result.executedRules,
              result.hitRules
            )
          }
        },
        { concurrency: CONCURRENT_BATCH_SIZE }
      )
      processedUsers += usersChunk.length
      cleanUpDynamoDbResources()
      logger.info(`Processed users ${processedUsers} / ${userIds.length}`)
    }
  }
}
