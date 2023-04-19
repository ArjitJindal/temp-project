import pMap from 'p-map'
import _ from 'lodash'
import { BatchJobRunner } from './batch-job-runner-base'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { OngoingScreeningUserRuleBatchJob } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RulesEngineService } from '@/services/rules-engine'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { UserRepository } from '@/services/users/repositories/user-repository'

const BATCH_SIZE = 1000

export class OngoingScreeningUserRuleBatchJobRunner extends BatchJobRunner {
  public async run(job: OngoingScreeningUserRuleBatchJob) {
    const { tenantId } = job
    const dynamoDb = getDynamoDbClient()

    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })

    const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()
    const isAnyRulesForOngoingScreening = ruleInstances.some((ruleInstance) => {
      return ruleInstance.type === 'USER' && ruleInstance.isOngoingScreening
    })

    if (!isAnyRulesForOngoingScreening) {
      return
    }

    const mongoDb = await getMongoDbClient()
    const userRepository = new UserRepository(tenantId, { mongoDb, dynamoDb })
    const rulesEngine = new RulesEngineService(tenantId, dynamoDb, mongoDb)
    const allUserIds = await userRepository.getAllUsersIds()
    const chunkedUserIds = _.chunk(allUserIds, BATCH_SIZE)

    while (chunkedUserIds.length > 0) {
      const userIds = chunkedUserIds.pop()

      if (!userIds) {
        break
      }

      const users = await userRepository.getUsers(userIds)

      await pMap(
        users,
        async (user) => {
          await rulesEngine.verifyUser(user, true)
        },
        { concurrency: 10 }
      )
    }
  }
}
