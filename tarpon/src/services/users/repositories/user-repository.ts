import {
  AggregationCursor,
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
  UpdateCommand,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb'
import {
  get,
  isEmpty,
  keyBy,
  mapValues,
  mergeWith,
  omit,
  set,
  uniq,
} from 'lodash'
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
  paginatePipeline,
  prefixRegexMatchFilter,
  regexMatchFilter,
} from '@/utils/mongodb-utils'
import { DAY_DATE_FORMAT } from '@/core/constants'
import {
  CASES_COLLECTION,
  TRANSACTIONS_COLLECTION,
  UNIQUE_TAGS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
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
import {
  COUNT_QUERY_LIMIT,
  cursorPaginate,
  OptionalPagination,
  OptionalPaginationParams,
  PaginationParams,
} from '@/utils/pagination'
import { Tag } from '@/@types/openapi-public/Tag'
import { ExecutedRulesResult } from '@/@types/openapi-internal/ExecutedRulesResult'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { BusinessWithRulesResult } from '@/@types/openapi-public/BusinessWithRulesResult'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { SortOrder } from '@/@types/openapi-internal/SortOrder'
import { UserRiskScoreDetails } from '@/@types/openapi-public/UserRiskScoreDetails'
import { runLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
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
import { AllUsersListResponse } from '@/@types/openapi-internal/AllUsersListResponse'
import { DefaultApiGetUsersSearchRequest } from '@/@types/openapi-public-management/RequestParameters'
import { UserRulesResult } from '@/@types/openapi-public/UserRulesResult'
import { AverageArsScore } from '@/@types/openapi-internal/AverageArsScore'
import { PersonAttachment } from '@/@types/openapi-internal/PersonAttachment'
import { filterOutInternalRules } from '@/services/rules-engine/pnb-custom-logic'
import { batchGet } from '@/utils/dynamodb'
import { AllUsersTableItem } from '@/@types/openapi-internal/AllUsersTableItem'

type Params = OptionalPaginationParams &
  DefaultApiGetAllUsersListRequest &
  DefaultApiGetConsumerUsersListRequest &
  DefaultApiGetBusinessUsersListRequest & {
    filterEmail?: string
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
  public async getMongoUsersCursorsPaginate(
    params: OptionalPagination<Params>,
    mapper: (user: InternalUser) => AllUsersTableItem,
    userType?: UserType,
    options?: { projection?: Document }
  ): Promise<AllUsersListResponse> {
    const db = this.mongoDb.db()
    const collection = db.collection<
      InternalBusinessUser | InternalConsumerUser
    >(USERS_COLLECTION(this.tenantId))
    const isPulseEnabled = this.isPulseEnabled()
    const riskClassificationValues = await this.getRiskClassificationValues()
    const query = await this.getMongoUsersQuery(
      params,
      isPulseEnabled,
      riskClassificationValues,
      userType
    )

    let result = await cursorPaginate<
      InternalBusinessUser | InternalConsumerUser
    >(
      collection,
      {
        $and: query,
      },
      {
        pageSize: params.pageSize ? (params.pageSize as number) : 20,
        sortField: params.sortField || 'createdTimestamp',
        fromCursorKey: params.start,
        sortOrder: params.sortOrder,
      },
      options?.projection
    )
    const userIds = result.items.map((user) => user.userId)
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

    result = {
      ...result,
      items: params.includeCasesCount
        ? result.items.map((user) => {
            const casesCountItem = casesCount.find(
              (item) => item.userId === user.userId
            )
            return {
              ...user,
              casesCount: casesCountItem?.casesCount || 0,
            }
          })
        : result.items,
    }

    const updatedItems = result.items.map((user) =>
      mapper(user as InternalUser)
    )

    return {
      ...result,
      items: updatedItems,
    } as AllUsersListResponse
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

    if (params.filterId != null) {
      const db = this.mongoDb.db()
      const collection = db.collection<
        InternalConsumerUser | InternalBusinessUser
      >(USERS_COLLECTION(this.tenantId))
      const count = await collection.countDocuments({ userId: params.filterId })
      if (count > 0) {
        // If we can find the user by exact ID match, we don't need to filter by name
        delete params.filterName
      }

      filterConditions.push({
        userId: params.filterId,
      })
    }
    if (params.filterName != null) {
      const filterNameConditions: Filter<
        InternalBusinessUser | InternalConsumerUser
      >[] = []
      // Check if each word in the query has a match in the user's name
      for (const part of params.filterName.split(/\s+/)) {
        const regexFilter = useQuickSearch
          ? prefixRegexMatchFilter(part)
          : regexMatchFilter(part, true)
        // todo: is it safe to pass regexp to mongo, can't it cause infinite calculation?
        filterNameConditions.push({
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
      filterConditions.push({ $and: filterNameConditions })

      if (useQuickSearch) {
        // As quick search searchs by prefix, if a user's name part contains space, we need to match it
        filterConditions.push({
          $or: [
            {
              'userDetails.name.firstName': prefixRegexMatchFilter(
                params.filterName
              ),
            },
            {
              'userDetails.name.middleName': prefixRegexMatchFilter(
                params.filterName
              ),
            },
            {
              'userDetails.name.lastName': prefixRegexMatchFilter(
                params.filterName
              ),
            },
          ],
        })
      }
    }

    if (params.filterUserIds != null) {
      filterConditions.push({
        userId: {
          $in: params.filterUserIds,
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

  public async updateMonitoringStatus(
    userId: string,
    isMonitoringEnabled: boolean
  ) {
    await this.updateUser(userId, { isMonitoringEnabled })
  }

  public async getTotalEnabledOngoingMonitoringUsers(): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalBusinessUser>(
      USERS_COLLECTION(this.tenantId)
    )

    return await collection.countDocuments({ isMonitoringEnabled: true })
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
    // TODO: After switch to V8 remove these calls as right now they return the same values as V8
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

  public async getMongoBusinessUser(
    userId: string
  ): Promise<InternalBusinessUser | null> {
    const mongoUser = this.getMongoUser(userId, 'BUSINESS')
    return mongoUser as unknown as InternalBusinessUser | null
  }

  public async getMongoConsumerUser(
    userId: string
  ): Promise<InternalConsumerUser | null> {
    const mongoUser = this.getMongoUser(userId, 'CONSUMER')
    return mongoUser as unknown as InternalConsumerUser | null
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

  public getOngoingScreeningUsersCursor(): FindCursor<InternalBusinessUser> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalBusinessUser>(
      USERS_COLLECTION(this.tenantId)
    )

    return collection.find({
      isMonitoringEnabled: true,
    })
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

    if (this.tenantId.toLowerCase() === '0789ad73b8') {
      if (user.linkedEntities) {
        ;(user.linkedEntities as any).childUserIds = undefined
      }
    }

    return user as T
  }

  public async getUsersByIds(
    userIds: string[]
  ): Promise<UserWithRulesResult[]> {
    return await batchGet<UserWithRulesResult | BusinessWithRulesResult>(
      this.dynamoDb,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      userIds.map((userId) => DynamoDbKeys.USER(this.tenantId, userId)),
      { ConsistentRead: true }
    )
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
      UpdateExpression: `set #executedRules = :executedRules, #hitRules = :hitRules`,
      ExpressionAttributeNames: {
        '#executedRules': 'executedRules',
        '#hitRules': 'hitRules',
      },
      ExpressionAttributeValues: {
        ':executedRules': executedRules,
        ':hitRules': hitRulesResults,
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
      const { localTarponChangeCaptureHandler } = await import(
        '@/utils/local-dynamodb-change-handler'
      )
      await localTarponChangeCaptureHandler(this.tenantId, primaryKey)
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
      UpdateExpression: `set #executedRules = :executedRules, #hitRules = :hitRules`,
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
      const { localTarponChangeCaptureHandler } = await import(
        '@/utils/local-dynamodb-change-handler'
      )
      await localTarponChangeCaptureHandler(this.tenantId, primaryKey)
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

  public async saveUser(
    user: UserWithRulesResult | BusinessWithRulesResult,
    type: UserType
  ): Promise<UserWithRulesResult | BusinessWithRulesResult> {
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

    const primaryKey = DynamoDbKeys.USER(this.tenantId, userId)
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Item: {
        ...primaryKey,
        ...newUser,
      },
    }

    await this.dynamoDb.send(new PutCommand(putItemInput))

    if (runLocalChangeHandler()) {
      const { localTarponChangeCaptureHandler } = await import(
        '@/utils/local-dynamodb-change-handler'
      )
      await localTarponChangeCaptureHandler(this.tenantId, primaryKey)
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

    await Promise.all([
      internalMongoUpdateOne(
        this.mongoDb,
        USERS_COLLECTION(this.tenantId),
        { userId: user.userId },
        { $set: updateWithoutId },
        { session: options?.session }
      ),
      this.updateUniqueTags(userToSave?.tags),
    ])

    return user as InternalUser
  }

  public async updateUniqueTags(tags: InternalUser['tags']): Promise<void> {
    const db = this.mongoDb.db()
    const uniqueTagsCollection = db.collection(
      UNIQUE_TAGS_COLLECTION(this.tenantId)
    )

    const uniqueTags = uniq(
      tags?.map((tag) => ({ key: tag.key, value: tag.value }))
    )

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

      const uniqueTags = await uniqueTagsCollection
        .find({ type: 'USER' })
        .project({ tag: 1 })
        .toArray()

      return uniqueTags.map((doc) => doc.tag)
    }
    if (params.field === 'TAGS_VALUE') {
      const uniqueTagsCollection = db.collection(
        UNIQUE_TAGS_COLLECTION(this.tenantId)
      )
      const uniqueTags = await uniqueTagsCollection
        .find({
          type: 'USER',
          ...(params.filter
            ? { tag: prefixRegexMatchFilter(params.filter) }
            : {}),
        })
        .project({ value: 1 })
        .toArray()

      return uniqueTags.map((doc) => doc.value)
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
    console.info(userId, attachmentId)
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
      { userId },
      { $set: { avgArsScore } }
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

  public async updateKrsScoreOfUserMongo(
    userId: string,
    krsScore: KrsScore
  ): Promise<void> {
    await this.updateUser(userId, { krsScore })
  }

  public getUsersWithoutKrsScoreCursor(
    userIds: string[] = []
  ): FindCursor<InternalUser> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )

    const users = collection
      .find({
        ...(userIds.length > 0
          ? { userId: { $in: userIds } }
          : { krsScore: { $exists: false } }),
      })
      .batchSize(100)

    return users
  }

  public async getEstimatedUsersCount(): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )
    const count = await collection.estimatedDocumentCount()
    return count
  }

  public sampleUsersCursor(count: number): AggregationCursor<InternalUser> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )

    const users = collection.aggregate<InternalUser>([
      { $sample: { size: count } },
    ])

    return users
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
    mapper: (user: InternalUser) => AllUsersTableItem
  ): Promise<AllUsersListResponse> {
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

    return this.getMongoUsersCursorsPaginate(
      {
        ...params,
        filterUserIds: uniq(data?.userIds.flat()),
      },
      mapper
    )
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
}
