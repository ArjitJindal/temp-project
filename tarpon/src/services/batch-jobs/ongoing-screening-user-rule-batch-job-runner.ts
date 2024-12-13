import pMap from 'p-map'
import { MongoClient, MongoError } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { backOff } from 'exponential-backoff'
import { search, sortKind } from 'fast-fuzzy'
import { getTimeDiff } from '../rules-engine/utils/time-utils'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { UserService } from '../users'
import { isOngoingUserRuleInstance } from '../rules-engine/utils/user-rule-utils'
import { ListRepository } from '../list/repositories/list-repository'
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
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { getUserName } from '@/utils/helpers'

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
      return diffTime % schedule.value === 0
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
    }
    const usersCursor = this.userRepository?.getAllUsersCursor(
      this.from,
      this.to
    )

    if (usersCursor) {
      await processCursorInBatch<InternalUser>(
        usersCursor,
        async (usersChunk) => {
          let filteredUsers = usersChunk
          if (preprocessedMatches) {
            filteredUsers = usersChunk.filter((u) =>
              preprocessedMatches.has(u.userId)
            )
          }
          await this.runUsersBatch(filteredUsers, rules, ruleInstances)
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
    const data = await this.rulesEngineService.verifyAllUsersRules(
      this.from,
      this.to
    )
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
            if (result?.hitRules && result.hitRules.length > 0) {
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

const USER_BATCH_SIZE = 1000

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
  const documentIds: Set<string> = new Set()
  const matches: Set<string> = new Set()
  const sanctionsCollection = client
    .db()
    .collection<SanctionsEntity>(deltaSanctionsCollectionName)
  const usersCollection = client
    .db()
    .collection<InternalUser>(USERS_COLLECTION(tenantId))

  let match: any = {}
  if (from) {
    match = { userId: { $gte: from } }
  }
  if (to) {
    match = { userId: { ...match.userId, $lt: to } }
  }
  const otherTargetUserIds = new Set(
    await getUserIdsForODDRulesForPNB(
      ruleInstances ?? [],
      dynamoDb as DynamoDBDocumentClient
    )
  )
  const mohaListUsers = await getMOHAListUserNames(
    dynamoDb,
    ruleInstances ?? []
  )
  for (const user of mohaListUsers) {
    allNames.add(user.name)
    documentIds.add(user.documentId)
  }
  for await (const sanctionsEntity of sanctionsCollection.find({})) {
    const names: string[] = [
      sanctionsEntity.name,
      ...(sanctionsEntity.aka || []),
    ]
    names.forEach((n) => {
      allNames.add(n)
    })
    sanctionsEntity.documents?.forEach((d) => {
      if (d.id) {
        documentIds.add(d.id)
      }
      if (d.formattedId) {
        documentIds.add(d.formattedId)
      }
    })
  }
  let usersCursor = usersCollection
    .find(match)
    .addCursorFlag('noCursorTimeout', true)
    .batchSize(USER_BATCH_SIZE)
  let pendingUsers: InternalUser[] = []
  let lastProcessedId: string | undefined = undefined
  let isCompleted = false
  const allNamesArray = Array.from(allNames)
  while (!isCompleted) {
    try {
      for await (const user of usersCursor) {
        pendingUsers.push(user)
        lastProcessedId = user.userId
        if (pendingUsers.length === USER_BATCH_SIZE) {
          await processUsersBatch({
            usersChunk: pendingUsers,
            allNames: allNamesArray,
            documentIds,
            otherTargetUserIds,
            fuzziness,
            matches,
          })
          pendingUsers = []
        }
      }
      if (pendingUsers.length > 0) {
        await processUsersBatch({
          usersChunk: pendingUsers,
          allNames: allNamesArray,
          documentIds,
          otherTargetUserIds,
          fuzziness,
          matches,
        })
      }
      isCompleted = true
    } catch (error) {
      if (error instanceof MongoError && error.code === 43) {
        logger.info('Cursor expired, retrying...')
        usersCursor = usersCollection
          .find({
            userId: {
              $gt: lastProcessedId,
              ...(to ? { $lt: to } : {}),
            },
          })
          .addCursorFlag('noCursorTimeout', true)
          .batchSize(USER_BATCH_SIZE)
        continue
      }
      throw error
    }
  }
  return matches
}

async function processUsersBatch({
  usersChunk,
  allNames,
  documentIds,
  otherTargetUserIds,
  fuzziness,
  matches,
}: {
  usersChunk: InternalUser[]
  allNames: string[]
  documentIds: Set<string>
  otherTargetUserIds: Set<string>
  fuzziness: number
  matches: Set<string>
}) {
  await pMap(
    usersChunk,
    (user) => {
      if (otherTargetUserIds && otherTargetUserIds.has(user.userId)) {
        matches.add(user.userId)
        return
      }
      const userName = getUserName(user)
      const fuzzyMatches = search(userName, allNames, {
        threshold: 1 - fuzziness / 100,
        limit: 1,
        sortBy: sortKind.insertOrder,
        ignoreCase: true,
      })
      if (fuzzyMatches.length > 0) {
        matches.add(user.userId)
        return
      }
      for (const d of user.legalDocuments ?? []) {
        if (documentIds.has(d.documentNumber)) {
          matches.add(user.userId)
          break
        }
      }
    },
    { concurrency: CONCURRENT_BATCH_SIZE }
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
