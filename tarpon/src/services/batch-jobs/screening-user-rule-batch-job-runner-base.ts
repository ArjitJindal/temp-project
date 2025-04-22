import pMap from 'p-map'
import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { backOff } from 'exponential-backoff'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { UserService } from '../users'
import { ListRepository } from '../list/repositories/list-repository'
import { mergeRules } from '../rules-engine/utils/rule-utils'
import { BatchJobRunner } from './batch-job-runner-base'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  OngoingScreeningUserRuleBatchJob,
  PeriodicScreeningUserRuleBatchJob,
} from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RulesEngineService } from '@/services/rules-engine'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { traceable } from '@/core/xray'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { Rule } from '@/@types/openapi-internal/Rule'
import { CaseCreationService } from '@/services/cases/case-creation-service'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { ExecutedRulesResult } from '@/@types/openapi-internal/ExecutedRulesResult'

const CONCURRENT_BATCH_SIZE = process.env.SCREENING_CONCURRENT_BATCH_SIZE
  ? parseInt(process.env.SCREENING_CONCURRENT_BATCH_SIZE)
  : 10

@traceable
export abstract class ScreeningUserRuleBatchJobRunnerBase extends BatchJobRunner {
  mongoDb?: MongoClient
  dynamoDb?: DynamoDBDocumentClient
  ruleRepository?: RuleRepository
  ruleInstanceRepository?: RuleInstanceRepository
  rulesEngineService?: RulesEngineService
  userRepository?: UserRepository
  caseCreationService?: CaseCreationService
  userService?: UserService
  from?: string
  to?: string
  tenantId?: string
  constructor(jobId: string, tenantId?: string) {
    super(jobId)
    if (tenantId) {
      this.tenantId = tenantId
    }
  }
  public async init(
    job: PeriodicScreeningUserRuleBatchJob | OngoingScreeningUserRuleBatchJob
  ) {
    const tenantId = job.tenantId
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
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    this.rulesEngineService = new RulesEngineService(
      tenantId,
      dynamoDb,
      logicEvaluator,
      mongoDb
    )
    this.caseCreationService = new CaseCreationService(tenantId, {
      dynamoDb,
      mongoDb,
    })
    this.userService = new UserService(tenantId, {
      dynamoDb,
      mongoDb,
    })
    this.userRepository = this.userService.userRepository
  }

  protected abstract run(
    job: PeriodicScreeningUserRuleBatchJob | OngoingScreeningUserRuleBatchJob
  ): Promise<void>

  public async runUsersBatch(
    usersChunk: InternalUser[],
    rules: readonly Rule[],
    ruleInstances: readonly RuleInstance[]
  ) {
    const updates: {
      [key: string]: {
        hitCountDelta: number
        runCountDelta: number
      }
    } = {}
    await backOff(
      async () => {
        await pMap(
          usersChunk,
          async (user) => {
            const result = await this.rulesEngineService?.verifyUserByRules(
              user,
              ruleInstances,
              rules,
              'ONGOING'
            )

            // We only update when there are no hit rules else we will update the user in consumer
            if (!result?.hitRules?.length) {
              const newExecutedRules = result?.executedRules?.filter(
                (e) =>
                  !user.executedRules?.find(
                    (er) => er.ruleInstanceId === e.ruleInstanceId
                  )
              )
              newExecutedRules
                ?.filter(
                  (executedRule) =>
                    ruleInstances.find(
                      (ruleInstance) =>
                        ruleInstance.id === executedRule.ruleInstanceId
                    )?.userRuleRunCondition?.schedule
                )
                .forEach((executedRule) => {
                  const isNewHit =
                    executedRule.ruleHit &&
                    !user.executedRules?.find(
                      (er) => er.ruleInstanceId === executedRule.ruleInstanceId
                    )?.ruleHit
                  updates[executedRule.ruleInstanceId] = {
                    hitCountDelta:
                      (updates[executedRule.ruleInstanceId]?.hitCountDelta ??
                        0) + (isNewHit ? 1 : 0),
                    runCountDelta:
                      (updates[executedRule.ruleInstanceId]?.runCountDelta ??
                        0) + 1,
                  }
                })
            } else {
              const mergedExecutedRules = mergeRules(
                user.executedRules ?? [],
                result?.executedRules ?? []
              )
              const mergedHitRules = mergeRules(
                user.hitRules ?? [],
                result?.hitRules ?? []
              )

              await Promise.all([
                this.createCase(
                  user,
                  result.executedRules ?? [],
                  result.hitRules
                ),
                this.userService?.handleUserStatusUpdateTrigger(
                  result.hitRules,
                  ruleInstances.filter((ruleInstance) =>
                    result.hitRules?.some(
                      (hitRule) => hitRule.ruleInstanceId === ruleInstance.id
                    )
                  ),
                  user,
                  null
                ),
                this.userService?.userRepository?.updateUserWithExecutedRules(
                  user.userId,
                  mergedExecutedRules,
                  mergedHitRules
                ),
              ])
            }
          },
          { concurrency: CONCURRENT_BATCH_SIZE }
        )
      },
      {
        numOfAttempts: 5,
      }
    )
    await this.ruleInstanceRepository?.updateRuleInstanceStatsCount(updates)
  }

  public async createCase(
    user: InternalUser,
    executedRules: ExecutedRulesResult[],
    hitRules: HitRulesDetails[]
  ) {
    const timestampBeforeCasesCreation = Date.now()

    const cases = await this.caseCreationService?.handleUser({
      ...user,
      hitRules,
      executedRules,
    })

    await this.caseCreationService?.handleNewCases(
      this.tenantId ?? '',
      timestampBeforeCasesCreation,
      cases ?? []
    )
  }
}

export const getUsersFromLists = async (
  tenantId: string,
  dynamoDb: DynamoDBDocumentClient,
  listIds: string[]
) => {
  const listRepository = new ListRepository(tenantId, dynamoDb)
  const entities: {
    key: string
    value: string
  }[] = []
  for await (const listId of listIds) {
    const listHeader = await listRepository.getListHeader(listId)
    if (listHeader) {
      let fromCursorKey: string | undefined
      let hasNext = true
      while (hasNext) {
        const listItems = await listRepository.getListItems(
          listId,
          {
            pageSize: 100,
            fromCursorKey,
          },
          listHeader.version
        )
        fromCursorKey = listItems.next
        hasNext = listItems.hasNext
        listItems.items.map((i) =>
          entities.push({
            key: i.key,
            value: i.metadata?.reason,
          })
        )
      }
    }
  }
  return entities
}
