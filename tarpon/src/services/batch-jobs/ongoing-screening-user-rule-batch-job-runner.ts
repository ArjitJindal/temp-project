import pMap from 'p-map'
import { Collection, MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { backOff } from 'exponential-backoff'
import { getTimeDiff } from '../rules-engine/utils/time-utils'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { UserService } from '../users'
import { isOngoingUserRuleInstance } from '../rules-engine/utils/user-rule-utils'
import { ListRepository } from '../list/repositories/list-repository'
import { mergeRules } from '../rules-engine/utils/rule-utils'
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
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { ExecutedRulesResult } from '@/@types/openapi-internal/ExecutedRulesResult'
import {
  DELTA_SANCTIONS_COLLECTION,
  getSearchIndexName,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'

const CONCURRENT_BATCH_SIZE = process.env.SCREENING_CONCURRENT_BATCH_SIZE
  ? parseInt(process.env.SCREENING_CONCURRENT_BATCH_SIZE)
  : 10

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
    return isOngoingUserRuleInstance(ruleInstance, isRiskLevelsEnabled)
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
  userService?: UserService
  from?: string
  to?: string

  public async init(job: OngoingScreeningUserRuleBatchJob) {
    const tenantId = job.tenantId
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()

    this.mongoDb = mongoDb
    this.dynamoDb = dynamoDb
    this.tenantId = tenantId
    this.from = job.from
    this.to = job.to
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

  protected async run(job: OngoingScreeningUserRuleBatchJob): Promise<void> {
    await this.init(job)
    const sequentialUserRuleInstances =
      await getOngoingScreeningUserRuleInstances(this.tenantId ?? '')
    const agglomerationUserRules =
      (await this.ruleInstanceRepository?.getActiveRuleInstances(
        'USER_ONGOING_SCREENING'
      )) ?? []
    await Promise.all([
      this.verifyUsersSequentialMode(sequentialUserRuleInstances),
      this.verifyUsersAgglomerationMode(agglomerationUserRules),
    ])
  }

  public async verifyUsersSequentialMode(ruleInstances: RuleInstance[]) {
    if (ruleInstances.length === 0) {
      logger.info('No active ongoing screening user rule found. Skip.')
      return
    }
    const rules =
      (await this.ruleRepository?.getRulesByIds(
        ruleInstances.map((ruleInstance) => ruleInstance.ruleId ?? '')
      )) ?? []

    let preprocessedMatches: Set<string>

    let usersCursor = this.userRepository?.getAllUsersCursor()
    if (await tenantHasFeature(this.tenantId as string, 'PNB')) {
      let maxFuzziness = 0
      ruleInstances.forEach((r) => {
        const parameters: {
          fuzziness: number
          fuzzinessRange: {
            lowerBound: number
            upperBound: number
          }
        } = r.parameters
        if (parameters?.fuzziness) {
          if (parameters.fuzziness > maxFuzziness) {
            maxFuzziness = parameters.fuzziness
          }
        }
        if (
          parameters?.fuzzinessRange &&
          parameters?.fuzzinessRange?.upperBound &&
          parameters?.fuzzinessRange?.upperBound > maxFuzziness
        ) {
          maxFuzziness = parameters.fuzzinessRange.upperBound
        }
      })
      preprocessedMatches = await preprocessUsers(
        this.tenantId as string,
        maxFuzziness,
        this.mongoDb as MongoClient,
        this.dynamoDb as DynamoDBDocumentClient,
        this.from,
        this.to,
        ruleInstances
      )
      usersCursor = this.userRepository?.getUsersCursor({
        userId: { $in: Array.from(preprocessedMatches) },
      })
      logger.warn(
        `preprocessedMatches: ${Array.from(preprocessedMatches).length}`
      )
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

  private async runUsersBatch(
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
              result?.executedRules
                ?.filter(
                  (executedRule) =>
                    ruleInstances.find(
                      (ruleInstance) =>
                        ruleInstance.id === executedRule.ruleInstanceId
                    )?.userRuleRunCondition?.schedule
                )
                .forEach((executedRule) => {
                  updates[executedRule.ruleInstanceId] = {
                    hitCountDelta:
                      (updates[executedRule.ruleInstanceId]?.hitCountDelta ??
                        0) + (executedRule.ruleHit ? 1 : 0),
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

  private async createCase(
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

export async function preprocessUsers(
  tenantId: string,
  fuzziness: number,
  client: MongoClient,
  dynamoDb: DynamoDBDocumentClient,
  from?: string,
  to?: string,
  ruleInstances?: RuleInstance[]
) {
  const deltaSanctionsCollectionName = DELTA_SANCTIONS_COLLECTION(tenantId)
  const allNames: Set<string> = new Set()
  const sanctionsCollection = client
    .db()
    .collection<SanctionsEntity>(deltaSanctionsCollectionName)
  const usersCollection = client
    .db()
    .collection<InternalUser>(USERS_COLLECTION(tenantId))

  let match: any = {}
  if (from) {
    match = { id: { $gte: from } }
  }
  if (to) {
    match = { id: { ...match.id, $lt: to } }
  }
  const targetUserIds = new Set<string>()
  ;(
    await getUserIdsForODDRulesForPNB(
      ruleInstances ?? [],
      dynamoDb as DynamoDBDocumentClient
    )
  ).forEach((u) => {
    targetUserIds.add(u)
  })

  const mohaListUsers = await getMOHAListUserNames(
    dynamoDb,
    ruleInstances ?? []
  )

  const matchedMohaUsers = await usersCollection
    .find({
      'legalDocuments.documentNumber': {
        $in: mohaListUsers.filter((u) => u.documentId).map((u) => u.documentId),
      },
    })
    .toArray()

  matchedMohaUsers.forEach((u) => {
    targetUserIds.add(u.userId)
  })

  mohaListUsers.forEach((m) => {
    const isMatched = Boolean(
      matchedMohaUsers.find((u) =>
        u.legalDocuments?.find((d) => d.documentNumber === m.documentId)
      )
    )
    if (!isMatched) {
      allNames.add(m.name)
    }
  })

  for await (const sanctionsEntity of sanctionsCollection.find(match)) {
    const docIds = new Set<string>()

    sanctionsEntity.documents?.forEach((d) => {
      if (d.formattedId) {
        docIds.add(d.formattedId)
      }
      if (d.id) {
        docIds.add(d.id)
      }
    })
    const docIdMatchedUsers = await usersCollection
      .find({
        'legalDocuments.documentNumber': { $in: Array.from(docIds) },
      })
      .toArray()
    docIdMatchedUsers.forEach((d) => {
      targetUserIds.add(d.userId)
    })
    if (!docIdMatchedUsers.length) {
      const names: string[] = [
        sanctionsEntity.name,
        ...(sanctionsEntity.aka || []),
      ]
      names.forEach((n) => {
        allNames.add(n)
      })
    }
  }

  const allNamesArray = Array.from(allNames)
  await processNames(allNamesArray, targetUserIds, usersCollection, tenantId)

  return targetUserIds
}

async function processNames(
  allNames: string[],
  targetUserIds: Set<string>,
  usersCollection: Collection<InternalUser>,
  tenantId: string
) {
  const searchScoreThreshold = 7
  await pMap(
    allNames,
    async (name) => {
      const users = await usersCollection
        .aggregate([
          {
            $search: {
              index: getSearchIndexName(USERS_COLLECTION(tenantId)),
              text: {
                query: name,
                path: [
                  'userDetails.name.firstName',
                  'userDetails.name.middleName',
                  'userDetails.name.lastName',
                ],
                fuzzy: {
                  maxEdits: 2,
                  maxExpansions: 100,
                  prefixLength: 0,
                },
              },
            },
          },
          {
            $limit: 100,
          },
          {
            $addFields: {
              searchScore: { $meta: 'searchScore' },
            },
          },
          {
            $match: { searchScore: { $gt: searchScoreThreshold } },
          },
          {
            $project: {
              userId: 1,
            },
          },
        ])
        .toArray()
      users.forEach((u) => {
        targetUserIds.add(u.userId)
      })
    },
    { concurrency: 10 }
  )
}

async function getUserIdsForODDRulesForPNB(
  ruleInstances: RuleInstance[],
  dynamoDb: DynamoDBDocumentClient
) {
  const hasNonScreeningRules =
    ruleInstances.filter((r) => r.nature !== 'SCREENING').length > 0
  if (!hasNonScreeningRules) {
    return []
  }
  const listIds = ['06b705b0-66ad-4add-b49c-9457e5fefcce']
  const listRepository = new ListRepository(
    'pnb',
    dynamoDb as DynamoDBDocumentClient
  )
  const userIds: string[] = []
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
        listItems.items.map((i) => {
          if (typeof i.key === 'string') {
            userIds.push(i.key)
          }
        })
        fromCursorKey = listItems.next
        hasNext = listItems.hasNext
      }
    }
  }
  return userIds
}

async function getMOHAListUserNames(
  dynamoDb: DynamoDBDocumentClient,
  ruleInstances: RuleInstance[]
) {
  const listIds = ruleInstances
    .map((r) => {
      if (r.nature === 'SCREENING') {
        return r.parameters?.listId
      }
      return null
    })
    .filter(Boolean) as string[]
  const listRepository = new ListRepository('pnb', dynamoDb)
  const users: {
    name: string
    documentId: string
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
          users.push({
            name: i.key,
            documentId: i.metadata?.reason,
          })
        )
      }
    }
  }
  return users
}
