import pMap from 'p-map'
import _ from 'lodash'
import { BatchJobRunner } from './batch-job-runner-base'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { OngoingScreeningUserRuleBatchJob } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RulesEngineService } from '@/services/rules-engine'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { logger } from '@/core/logger'
import { UserRepository } from '@/services/users/repositories/user-repository'

const CONCURRENT_BATCH_SIZE = 10

export class OngoingScreeningUserRuleBatchJobRunner extends BatchJobRunner {
  public async run(job: OngoingScreeningUserRuleBatchJob) {
    const { tenantId, userIds } = job
    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()
    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })
    const ruleRepository = new RuleRepository(tenantId, {
      dynamoDb,
    })
    const userRepository = new UserRepository(tenantId, {
      mongoDb,
    })

    const ruleInstances = (
      await ruleInstanceRepository.getActiveRuleInstances('USER')
    ).filter((ruleInstance) => ruleInstance.parameters?.ongoingScreening)
    if (ruleInstances.length === 0) {
      logger.info('No active ongoing screening user rule found. Abort.')
      return
    }
    const rules = await ruleRepository.getRulesByIds(
      ruleInstances.map((ruleInstance) => ruleInstance.ruleId)
    )
    const rulesEngine = new RulesEngineService(tenantId, dynamoDb, mongoDb)
    const users = await userRepository.getMongoUsersByIds(userIds)
    let processedUsers = 0
    for (const usersChunk of _.chunk(users, CONCURRENT_BATCH_SIZE)) {
      await pMap(
        usersChunk,
        async (user) => {
          await rulesEngine.verifyUserByRules(user, ruleInstances, rules)
        },
        { concurrency: CONCURRENT_BATCH_SIZE }
      )
      processedUsers += usersChunk.length
      logger.info(`Processed users ${processedUsers} / ${userIds.length}`)
    }
  }
}
