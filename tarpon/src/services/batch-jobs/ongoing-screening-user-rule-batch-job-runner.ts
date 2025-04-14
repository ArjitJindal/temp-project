import pMap from 'p-map'
import { Collection, FindCursor, MongoClient, WithId } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { compact } from 'lodash'
import { isOngoingUserRuleInstance } from '../rules-engine/utils/user-rule-utils'
import { getMohaUsersForPNB } from '../rules-engine/pnb-custom-logic'
import {
  getDefaultProviders,
  getSanctionsCollectionName,
} from '../sanctions/utils'
import {
  getUsersFromLists,
  ScreeningUserRuleBatchJobRunnerBase,
} from './screening-user-rule-batch-job-runner-base'
import { processCursorInBatch } from '@/utils/mongodb-utils'
import { OngoingScreeningUserRuleBatchJob } from '@/@types/batch-job'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { logger } from '@/core/logger'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { traceable } from '@/core/xray'
import {
  hasFeature,
  tenantHasEitherFeatures,
  tenantHasFeature,
} from '@/core/utils/context'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import {
  getSearchIndexName,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'

export async function getOngoingScreeningUserRuleInstances(
  tenantId: string,
  dynamoDb?: DynamoDBDocumentClient
) {
  if (!tenantId || !dynamoDb) {
    return []
  }
  const isRiskLevelsEnabled = await tenantHasFeature(tenantId, 'RISK_LEVELS')
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })

  const ruleInstances = (
    await ruleInstanceRepository.getActiveRuleInstances('USER')
  ).filter((ruleInstance) => {
    const schedule = ruleInstance.userRuleRunCondition?.schedule
    if (schedule) {
      return false
    }
    return isOngoingUserRuleInstance(ruleInstance, isRiskLevelsEnabled)
  })

  return ruleInstances
}

@traceable
export class OngoingScreeningUserRuleBatchJobRunner extends ScreeningUserRuleBatchJobRunnerBase {
  constructor(jobId: string, tenantId?: string) {
    super(jobId)
    if (tenantId) {
      this.tenantId = tenantId
    }
  }

  protected async run(job: OngoingScreeningUserRuleBatchJob): Promise<void> {
    await this.init(job)
    const sequentialUserRuleInstances =
      await getOngoingScreeningUserRuleInstances(
        this.tenantId ?? '',
        this.dynamoDb
      )
    await this.verifyUsersSequentialMode(sequentialUserRuleInstances)
  }

  public async verifyUsersSequentialMode(
    ruleInstances: RuleInstance[],
    inputUserCursor?: FindCursor<WithId<InternalUser>>
  ) {
    if (inputUserCursor && this.tenantId) {
      await this.init({
        type: 'ONGOING_SCREENING_USER_RULE',
        tenantId: this.tenantId,
      })
    }
    if (ruleInstances.length === 0) {
      logger.info('No active ongoing screening user rule found. Skip.')
      return
    }
    const rules =
      (await this.ruleRepository?.getRulesByIds(
        ruleInstances.map((ruleInstance) => ruleInstance.ruleId ?? '')
      )) ?? []

    let preprocessedMatches: Set<string>

    let usersCursor =
      inputUserCursor ?? this.userRepository?.getAllUsersCursor()
    //TODO: remove feature flag PNB we have search index for user collection
    if (
      await tenantHasEitherFeatures(this.tenantId as string, [
        'DOW_JONES',
        'OPEN_SANCTIONS',
        'ACURIS',
      ])
    ) {
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
}

export async function preprocessUsers(
  tenantId: string,
  client: MongoClient,
  dynamoDb: DynamoDBDocumentClient,
  from?: string,
  to?: string,
  ruleInstances?: RuleInstance[]
) {
  const providers = getDefaultProviders()
  const deltaSanctionsCollectionName = getSanctionsCollectionName(
    {
      provider: providers[0],
    },
    tenantId,
    'delta'
  )
  const sanctionsCollection = client
    .db()
    .collection<SanctionsEntity>(deltaSanctionsCollectionName)
  const usersCollection = client
    .db()
    .collection<InternalUser>(USERS_COLLECTION(tenantId))

  let match: any = {
    provider: {
      $in: providers,
    },
  }
  if (from) {
    match = { id: { $gte: from } }
  }
  if (to) {
    match = { id: { ...match.id, $lt: to } }
  }

  const allNames: Set<string> = new Set()
  const targetUserIds = new Set<string>()

  if (hasFeature('PNB')) {
    // MOHA List users
    const { targetUserIds: pnbTargetUserIds, allNames: pnbAllNames } =
      await getMohaUsersForPNB(
        getUsersFromLists,
        tenantId,
        dynamoDb,
        usersCollection,
        ruleInstances
      )
    pnbTargetUserIds.forEach((id) => targetUserIds.add(id))
    pnbAllNames.forEach((name) => allNames.add(name))
  }

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
  await processNames(
    compact(allNamesArray),
    targetUserIds,
    usersCollection,
    tenantId
  )

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
                  'legalEntity.companyGeneralDetails.legalName',
                  'directors.generalDetails.name.firstName',
                  'directors.generalDetails.name.middleName',
                  'directors.generalDetails.name.lastName',
                  'shareHolders.generalDetails.name.firstName',
                  'shareHolders.generalDetails.name.middleName',
                  'shareHolders.generalDetails.name.lastName',
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
