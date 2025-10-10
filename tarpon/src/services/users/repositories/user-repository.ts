import {
  ClientSession,
  Document,
  Filter,
  FindCursor,
  MongoClient,
  UpdateFilter,
  WithId,
} from 'mongodb'
import { StackConstants } from '@lib/constants'
import { v4 as uuidv4 } from 'uuid'
import {
  DeleteCommand,
  DeleteCommandInput,
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  PutCommand,
  PutCommandInput,
  QueryCommand,
  QueryCommandInput,
  UpdateCommand,
  UpdateCommandInput,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb'
import get from 'lodash/get'
import isEmpty from 'lodash/isEmpty'
import keyBy from 'lodash/keyBy'
import mapValues from 'lodash/mapValues'
import mergeWith from 'lodash/mergeWith'
import omit from 'lodash/omit'
import set from 'lodash/set'
import uniq from 'lodash/uniq'
import { getRiskLevelFromScore } from '@flagright/lib/utils'
import {
  getUsersFilterByRiskLevel,
  insertRiskScores,
} from '../utils/user-utils'
import { Comment } from '@/@types/openapi-internal/Comment'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import {
  internalMongoUpdateOne,
  paginateFindOptions,
  paginatePipeline,
  prefixRegexMatchFilter,
  regexMatchFilter,
} from '@/utils/mongodb-utils'
import { DAY_DATE_FORMAT } from '@/core/constants'
import {
  UNIQUE_TAGS_COLLECTION,
  CASES_COLLECTION,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongo-table-names'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { UserType } from '@/@types/user/user-type'
import { FilterOperator } from '@/@types/openapi-internal/FilterOperator'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { UsersUniquesField } from '@/@types/openapi-internal/UsersUniquesField'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { hasFeature } from '@/core/utils/context'
import { RiskLevel } from '@/@types/openapi-public/RiskLevel'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'
import { neverThrow } from '@/utils/lang'
import { cursorPaginate } from '@/utils/pagination'
import { COUNT_QUERY_LIMIT } from '@/constants/pagination'
import {
  OptionalPagination,
  OptionalPaginationParams,
  PaginationParams,
} from '@/@types/pagination'
import { Tag } from '@/@types/openapi-public/Tag'
import { ExecutedRulesResult } from '@/@types/openapi-internal/ExecutedRulesResult'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { BusinessWithRulesResult } from '@/@types/openapi-public/BusinessWithRulesResult'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { SortOrder } from '@/@types/openapi-internal/SortOrder'
import { UserRiskScoreDetails } from '@/@types/openapi-public/UserRiskScoreDetails'
import { traceable } from '@/core/xray'
import { isBusinessUser } from '@/services/rules-engine/utils/user-rule-utils'
import {
  DefaultApiGetAllUsersListRequest,
  DefaultApiGetBusinessUsersListRequest,
  DefaultApiGetConsumerUsersListRequest,
  DefaultApiGetRuleInstancesTransactionUsersHitRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { Case } from '@/@types/openapi-internal/Case'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { DefaultApiGetUsersSearchRequest } from '@/@types/openapi-public-management/RequestParameters'
import { UserRulesResult } from '@/@types/openapi-public/UserRulesResult'
import { AverageArsScore } from '@/@types/openapi-internal/AverageArsScore'
import { PersonAttachment } from '@/@types/openapi-internal/PersonAttachment'
import { filterOutInternalRules } from '@/services/rules-engine/pnb-custom-logic'
import { batchGet, upsertSaveDynamo } from '@/utils/dynamodb'
import { AllUsersTableItem } from '@/@types/openapi-internal/AllUsersTableItem'
import { LinkerService } from '@/services/linker'
import { AllUsersOffsetPaginateListResponse } from '@/@types/openapi-internal/AllUsersOffsetPaginateListResponse'
import { UserApproval } from '@/@types/openapi-internal/UserApproval'
import { runLocalChangeHandler } from '@/utils/local-change-handler'

type Params = OptionalPaginationParams &
  DefaultApiGetAllUsersListRequest &
  DefaultApiGetConsumerUsersListRequest &
  DefaultApiGetBusinessUsersListRequest & {
    filterEmail?: string
    filterUserId?: string
    filterUserIds?: string[]
  }

@traceable
export class UserRepository {
  dynamoDb: DynamoDBDocumentClient
  mongoDb: MongoClient
  tenantId: string

  constructor(
    tenantId: string,
    connections: { dynamoDb?: DynamoDBDocumentClient; mongoDb?: MongoClient }
  ) {
    this.dynamoDb = connections.dynamoDb as DynamoDBDocumentClient
    this.mongoDb = connections.mongoDb as MongoClient
    this.tenantId = tenantId
  }

  public async updateAISummary(
    userId: string,
    commentId: string,
    fileS3Key: string,
    summary: string
  ) {
    await internalMongoUpdateOne(
      this.mongoDb,
      USERS_COLLECTION(this.tenantId),
      { userId },
      {
        $set: {
          'comments.$[comment].files.$[file].aiSummary': summary,
          updatedAt: Date.now(),
        },
      },
      {
        arrayFilters: [
          { 'comment.id': commentId },
          { 'file.s3Key': fileS3Key },
        ],
      }
    )
  }

  private isPulseEnabled() {
    return hasFeature('RISK_LEVELS') || hasFeature('RISK_SCORING')
  }

  private async getRiskClassificationValues(): Promise<
    RiskClassificationScore[]
  > {
    const riskRepository = new RiskRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: this.mongoDb,
    })
    return this.isPulseEnabled()
      ? await riskRepository.getRiskClassificationValues()
      : []
  }

  public async getMongoUsersPaginate(
    params: OptionalPagination<Params>,
    mapper: (user: InternalUser) => AllUsersTableItem,
    userType?: UserType,
    options?: { projection?: Document }
  ): Promise<AllUsersTableItem[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )
    const isPulseEnabled = this.isPulseEnabled()
    const riskClassificationValues = await this.getRiskClassificationValues()
    if (params.filterParentId) {
      const linker = new LinkerService(this.tenantId)
      const userIds = await linker.getLinkedChildUsers(params.filterParentId)
      params.filterIds = userIds
    }
    const query = await this.getMongoUsersQuery(
      params,
      isPulseEnabled,
      riskClassificationValues,
      userType
    )

    const users = await collection
      .find(
        { $and: query as Filter<InternalUser>[] },
        {
          projection: options?.projection,
          ...paginateFindOptions(params),
        }
      )
      .toArray()

    const userIds = users.map((user) => user.userId)
    const casesCountPipeline = [
      {
        $match: {
          caseStatus: {
            $nin: ['CLOSED'],
          },
        },
      },
      {
        $limit: COUNT_QUERY_LIMIT,
      },
      {
        $group: {
          _id: {
            $ifNull: [
              '$caseUsers.origin.userId',
              '$caseUsers.destination.userId',
            ],
          },
          count: {
            $sum: 1,
          },
        },
      },
      {
        $match: {
          _id: {
            $in: userIds,
          },
        },
      },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          casesCount: '$count',
        },
      },
    ]
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const casesCount = await casesCollection
      .aggregate(casesCountPipeline)
      .toArray()

    const updatedItems = params.includeCasesCount
      ? users.map((user) => {
          const casesCountItem = casesCount.find(
            (item) => item.userId === user.userId
          )
          return {
            ...user,
            casesCount: casesCountItem?.casesCount || 0,
          }
        })
      : users

    return updatedItems.map(mapper)
  }

  public async getMongoUsersCount(
    params: OptionalPagination<Params>,
    userType?: UserType
  ): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )
    const isPulseEnabled = this.isPulseEnabled()
    const riskClassificationValues = await this.getRiskClassificationValues()
    if (params.filterParentId) {
      const linker = new LinkerService(this.tenantId)
      const userIds = await linker.getLinkedChildUsers(params.filterParentId)
      params.filterIds = userIds
    }
    const query = await this.getMongoUsersQuery(
      params,
      isPulseEnabled,
      riskClassificationValues,
      userType
    )

    const count = await collection.countDocuments({ $and: query })

    return count
  }

  public async getMongoAllUsers(
    params: PaginationParams & {
      afterTimestamp?: number
      beforeTimestamp?: number
      filterId?: string
      filterName?: string
      filterOperator?: FilterOperator
      filterTagKey?: string
      filterTagValue?: string
      filterRiskLevel?: RiskLevel[]
      includeCasesCount?: boolean
      sortField?: string
      sortOrder?: SortOrder
      filterRiskLevelLocked?: string
      filterShadowRuleHit?: boolean
    }
  ): Promise<{
    total: number
    data: Array<InternalBusinessUser | InternalConsumerUser>
  }> {
    return (await this.getMongoUsers(params)) as {
      total: number
      data: Array<InternalBusinessUser | InternalConsumerUser>
    }
  }

  private async getMongoUsersQuery(
    params: OptionalPagination<Params>,
    isPulseEnabled: boolean,
    riskClassificationValues?: RiskClassificationScore[],
    userType?: UserType | undefined
  ) {
    const useQuickSearch = (await this.getEstimatedUsersCount()) > 1000000
    const filterConditions: Filter<
      InternalBusinessUser | InternalConsumerUser
    >[] = []

    if (params.filterId || params.filterIds) {
      const allIds: string[] = []
      if (params.filterId != null) {
        allIds.push(params.filterId)
      }
      if (params.filterIds && params.filterIds.length > 0) {
        allIds.push(...params.filterIds)
      }

      const db = this.mongoDb.db()
      const collection = db.collection<
        InternalConsumerUser | InternalBusinessUser
      >(USERS_COLLECTION(this.tenantId))
      const count = await collection.countDocuments({
        userId: { $in: allIds },
      })
      if (count > 0) {
        // If we can find users by exact ID match, we don't need to filter by name
        delete params.filterName
      }

      filterConditions.push({
        userId: { $in: allIds },
      })
    }
    if (params.filterName != null) {
      const filterNameConditions: Filter<
        InternalBusinessUser | InternalConsumerUser
      >[] = []

      // First, try exact prefix match for the full search term
      const fullSearchFilter = useQuickSearch
        ? prefixRegexMatchFilter(params.filterName)
        : regexMatchFilter(params.filterName, true)

      filterNameConditions.push({
        $or: [
          {
            'userDetails.name.firstName': fullSearchFilter,
          },
          {
            'userDetails.name.middleName': fullSearchFilter,
          },
          {
            'userDetails.name.lastName': fullSearchFilter,
          },
          {
            'legalEntity.companyGeneralDetails.legalName': fullSearchFilter,
          },
          {
            userId: fullSearchFilter,
          },
        ],
      })

      // Then, check if each word in the query has a match in the user's name
      // This handles cases like searching "LANZ EMPAT" where we want to find users
      // where any name field contains "LANZ" AND any name field contains "EMPAT"
      const searchWords = params.filterName.split(/\s+/)
      if (searchWords.length > 1) {
        const wordMatchConditions: Filter<
          InternalBusinessUser | InternalConsumerUser
        >[] = []

        for (const part of searchWords) {
          const regexFilter = useQuickSearch
            ? prefixRegexMatchFilter(part)
            : regexMatchFilter(part, true)

          wordMatchConditions.push({
            $or: [
              {
                'userDetails.name.firstName': regexFilter,
              },
              {
                'userDetails.name.middleName': regexFilter,
              },
              {
                'userDetails.name.lastName': regexFilter,
              },
              {
                'legalEntity.companyGeneralDetails.legalName': regexFilter,
              },
              {
                userId: regexFilter,
              },
            ],
          })
        }

        // Add the word-by-word matching as an alternative to the full search
        filterNameConditions.push({ $and: wordMatchConditions })
      }

      filterConditions.push({ $or: filterNameConditions })
    }

    if (params.filterUserId != null || params.filterUserIds != null) {
      const userIds: string[] = []

      if (params.filterUserId != null) {
        userIds.push(params.filterUserId)
      }

      if (params.filterUserIds != null) {
        userIds.push(...params.filterUserIds)
      }

      filterConditions.push({
        userId: {
          $in: userIds,
        },
      })
    }

    if (params.filterCountryOfNationality != null) {
      filterConditions.push({
        'userDetails.countryOfNationality': {
          $in: params.filterCountryOfNationality,
        },
      })
    }

    if (params.filterCountryOfResidence != null) {
      filterConditions.push({
        'userDetails.countryOfResidence': {
          $in: params.filterCountryOfResidence,
        },
      })
    }

    if (params.filterBusinessIndustries != null) {
      filterConditions.push({
        'legalEntity.companyGeneralDetails.businessIndustry': {
          $in: params.filterBusinessIndustries,
        },
      })
    }

    if (params.filterUserRegistrationStatus != null) {
      filterConditions.push({
        'legalEntity.companyGeneralDetails.userRegistrationStatus': {
          $in: params.filterUserRegistrationStatus,
        },
      })
    }

    if (
      params.filterIsPepHit != null ||
      params.filterPepCountry?.length ||
      params.filterPepRank != null
    ) {
      if (params.filterIsPepHit === 'false') {
        filterConditions.push({
          $or: [
            {
              'pepStatus.0': { $exists: false },
            },
            {
              pepStatus: {
                $not: { $elemMatch: { isPepHit: true } },
              },
            },
          ],
        })
      }

      if (params.filterIsPepHit === 'true') {
        filterConditions.push({
          pepStatus: {
            $elemMatch: {
              ...(params.filterIsPepHit != null && {
                isPepHit: params.filterIsPepHit === 'true' ? true : false,
              }),
              ...(params.filterPepCountry?.length && {
                pepCountry: { $in: params.filterPepCountry },
              }),
              ...(params.filterPepRank != null && {
                pepRank: params.filterPepRank,
              }),
            },
          },
        })
      }
    }

    if (params.filterRiskLevelLocked != null) {
      const isUpdatable = params.filterRiskLevelLocked === 'true' ? false : true
      filterConditions.push({
        'drsScore.isUpdatable': isUpdatable,
      })
    }

    if (params.filterRuleInstancesHit != null) {
      const eleMatchCondition = {
        ruleInstanceId: { $in: params.filterRuleInstancesHit },
      }
      if (params.filterShadowHit) {
        eleMatchCondition['isShadow'] = true
      } else {
        eleMatchCondition['isShadow'] = { $ne: true }
      }

      filterConditions.push({
        hitRules: { $elemMatch: eleMatchCondition },
      })
    }

    if (params.filterEmail) {
      filterConditions.push({
        $or: [
          {
            'contactDetails.emailIds': regexMatchFilter(
              params.filterEmail,
              true
            ),
          },
          {
            'legalEntity.contactDetails.emailIds': regexMatchFilter(
              params.filterEmail,
              true
            ),
          },
        ],
      })
    }

    if (params.filterUserState) {
      filterConditions.push({
        'userStateDetails.state': { $in: params.filterUserState },
      })
    }

    if (params.filterKycStatus) {
      filterConditions.push({
        'kycStatusDetails.status': { $in: params.filterKycStatus },
      })
    }

    const queryConditions: Filter<
      InternalBusinessUser | InternalConsumerUser
    >[] = [
      {
        createdTimestamp: {
          $gte: params.afterTimestamp || 0,
          $lte: params.beforeTimestamp || Number.MAX_SAFE_INTEGER,
        },
        ...(userType ? { type: userType } : {}),
        ...(params.filterRiskLevel?.length &&
          isPulseEnabled &&
          riskClassificationValues &&
          getUsersFilterByRiskLevel(
            params.filterRiskLevel,
            riskClassificationValues
          )),
      },
    ]

    if (params.filterTagKey || params.filterTagValue) {
      const elemCondition: { [attr: string]: Filter<Tag> } = {}
      if (params.filterTagKey) {
        elemCondition['key'] = { $in: [params.filterTagKey] }
      }
      if (params.filterTagValue) {
        elemCondition['value'] = prefixRegexMatchFilter(params.filterTagValue)
      }
      queryConditions.push({
        tags: {
          $elemMatch: elemCondition,
        },
      })
    }

    if (filterConditions.length > 0) {
      queryConditions.push(
        params.filterOperator === 'OR'
          ? {
              $or: filterConditions,
            }
          : {
              $and: filterConditions,
            }
      )
    }
    return queryConditions
  }

  public async usersSearchExternal(params: DefaultApiGetUsersSearchRequest) {
    const db = this.mongoDb.db()
    const collection = db.collection<
      InternalConsumerUser | InternalBusinessUser
    >(USERS_COLLECTION(this.tenantId))
    const query = await this.getMongoUsersQuery(
      {
        filterName: params.name,
        filterEmail: params.email,
      },
      false
    )
    const result = await cursorPaginate<
      InternalConsumerUser | InternalBusinessUser
    >(
      collection,
      { $and: query },
      {
        pageSize: params.pageSize ? (params.pageSize as number) : 20,
        sortField: params.sortBy || 'createdTimestamp',
        fromCursorKey: params.start,
        sortOrder:
          params.sortOrder === 'asc'
            ? 'ascend'
            : params.sortOrder === 'desc'
            ? 'descend'
            : undefined,
      }
    )
    return result
  }

  private async getMongoUsers(
    params: Params,
    userType?: UserType
  ): Promise<{
    total: number
    data: Array<InternalBusinessUser | InternalConsumerUser | InternalUser>
  }> {
    const db = this.mongoDb.db()

    const collectionName = USERS_COLLECTION(this.tenantId)
    const collection = db.collection<
      InternalBusinessUser | InternalConsumerUser
    >(collectionName)

    const isPulseEnabled = this.isPulseEnabled()
    const riskClassificationValues = await this.getRiskClassificationValues()
    const queryConditions = await this.getMongoUsersQuery(
      params,
      isPulseEnabled,
      riskClassificationValues,
      userType
    )

    const query = {
      $and: queryConditions,
    }

    const casesCountPipeline = [
      {
        $lookup: {
          from: CASES_COLLECTION(this.tenantId),
          let: {
            userId: '$userId',
          },
          pipeline: [
            {
              $match: {
                caseStatus: {
                  $nin: ['CLOSED'],
                },
              },
            },
            {
              $limit: COUNT_QUERY_LIMIT,
            },
            {
              $group: {
                _id: {
                  $ifNull: [
                    '$caseUsers.origin.userId',
                    '$caseUsers.destination.userId',
                  ],
                },
                count: {
                  $count: {},
                },
              },
            },
            {
              $match: {
                $expr: {
                  $eq: ['$_id', '$$userId'],
                },
              },
            },
          ],
          as: 'casesCount',
        },
      },
      {
        $set: {
          casesCount: {
            $ifNull: [
              {
                $getField: {
                  field: 'count',
                  input: {
                    $first: '$casesCount',
                  },
                },
              },
              0,
            ],
          },
        },
      },
    ]

    const sortOrder = params.sortOrder === 'ascend' ? 1 : -1

    let users = await collection
      .aggregate<InternalBusinessUser | InternalConsumerUser>([
        {
          $match: query,
        },
        {
          $sort: {
            [params.sortField ?? 'createdTimestamp']: sortOrder,
          },
        },
        ...paginatePipeline(params),
        ...(params.includeCasesCount ? casesCountPipeline : []),
      ])
      .toArray()
    if (isPulseEnabled) {
      users = insertRiskScores(users, riskClassificationValues)
    }

    const total = await collection.countDocuments(query, {
      limit: COUNT_QUERY_LIMIT,
    })
    return { total, data: users }
  }

  public async getBusinessUser(
    userId: string
  ): Promise<(BusinessWithRulesResult & { type: UserType }) | undefined> {
    return await this.getUser<BusinessWithRulesResult & { type: UserType }>(
      userId
    )
  }

  public async getConsumerUser(
    userId: string
  ): Promise<(UserWithRulesResult & { type: UserType }) | undefined> {
    return await this.getUser<UserWithRulesResult & { type: UserType }>(userId)
  }

  private async getRiskScoringResult(
    userId: string
  ): Promise<UserRiskScoreDetails> {
    const riskRepository = new RiskRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })
    const [kycRiskScore, craRiskScore, riskClassificationValues] =
      await Promise.all([
        riskRepository.getKrsScore(userId),
        riskRepository.getDrsScore(userId),
        riskRepository.getRiskClassificationValues(),
      ])

    const kycRiskLevel = getRiskLevelFromScore(
      riskClassificationValues,
      kycRiskScore?.krsScore ?? null
    )

    const craRiskLevel = getRiskLevelFromScore(
      riskClassificationValues,
      craRiskScore?.drsScore ?? null
    )

    if (hasFeature('RISK_LEVELS') && !hasFeature('RISK_SCORING')) {
      return { craRiskLevel, craRiskScore: craRiskScore?.drsScore }
    }

    return {
      kycRiskScore: kycRiskScore?.krsScore,
      craRiskScore: craRiskScore?.drsScore,
      kycRiskLevel,
      craRiskLevel,
    }
  }

  public async getConsumerUserWithRiskScores(
    userId: string
  ): Promise<UserWithRulesResult | undefined> {
    const user = await this.getConsumerUser(userId)

    if (user == null) {
      return
    }

    if (!hasFeature('RISK_SCORING') || !hasFeature('RISK_LEVELS')) {
      return user
    }

    const riskScoreDetails = await this.getRiskScoringResult(userId)

    return {
      ...user,
      riskScoreDetails,
      executedRules: user.executedRules ?? [],
      hitRules: user.hitRules ?? [],
    }
  }

  public async getBusinessUserWithRiskScores(
    userId: string
  ): Promise<BusinessWithRulesResult | undefined> {
    const user = await this.getBusinessUser(userId)

    if (user == null) {
      return
    }

    if (!hasFeature('RISK_SCORING') || !hasFeature('RISK_LEVELS')) {
      return user
    }

    const riskScoreDetails = await this.getRiskScoringResult(userId)

    return {
      ...user,
      riskScoreDetails,
      hitRules: user.hitRules ?? [],
      executedRules: user.executedRules ?? [],
    }
  }

  public getAllUsersCursor(
    from?: string,
    to?: string
  ): FindCursor<WithId<InternalUser>> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )

    let match: any = {}
    if (from) {
      match = { userId: { $gte: from } }
    }
    if (to) {
      match = { userId: { ...match.userId, $lte: to } }
    }
    return collection.find(match, { sort: { userId: 1 } })
  }

  public async getMongoUser(
    userId: string,
    userType?: 'BUSINESS' | 'CONSUMER',
    options?: { projection?: Document }
  ): Promise<InternalUser | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )

    const matchCondition: Filter<InternalBusinessUser | InternalConsumerUser> =
      { userId }

    if (userType) {
      matchCondition.type = userType
    }

    return await collection.findOne(
      matchCondition as Filter<InternalUser>,
      options
    )
  }

  public async getMongoUsersByIds(
    userIds: string[],
    options?: { projection?: Document }
  ): Promise<InternalUser[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )
    const cursor = collection.find({ userId: { $in: userIds } })

    if (options?.projection) {
      cursor.project(options.projection)
    }

    return cursor.toArray()
  }

  public async getUser<T>(userId: string): Promise<T | undefined> {
    const getItemInput: GetCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.USER(this.tenantId, userId),
      ConsistentRead: true,
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))
    if (!result.Item) {
      return undefined
    }

    const user = {
      ...result.Item,
    }

    delete user.PartitionKeyID
    delete user.SortKeyID
    delete user.createdAt
    // delete sanctionsDetails from each executedRule in user
    ;(
      user as UserWithRulesResult | BusinessWithRulesResult
    ).executedRules?.forEach((rule) => {
      delete rule.sanctionsDetails
    })
    if (this.tenantId.toLowerCase() === '0789ad73b8') {
      if (user.linkedEntities) {
        ;(user.linkedEntities as any).childUserIds = undefined
      }
    }

    return {
      ...user,
      executedRules: user.executedRules?.map((rule) => ({
        ...rule,
        sanctionsDetails: undefined,
      })),
    } as T
  }

  public async getUsersByIds<
    T extends UserWithRulesResult | BusinessWithRulesResult
  >(userIds: string[]): Promise<T[]> {
    const users = await batchGet<T>(
      this.dynamoDb,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      userIds.map((userId) => DynamoDbKeys.USER(this.tenantId, userId)),
      { ConsistentRead: true }
    )
    return users.map((user) => ({
      ...user,
      executedRules: user.executedRules?.map((rule) => ({
        ...rule,
        sanctionsDetails: undefined,
      })),
    }))
  }

  public async getChildUsers(userId: string): Promise<InternalUser[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )
    const cursor = collection.find({ linkedEntities: { parentUserId: userId } })
    return cursor.toArray()
  }

  public async getParentUser(userId: string): Promise<InternalUser | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )

    const [result] = await collection
      .aggregate([
        { $match: { userId } },
        {
          $lookup: {
            from: USERS_COLLECTION(this.tenantId),
            localField: 'linkedEntities.parentUserId',
            foreignField: 'userId',
            as: 'parentUser',
          },
        },
        {
          $project: {
            _id: 0,
            parentUser: { $arrayElemAt: ['$parentUser', 0] },
          },
        },
      ])
      .toArray()

    return result?.parentUser || null
  }

  public async updateUserWithExecutedRules(
    userId: string,
    executedRules: ExecutedRulesResult[],
    hitRulesResults: HitRulesDetails[]
  ): Promise<UserWithRulesResult | BusinessWithRulesResult> {
    const primaryKey = DynamoDbKeys.USER(this.tenantId, userId)
    const updateItemInput: UpdateCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: primaryKey,
      UpdateExpression: `set #executedRules = :executedRules, #hitRules = :hitRules, #updateCount = if_not_exists(#updateCount, :zero) + :one`,
      ExpressionAttributeNames: {
        '#executedRules': 'executedRules',
        '#hitRules': 'hitRules',
        '#updateCount': 'updateCount',
      },
      ExpressionAttributeValues: {
        ':executedRules': executedRules,
        ':hitRules': hitRulesResults,
        ':zero': 0,
        ':one': 1,
      },
      ReturnValues: 'ALL_NEW',
    }

    const result = await this.dynamoDb.send(new UpdateCommand(updateItemInput))

    const user = {
      ...result.Attributes,
    } as (UserWithRulesResult | BusinessWithRulesResult) & {
      PartitionKeyID?: string
      SortKeyID?: string
      createdAt?: number
    }

    delete user.PartitionKeyID
    delete user.SortKeyID
    delete user.createdAt

    if (runLocalChangeHandler()) {
      const { handleLocalTarponChangeCapture } = await import(
        '@/core/local-handlers/tarpon'
      )
      await handleLocalTarponChangeCapture(this.tenantId, [primaryKey])
    }

    return user as UserWithRulesResult | BusinessWithRulesResult
  }

  public async saveBusinessUser(
    user: BusinessWithRulesResult
  ): Promise<BusinessWithRulesResult> {
    return (await this.saveUser(user, 'BUSINESS')) as BusinessWithRulesResult
  }

  public async saveConsumerUser(
    user: UserWithRulesResult
  ): Promise<UserWithRulesResult> {
    return (await this.saveUser(user, 'CONSUMER')) as UserWithRulesResult
  }

  public async updateRulesResultsUser(
    userId: string,
    rulesResults: UserRulesResult
  ): Promise<void> {
    const primaryKey = DynamoDbKeys.USER(this.tenantId, userId)
    const updateItemInput: UpdateCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: primaryKey,
      UpdateExpression: `set #executedRules = :executedRules, #hitRules = :hitRules, #updateCount = if_not_exists(#updateCount, :zero) + :one`,
      ExpressionAttributeNames: {
        '#executedRules': 'executedRules',
        '#hitRules': 'hitRules',
      },
      ExpressionAttributeValues: {
        ':executedRules': rulesResults.executedRules,
        ':hitRules': rulesResults.hitRules,
      },
    }

    await this.dynamoDb.send(new UpdateCommand(updateItemInput))

    if (runLocalChangeHandler()) {
      const { handleLocalTarponChangeCapture } = await import(
        '@/core/local-handlers/tarpon'
      )
      await handleLocalTarponChangeCapture(this.tenantId, [primaryKey])
    }
  }

  private sanitizeUserInPlace(user: User | Business) {
    const COUNTRY_FIELD_PATHS = [
      'userDetails.countryOfResidence',
      'userDetails.countryOfNationality',
      'legalEntity.companyRegistrationDetails.registrationCountry',
    ]
    COUNTRY_FIELD_PATHS.forEach((path) => {
      if (get(user, path) === 'N/A') {
        set(user, path, undefined)
      }
    })
    if ((user as User).legalDocuments) {
      ;(user as User).legalDocuments?.forEach((doc) => {
        if (doc.documentIssuedCountry === 'N/A') {
          doc.documentIssuedCountry = undefined as any
        }
      })
    }
  }

  private preProcessSavingUser(
    user: UserWithRulesResult | BusinessWithRulesResult,
    type: UserType
  ) {
    this.sanitizeUserInPlace(user)
    const userId = user.userId
    const newUser = {
      ...user,
      userId,
      type,
    }
    if (this.tenantId.toLowerCase() === '0789ad73b8') {
      if (newUser.linkedEntities) {
        ;(newUser.linkedEntities as any).childUserIds = undefined
      }
    }
    return newUser
  }

  private userKeys(userId: string) {
    return DynamoDbKeys.USER(this.tenantId, userId)
  }

  public async saveDemoUser(
    user: UserWithRulesResult | BusinessWithRulesResult,
    type: UserType
  ) {
    const newUser = this.preProcessSavingUser(user, type)
    const primaryKey = this.userKeys(user.userId)
    return {
      putItemInput: {
        PutRequest: { Item: { ...primaryKey, ...newUser } },
      },
      tableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
    }
  }

  public async saveUser(
    user: UserWithRulesResult | BusinessWithRulesResult,
    type: UserType
  ): Promise<UserWithRulesResult | BusinessWithRulesResult> {
    const newUser = this.preProcessSavingUser(user, type)
    const userId = user.userId
    const primaryKey = this.userKeys(userId)
    await upsertSaveDynamo(
      this.dynamoDb,
      {
        entity: { ...newUser },
        tableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        key: primaryKey,
      },
      { versioned: true }
    )

    if (runLocalChangeHandler()) {
      const { handleLocalTarponChangeCapture } = await import(
        '@/core/local-handlers/tarpon'
      )
      await handleLocalTarponChangeCapture(this.tenantId, [primaryKey])
    }

    return newUser
  }

  public async saveUserMongo(
    user: InternalBusinessUser | InternalConsumerUser,
    options?: { session?: ClientSession }
  ): Promise<InternalUser> {
    const userToSave: InternalBusinessUser | InternalConsumerUser = {
      ...user,
      createdAt: user.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      hitRules: filterOutInternalRules(user.hitRules ?? []),
      executedRules: filterOutInternalRules(user.executedRules ?? []),
    }

    const updateWithoutId = omit(userToSave, ['_id'])

    const promises: Promise<any>[] = [
      internalMongoUpdateOne(
        this.mongoDb,
        USERS_COLLECTION(this.tenantId),
        { userId: user.userId },
        { $set: updateWithoutId },
        { session: options?.session }
      ),
      this.updateUniqueTags(userToSave?.tags),
    ]

    await Promise.all(promises)

    return user as InternalUser
  }

  public async updateUniqueTags(tags: InternalUser['tags']): Promise<void> {
    const db = this.mongoDb.db()
    const uniqueTagsCollection = db.collection(
      UNIQUE_TAGS_COLLECTION(this.tenantId)
    )

    const uniqueTags = uniq(
      tags?.map((tag) => JSON.stringify({ key: tag.key, value: tag.value }))
    ).map((uniqueStr) => JSON.parse(uniqueStr))

    await Promise.all(
      uniqueTags.map((tag) =>
        uniqueTagsCollection.updateOne(
          { tag: tag.key, value: tag.value, type: 'USER' },
          { $set: { tag: tag.key, value: tag.value, type: 'USER' } },
          { upsert: true }
        )
      )
    )
  }

  public async deleteUser(userId: string): Promise<void> {
    const deleteItemInput: DeleteCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.USER(this.tenantId, userId),
    }
    await this.dynamoDb.send(new DeleteCommand(deleteItemInput))
  }

  public async deleteUserMongo(userId: string): Promise<void> {
    const db = this.mongoDb.db()
    const userCollection = db.collection<Business | User>(
      USERS_COLLECTION(this.tenantId)
    )
    await userCollection.deleteOne({ userId })
  }

  public async getUniques(params: {
    field: UsersUniquesField
    filter?: string
  }): Promise<string[]> {
    const db = this.mongoDb.db()
    const name = USERS_COLLECTION(this.tenantId)
    const collection = db.collection<Business>(name)
    let fieldPath: string
    let unwindPath: string
    const filterConditions: any[] = []

    if (params.field === 'TAGS_KEY') {
      const uniqueTagsCollection = db.collection(
        UNIQUE_TAGS_COLLECTION(this.tenantId)
      )
      const pipeline: Document[] = [
        {
          $match: {
            type: 'USER',
            tag: { $ne: null },
          },
        },
        { $group: { _id: '$tag' } },
      ]

      const uniqueTags = await uniqueTagsCollection
        .aggregate<{ _id: string }>(pipeline)
        .toArray()

      return uniqueTags.map((doc) => doc._id)
    }
    if (params.field === 'TAGS_VALUE') {
      const uniqueTagsCollection = db.collection(
        UNIQUE_TAGS_COLLECTION(this.tenantId)
      )
      const pipeline: Document[] = [
        {
          $match: {
            type: 'USER',
            ...(params.filter ? { tag: params.filter } : {}),
            value: { $ne: null },
          },
        },
        { $group: { _id: '$value' } },
        { $limit: 100 },
      ]

      const uniqueTags = await uniqueTagsCollection
        .aggregate<{ _id: string }>(pipeline)
        .toArray()

      return uniqueTags.map((doc) => doc._id)
    }
    switch (params.field) {
      case 'BUSINESS_INDUSTRY':
        filterConditions.push({
          'legalEntity.companyGeneralDetails.businessIndustry': { $ne: null },
        })
        fieldPath = 'legalEntity.companyGeneralDetails.businessIndustry'
        unwindPath = 'legalEntity.companyGeneralDetails.businessIndustry'
        break
      default:
        throw neverThrow(params.field, `Unknown field: ${params.field}`)
    }

    if (params.filter) {
      filterConditions.push({
        [fieldPath]: prefixRegexMatchFilter(params.filter),
      })
    }

    const pipeline: Document[] = [
      filterConditions.length > 0
        ? {
            $match: {
              $and: filterConditions,
            },
          }
        : {},
      // If we have filter conditions, it's for auto-complete. It's acceptable that
      // we don't filter all the documents for performance concerns.
      filterConditions.length > 0 ? { $limit: 10000 } : {},
      {
        $unwind: {
          path: `$${unwindPath}`,
          includeArrayIndex: 'string',
        },
      },
      {
        $group: {
          _id: `$${fieldPath}`,
        },
      },
      {
        $limit: 100,
      },
    ].filter((stage) => !isEmpty(stage))

    const result: string[] = await collection
      .aggregate<any>(pipeline)
      .map(({ _id }) => _id)
      .toArray()
    return result
  }

  public async saveUserComment(
    userId: string,
    comment: Comment
  ): Promise<Comment> {
    const commentToSave: Comment = {
      ...comment,
      id: uuidv4(),
      createdAt: comment.createdAt ?? Date.now(),
      updatedAt: comment.updatedAt ?? Date.now(),
    }

    await this.updateComments(userId, [
      {
        $set: {
          comments: {
            $ifNull: [
              { $concatArrays: ['$comments', [commentToSave]] },
              [commentToSave],
            ],
          },
        },
      },
    ])

    return commentToSave
  }

  public async saveUserAttachment(
    consumerId: string,
    attachment: PersonAttachment
  ) {
    const attachmentToSave: PersonAttachment = {
      ...attachment,
      id: uuidv4(),
      createdAt: attachment.createdAt ?? Date.now(),
    }
    await this.updateUserAttachment(
      { userId: consumerId },
      {
        $push: {
          attachments: attachmentToSave,
        },
      }
    )
    return attachmentToSave
  }

  public async saveShareHolderAttachment(
    userId: string,
    shareHolderId: string,
    attachment: PersonAttachment
  ) {
    const attachmentToSave: PersonAttachment = {
      ...attachment,
      id: uuidv4(),
      createdAt: attachment.createdAt ?? Date.now(),
    }
    await this.updateUserAttachment(
      { userId, 'shareHolders.userId': shareHolderId },
      {
        $push: {
          'shareHolders.$[shareHolder].attachments': attachmentToSave,
        },
      },
      [{ 'shareHolder.userId': shareHolderId }]
    )
    return attachmentToSave
  }

  public async saveDirectorAttachment(
    userId: string,
    directorId: string,
    attachment: PersonAttachment
  ) {
    const attachmentToSave: PersonAttachment = {
      ...attachment,
      id: uuidv4(),
      createdAt: attachment.createdAt ?? Date.now(),
    }
    await this.updateUserAttachment(
      { userId, 'directors.userId': directorId },
      {
        $push: {
          'directors.$[director].attachments': attachmentToSave,
        },
      },
      [{ 'director.userId': directorId }]
    )
    return attachmentToSave
  }

  public async getUserById(userId: string): Promise<InternalUser | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )

    return collection.findOne<InternalUser>({
      userId,
    })
  }

  private async updateComments(
    userId: string,
    updatePipeline: UpdateFilter<InternalUser>,
    arrayFilters?: Document[]
  ) {
    await internalMongoUpdateOne(
      this.mongoDb,
      USERS_COLLECTION(this.tenantId),
      { userId },
      updatePipeline,
      { arrayFilters }
    )
  }

  public async deleteUserComment(userId: string, commentId: string) {
    await this.updateComments(
      userId,
      { $set: { 'comments.$[comment].deletedAt': Date.now() } },
      [
        {
          $or: [{ 'comment.id': commentId }, { 'comment.parentId': commentId }],
        },
      ]
    )
  }

  public async deleteUserAttachment(userId: string, attachmentId: string) {
    await this.updateUserAttachment(
      { userId, 'attachments.id': attachmentId },
      {
        $set: {
          'attachments.$[attachment].deletedAt': Date.now(),
        },
      },
      [{ 'attachment.id': attachmentId }]
    )
  }

  public async deleteShareHolderAttachment(
    userId: string,
    shareHolderId: string,
    attachmentId: string
  ) {
    console.info(userId, attachmentId, shareHolderId)
    await this.updateUserAttachment(
      {
        userId,
        'shareHolders.userId': shareHolderId,
        'shareHolders.attachments.id': attachmentId,
      },
      {
        $set: {
          'shareHolders.$[shareHolder].attachments.$[attachment].deletedAt':
            Date.now(),
        },
      },
      [
        { 'shareHolder.userId': shareHolderId },
        { 'attachment.id': attachmentId },
      ]
    )
  }

  public async deleteDirectorAttachment(
    userId: string,
    directorId: string,
    attachmentId: string
  ) {
    console.info(userId, attachmentId)
    await this.updateUserAttachment(
      {
        userId,
        'directors.userId': directorId,
        'directors.attachments.id': attachmentId,
      },
      {
        $set: {
          'directors.$[director].attachments.$[attachment].deletedAt':
            Date.now(),
        },
      },
      [{ 'director.userId': directorId }, { 'attachment.id': attachmentId }]
    )
  }

  public async updateUserAttachment(
    filter: Filter<InternalUser>,
    updatePipeline: UpdateFilter<InternalUser>,
    arrayFilters?: Document[]
  ) {
    await internalMongoUpdateOne(
      this.mongoDb,
      USERS_COLLECTION(this.tenantId),
      filter,
      updatePipeline,
      { arrayFilters }
    )
  }

  public async updateAvgTrsScoreOfUser(
    userId: string,
    avgArsScore: AverageArsScore
  ): Promise<void> {
    await internalMongoUpdateOne(
      this.mongoDb,
      USERS_COLLECTION(this.tenantId),
      {
        $and: [
          { userId },
          {
            $or: [
              { avgArsScore: { $exists: false } },
              { 'avgArsScore.updateCount': { $exists: false } },
              { 'avgArsScore.updateCount': null },
              {
                'avgArsScore.updateCount': {
                  $lt: avgArsScore.updateCount ?? 1,
                },
              },
            ],
          },
        ],
      },
      { $set: { avgArsScore } },
      { upsert: false }
    )
  }

  public async updateDrsScoreOfUser(
    userId: string,
    drsScore: DrsScore
  ): Promise<void> {
    await internalMongoUpdateOne(
      this.mongoDb,
      USERS_COLLECTION(this.tenantId),
      { userId },
      { $set: { drsScore } }
    )

    const user = await this.getUser<
      UserWithRulesResult | BusinessWithRulesResult
    >(userId)

    const riskScoringResult = await this.getRiskScoringResult(userId)

    if (user && user.riskLevel !== riskScoringResult.craRiskLevel) {
      await this.saveUser(
        { ...user, riskLevel: riskScoringResult.craRiskLevel },
        isBusinessUser(user) ? 'BUSINESS' : 'CONSUMER'
      )
    }
  }

  public async updateKrsScoreOfUser(
    userId: string,
    krsScore: KrsScore
  ): Promise<void> {
    await this.updateUser(userId, { krsScore })

    const user = await this.getUser<
      UserWithRulesResult | BusinessWithRulesResult
    >(userId)

    const riskScoringResult = await this.getRiskScoringResult(userId)
    if (
      user &&
      user.kycRiskLevel &&
      user.kycRiskLevel !== riskScoringResult.kycRiskLevel
    ) {
      await this.saveUser(
        { ...user, kycRiskLevel: riskScoringResult.kycRiskLevel },
        isBusinessUser(user) ? 'BUSINESS' : 'CONSUMER'
      )
    }
  }

  public async getEstimatedUsersCount(): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )
    const count = await collection.estimatedDocumentCount()
    return count
  }

  public async getUserIdsByEmails(emails: string[]) {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )

    const userIds = await collection
      .find({
        $or: [
          { 'contactDetails.emailIds': { $in: emails } },
          { 'legalEntity.contactDetails.emailIds': { $in: emails } },
        ],
      })
      .project({ userId: 1 })
      .map((user) => user.userId)
      .toArray()

    return userIds
  }

  public async getChildUserIds(parentUserId: string) {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )
    const userIds = await collection
      .find({ 'linkedEntities.parentUserId': parentUserId })
      .project({ userId: 1 })
      .map((user) => user.userId)
      .toArray()
    return userIds
  }

  public async getRuleInstancesTransactionUsersHit(
    ruleInstanceId: string,
    params: DefaultApiGetRuleInstancesTransactionUsersHitRequest,
    mapper: (
      user: InternalUser | InternalBusinessUser | InternalConsumerUser
    ) => AllUsersTableItem
  ): Promise<AllUsersOffsetPaginateListResponse> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const ruleMatchCondition: Document = { ruleInstanceId }
    if (params.filterShadowHit != null) {
      if (params.filterShadowHit) {
        ruleMatchCondition.isShadow = true
      } else {
        ruleMatchCondition.isShadow = { $ne: true }
      }
    }

    const pipeline: Document[] = [
      {
        $match: {
          timestamp: {
            $gte: params.txAfterTimestamp ?? 0,
            $lt: params.txBeforeTimestamp ?? Number.MAX_SAFE_INTEGER,
          },
          hitRules: { $elemMatch: ruleMatchCondition },
        },
      },
      {
        $project: {
          originUserId: 1,
          destinationUserId: 1,
          ruleHitData: {
            $first: {
              $filter: {
                input: '$hitRules',
                as: 'hitRule',
                cond: { $eq: ['$$hitRule.ruleInstanceId', ruleInstanceId] },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          userIds: {
            $addToSet: {
              $switch: {
                branches: [
                  {
                    case: {
                      $and: [
                        {
                          $in: [
                            'ORIGIN',
                            '$ruleHitData.ruleHitMeta.hitDirections',
                          ],
                        },
                        {
                          $in: [
                            'DESTINATION',
                            '$ruleHitData.ruleHitMeta.hitDirections',
                          ],
                        },
                      ],
                    },
                    then: ['$originUserId', '$destinationUserId'],
                  },
                  {
                    case: {
                      $in: ['ORIGIN', '$ruleHitData.ruleHitMeta.hitDirections'],
                    },
                    then: '$originUserId',
                  },
                  {
                    case: {
                      $in: [
                        'DESTINATION',
                        '$ruleHitData.ruleHitMeta.hitDirections',
                      ],
                    },
                    then: '$destinationUserId',
                  },
                ],
              },
            },
          },
        },
      },
    ]

    const result = collection.aggregate<{ userIds: string[] }>(pipeline)

    const data = await result.next()

    const count = await this.getMongoUsersCount({
      ...params,
      filterUserIds: uniq(data?.userIds.flat()),
    })
    return {
      items: await this.getMongoUsersPaginate(
        { ...params, filterUserIds: uniq(data?.userIds.flat()) },
        mapper
      ),
      count,
    }
  }

  public async getRuleInstanceStats(
    ruleInstanceId: string,
    timeRange: { afterTimestamp: number; beforeTimestamp: number },
    isShadowRule: boolean
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )

    const ruleElementMatchCondition: {
      ruleInstanceId: string
      isShadow: boolean | { $ne: boolean }
    } = {
      ruleInstanceId,
      isShadow: isShadowRule ? true : { $ne: true },
    }
    let groupBy = {
      $dateToString: {
        format: DAY_DATE_FORMAT,
        date: { $toDate: '$executedRules.executedAt' },
      },
    }
    const runPipeline = [
      {
        $unwind: '$executedRules',
      },
      {
        $match: {
          'executedRules.executedAt': {
            $gte: timeRange.afterTimestamp,
            $lt: timeRange.beforeTimestamp,
          },
          'executedRules.ruleInstanceId': ruleInstanceId,
          'executedRules.isShadow': ruleElementMatchCondition.isShadow,
        },
      },
      {
        $group: {
          _id: groupBy,
          runCount: { $sum: 1 },
        },
      },
    ]
    groupBy = {
      $dateToString: {
        format: DAY_DATE_FORMAT,
        date: { $toDate: '$hitRules.executedAt' },
      },
    }
    const hitPipeline = [
      {
        $unwind: '$hitRules',
      },
      {
        $match: {
          'hitRules.executedAt': {
            $gte: timeRange.afterTimestamp,
            $lt: timeRange.beforeTimestamp,
          },
          'hitRules.ruleInstanceId': ruleInstanceId,
          'hitRules.isShadow': ruleElementMatchCondition.isShadow,
        },
      },
      {
        $group: {
          _id: groupBy,
          hitCount: { $sum: 1 },
        },
      },
    ]

    const [runResult, hitResult] = await Promise.all([
      collection.aggregate(runPipeline).toArray(),
      collection.aggregate(hitPipeline).toArray(),
    ])

    const result = mergeWith(
      mapValues(keyBy(runResult, '_id'), (v) => ({
        runCount: v.runCount,
        hitCount: 0,
      })),
      keyBy(hitResult, '_id'),
      (run, hit) => {
        return {
          runCount: run?.runCount ?? 0,
          hitCount: hit?.hitCount ?? 0,
        }
      }
    ) as {
      [date: string]: {
        hitCount: number
        runCount: number
      }
    }
    return result
  }

  private async updateUser(userId: string, update: Partial<InternalUser>) {
    await internalMongoUpdateOne(
      this.mongoDb,
      USERS_COLLECTION(this.tenantId),
      { userId },
      { $set: update }
    )
  }

  public getUsersCursor(
    filter: Filter<InternalUser> = {},
    projection?: Document
  ): FindCursor<WithId<InternalUser>> {
    const collection = this.mongoDb
      .db()
      .collection<InternalUser>(USERS_COLLECTION(this.tenantId))

    const cursor = collection.find(filter)

    if (projection) {
      cursor.project(projection)
    }

    return cursor
  }

  // User Approval methods

  // Fetches the UserApproval object from DynamoDB for the given user and timestamp
  async getPendingUserApproval(
    userId: string,
    id: number
  ): Promise<UserApproval | null> {
    const getItemInput: GetCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.USERS_PROPOSAL(this.tenantId, userId, id),
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))
    if (!result.Item) {
      return null
    }

    const approval = result.Item as UserApproval & {
      PartitionKeyID?: string
      SortKeyID?: string
    }
    delete approval.PartitionKeyID
    delete approval.SortKeyID

    return approval as UserApproval
  }

  // Sets (creates or updates) the UserApproval object in DynamoDB
  async setPendingUserApproval(approval: UserApproval): Promise<UserApproval> {
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Item: {
        ...DynamoDbKeys.USERS_PROPOSAL(
          this.tenantId,
          approval.userId,
          approval.createdAt
        ),
        ...approval,
      },
      ConditionExpression:
        'attribute_not_exists(PartitionKeyID) AND attribute_not_exists(SortKeyID)',
    }

    try {
      await this.dynamoDb.send(new PutCommand(putItemInput))
      return approval
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('User approval with same id already exists')
      }
      throw error
    }
  }

  async updatePendingUserApproval(
    approval: UserApproval
  ): Promise<UserApproval> {
    const updateItemInput: UpdateCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.USERS_PROPOSAL(
        this.tenantId,
        approval.userId,
        approval.createdAt
      ),
      UpdateExpression:
        'set #approvalStatus = :approvalStatus, #approvalStep = :approvalStep',
      ExpressionAttributeNames: {
        '#approvalStatus': 'approvalStatus',
        '#approvalStep': 'approvalStep',
      },
      ExpressionAttributeValues: {
        ':approvalStep': approval.approvalStep,
        ':approvalStatus': approval.approvalStatus,
      },
    }

    await this.dynamoDb.send(new UpdateCommand(updateItemInput))
    return approval
  }

  // Deletes the UserApproval object from DynamoDB
  async deletePendingUserApproval(
    userId: string,
    id: number
  ): Promise<boolean> {
    const deleteItemInput: DeleteCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.USERS_PROPOSAL(this.tenantId, userId, id),
      ReturnValues: 'ALL_OLD',
    }
    const result = await this.dynamoDb.send(new DeleteCommand(deleteItemInput))
    return !!result.Attributes
  }

  // Gets all pending user approvals for a specific user
  async getPendingUserApprovalsForUser(
    userId: string
  ): Promise<UserApproval[]> {
    const queryInput: QueryCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      KeyConditionExpression:
        'PartitionKeyID = :pk AND begins_with(SortKeyID, :userId)',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.USERS_PROPOSAL(this.tenantId, userId)
          .PartitionKeyID,
        ':userId': userId,
      },
    }

    const result = await this.dynamoDb.send(new QueryCommand(queryInput))
    if (!result.Items) {
      return []
    }

    return result.Items.map((item) => {
      const approval = item as UserApproval & {
        PartitionKeyID?: string
        SortKeyID?: string
      }
      delete approval.PartitionKeyID
      delete approval.SortKeyID

      return approval as UserApproval
    })
  }

  // Gets all pending user approvals across all users
  async getAllPendingUserApprovals(): Promise<UserApproval[]> {
    const queryInput: QueryCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.USERS_PROPOSAL(this.tenantId, '').PartitionKeyID,
      },
    }

    const result = await this.dynamoDb.send(new QueryCommand(queryInput))
    if (!result.Items) {
      return []
    }

    return result.Items.map((item) => {
      const approval = item as UserApproval & {
        PartitionKeyID?: string
        SortKeyID?: string
      }
      delete approval.PartitionKeyID
      delete approval.SortKeyID

      return approval as UserApproval
    })
  }

  /**
   * Bulk updates all pending user approvals to use a new workflow reference and reset approval step to 0
   * This is used when a workflow is updated to restart all pending approval flows
   */
  // TODO: the logic of this method needs to be updated once implementing
  //       workflow builder and workflows are referenced by their id in tenant settings
  async bulkUpdateUserApprovalsWorkflow(newWorkflowRef: {
    id: string
    version: number
  }): Promise<number> {
    console.log(`Updating user approvals workflow to:`, newWorkflowRef)

    // Use a query with a filter to find items that need updating
    const result = await this.dynamoDb.send(
      new QueryCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        KeyConditionExpression: 'PartitionKeyID = :pk',
        FilterExpression:
          'attribute_not_exists(workflowRef) OR workflowRef.id <> :newWorkflowId OR workflowRef.version <> :newWorkflowVersion',
        ExpressionAttributeValues: {
          ':pk': DynamoDbKeys.USERS_PROPOSAL(this.tenantId, '').PartitionKeyID,
          ':newWorkflowId': newWorkflowRef.id,
          ':newWorkflowVersion': newWorkflowRef.version,
        },
      })
    )

    // get the field associated to the workflowRef
    const userField = newWorkflowRef.id.split('_').pop()
    console.log(`User field:`, userField)

    // filter the result to only include items where the user field is not null
    const filteredResult = result.Items?.filter((item) => {
      const proposedChanges = item.proposedChanges
      return proposedChanges.some((change) => change.field === userField)
    })

    if (!filteredResult || !filteredResult.length) {
      return 0
    }

    console.log(`Filtered result:`, filteredResult.length)

    console.log(
      `User approvals query result:`,
      JSON.stringify(
        {
          partitionKey: DynamoDbKeys.USERS_PROPOSAL(this.tenantId, '')
            .PartitionKeyID,
          totalItems: filteredResult.length,
          items: filteredResult.map((item) => ({
            SortKeyID: item.SortKeyID,
            workflowRef: item.workflowRef,
            approvalStep: item.approvalStep,
            proposedChanges: item.proposedChanges.map((change) => change.field),
          })),
        },
        null,
        2
      )
    )

    // Batch write up to 25 items at a time (DynamoDB limit)
    const batchSize = 25
    let updatedCount = 0

    for (let i = 0; i < filteredResult.length; i += batchSize) {
      const batch = filteredResult.slice(i, i + batchSize)

      const batchWriteInput = {
        RequestItems: {
          [StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)]: batch.map(
            (item) => ({
              PutRequest: {
                Item: {
                  ...item,
                  workflowRef: newWorkflowRef,
                  approvalStep: 0,
                },
              },
            })
          ),
        },
      }

      await this.dynamoDb.send(new BatchWriteCommand(batchWriteInput))
      updatedCount += batch.length
    }

    return updatedCount
  }
}
