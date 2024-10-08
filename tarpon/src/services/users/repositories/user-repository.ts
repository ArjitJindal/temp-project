import {
  Filter,
  MongoClient,
  Document,
  FindCursor,
  WithId,
  AggregationCursor,
  UpdateFilter,
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
import { get, isEmpty, keyBy, mapValues, mergeWith, set, uniq } from 'lodash'
import { getRiskLevelFromScore } from '@flagright/lib/utils'
import { getUsersFilterByRiskLevel } from '../utils/user-utils'
import { Comment } from '@/@types/openapi-internal/Comment'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import {
  DAY_DATE_FORMAT,
  internalMongoFindAndUpdate,
  internalMongoReplace,
  paginatePipeline,
  prefixRegexMatchFilter,
  regexMatchFilter,
} from '@/utils/mongodb-utils'
import {
  CASES_COLLECTION,
  TRANSACTIONS_COLLECTION,
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
  PaginationParams,
  COUNT_QUERY_LIMIT,
  OptionalPagination,
  OptionalPaginationParams,
  cursorPaginate,
} from '@/utils/pagination'
import { Tag } from '@/@types/openapi-public/Tag'
import { UserRegistrationStatus } from '@/@types/openapi-internal/UserRegistrationStatus'
import { ExecutedRulesResult } from '@/@types/openapi-internal/ExecutedRulesResult'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { BusinessWithRulesResult } from '@/@types/openapi-public/BusinessWithRulesResult'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { SortOrder } from '@/@types/openapi-internal/SortOrder'
import { RiskScoringService } from '@/services/risk-scoring'
import { UserRiskScoreDetails } from '@/@types/openapi-public/UserRiskScoreDetails'
import { runLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { traceable } from '@/core/xray'
import { isBusinessUser } from '@/services/rules-engine/utils/user-rule-utils'
import {
  DefaultApiGetAllUsersListRequest,
  DefaultApiGetRuleInstancesTransactionUsersHitRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { Case } from '@/@types/openapi-internal/Case'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { AllUsersListResponse } from '@/@types/openapi-internal/AllUsersListResponse'
import { DefaultApiGetUsersSearchRequest } from '@/@types/openapi-public-management/RequestParameters'
import { UserRulesResult } from '@/@types/openapi-public/UserRulesResult'
import { AverageArsScore } from '@/@types/openapi-internal/AverageArsScore'

@traceable
export class UserRepository {
  dynamoDb: DynamoDBDocumentClient
  mongoDb: MongoClient
  tenantId: string

  constructor(
    tenantId: string,
    connections: {
      dynamoDb?: DynamoDBDocumentClient
      mongoDb?: MongoClient
    }
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
    await internalMongoFindAndUpdate(
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
    params: OptionalPagination<
      DefaultApiGetAllUsersListRequest & { filterUserIds?: string[] }
    >,
    userType?: UserType
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
      { $and: query },
      {
        pageSize: params.pageSize ? (params.pageSize as number) : 20,
        sortField: params.sortField || 'createdTimestamp',
        fromCursorKey: params.start,
        sortOrder: params.sortOrder,
      }
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

    if (isPulseEnabled) {
      result.items = this.insertRiskScores(
        result.items,
        riskClassificationValues
      )
    }

    return result as AllUsersListResponse
  }

  private insertRiskScores(
    items:
      | WithId<InternalBusinessUser | InternalConsumerUser>[]
      | (InternalBusinessUser | InternalConsumerUser)[],
    riskClassificationValues: RiskClassificationScore[]
  ) {
    const updatedItems = items.map((user) => {
      const drsScore = user?.drsScore
      const krsScore = user?.krsScore
      let newUser = user
      if (drsScore != null) {
        const derivedRiskLevel = drsScore?.manualRiskLevel
          ? undefined
          : getRiskLevelFromScore(riskClassificationValues, drsScore?.drsScore)
        const newDrsScore: DrsScore = {
          ...drsScore,
          derivedRiskLevel,
        }
        newUser = {
          ...newUser,
          drsScore: newDrsScore,
        }
      }

      if (krsScore != null) {
        const derivedRiskLevel = getRiskLevelFromScore(
          riskClassificationValues,
          krsScore?.krsScore
        )

        const newKrsScore: KrsScore = {
          ...krsScore,
          riskLevel: derivedRiskLevel,
        }

        newUser = {
          ...newUser,
          krsScore: newKrsScore,
        }
      }
      return newUser
    })
    return updatedItems
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
    params: OptionalPaginationParams & {
      afterTimestamp?: number
      beforeTimestamp?: number
      filterId?: string
      filterName?: string
      filterOperator?: FilterOperator
      filterBusinessIndustries?: string
      filterRiskLevel?: RiskLevel[]
      filterTagKey?: string
      filterTagValue?: string
      filterUserRegistrationStatus?: UserRegistrationStatus[]
      sortField?: string
      sortOrder?: SortOrder
      filterRiskLevelLocked?: string
      filterShadowHit?: boolean
      filterRuleInstancesHit?: string[]
      filterUserIds?: string[]
      filterEmail?: string
      filterParentUserId?: string
      filterIsPepHit?: string
    },
    isPulseEnabled: boolean,
    riskClassificationValues?: RiskClassificationScore[],
    userType?: UserType | undefined
  ) {
    const filterConditions: Filter<
      InternalBusinessUser | InternalConsumerUser
    >[] = []

    if (params.filterId != null) {
      filterConditions.push({
        userId: params.filterId,
      })
    }

    if (params.filterUserIds != null) {
      filterConditions.push({
        userId: {
          $in: params.filterUserIds,
        },
      })
    }
    if (params.filterParentUserId != null) {
      filterConditions.push({
        'linkedEntities.parentUserId': params.filterParentUserId,
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

    if (params.filterIsPepHit != null) {
      const isPepHit = params.filterIsPepHit === 'true' ? true : false
      filterConditions.push({
        'pepStatus.isPepHit': isPepHit,
      })
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

    if (params.filterName != null) {
      const filterNameConditions: Filter<
        InternalBusinessUser | InternalConsumerUser
      >[] = []
      for (const part of params.filterName.split(/\s+/)) {
        // todo: is it safe to pass regexp to mongo, can't it cause infinite calculation?
        filterNameConditions.push({
          $or: [
            {
              'userDetails.name.firstName': regexMatchFilter(part, true),
            },
            {
              'userDetails.name.middleName': regexMatchFilter(part, true),
            },
            {
              'userDetails.name.lastName': regexMatchFilter(part, true),
            },
            {
              'legalEntity.companyGeneralDetails.legalName': regexMatchFilter(
                part,
                true
              ),
            },
            {
              userId: prefixRegexMatchFilter(part, true),
            },
          ],
        })
      }

      filterConditions.push({ $and: filterNameConditions })
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
    params: OptionalPaginationParams & {
      afterTimestamp?: number
      beforeTimestamp?: number
      filterId?: string
      filterName?: string
      filterOperator?: FilterOperator
      filterBusinessIndustries?: string
      filterRiskLevel?: RiskLevel[]
      filterTagKey?: string
      filterTagValue?: string
      includeCasesCount?: boolean
      filterUserRegistrationStatus?: UserRegistrationStatus[]
      sortField?: string
      sortOrder?: SortOrder
      filterRiskLevelLocked?: string
      filterShadowHit?: boolean
      filterRuleInstancesHit?: string[]
      filterParentUserId?: string
    },
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
      users = this.insertRiskScores(users, riskClassificationValues)
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
    const riskScoringService = new RiskScoringService(this.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: this.mongoDb,
    })

    // TODO: After switch to V8 remove these calls as right now they return the same values as V8

    const [kycRiskScore, craRiskScore, riskClassificationValues] =
      await Promise.all([
        riskScoringService.getKrsScore(userId),
        riskScoringService.getDrsScore(userId),
        riskScoringService.riskRepository.getRiskClassificationValues(),
      ])

    const kycRiskLevel = getRiskLevelFromScore(
      riskClassificationValues,
      kycRiskScore ?? null
    )

    const craRiskLevel = getRiskLevelFromScore(
      riskClassificationValues,
      craRiskScore ?? null
    )

    if (hasFeature('RISK_LEVELS') && !hasFeature('RISK_SCORING')) {
      return { craRiskLevel, craRiskScore }
    }

    return { kycRiskScore, craRiskScore, kycRiskLevel, craRiskLevel }
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

  public getAllUsersCursor(): FindCursor<WithId<InternalUser>> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )

    return collection.find({})
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
    userType?: 'BUSINESS' | 'CONSUMER'
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
    return await collection.findOne(matchCondition as Filter<InternalUser>)
  }

  public async getMongoUsersByIds(userIds: string[]): Promise<InternalUser[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )
    return await collection.find({ userId: { $in: userIds } }).toArray()
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

  public async getUser<T>(
    userId: string,
    options?: { consistentRead?: boolean }
  ): Promise<T | undefined> {
    const getItemInput: GetCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.USER(this.tenantId, userId),
      ...(options?.consistentRead && { ConsistentRead: true }),
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
    try {
      await this.dynamoDb.send(new PutCommand(putItemInput))
    } catch (error) {
      console.log('Full error:', JSON.stringify(error, null, 2)) // Log full error details
    }
    if (runLocalChangeHandler()) {
      const { localTarponChangeCaptureHandler } = await import(
        '@/utils/local-dynamodb-change-handler'
      )
      await localTarponChangeCaptureHandler(this.tenantId, primaryKey)
    }
    return newUser
  }

  public async saveUserMongo(
    user: InternalBusinessUser | InternalConsumerUser
  ): Promise<InternalUser> {
    await internalMongoReplace(
      this.mongoDb,
      USERS_COLLECTION(this.tenantId),
      { userId: user.userId },
      {
        ...user,
        createdAt: user.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      }
    )

    return user as InternalUser
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
    switch (params.field) {
      case 'BUSINESS_INDUSTRY':
        fieldPath = 'legalEntity.companyGeneralDetails.businessIndustry'
        unwindPath = 'legalEntity.companyGeneralDetails.businessIndustry'
        break
      case 'TAGS_KEY':
        fieldPath = 'tags.key'
        unwindPath = 'tags'
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
    await internalMongoFindAndUpdate(
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

  public async updateAvgTrsScoreOfUser(
    userId: string,
    avgArsScore: AverageArsScore
  ): Promise<void> {
    await internalMongoFindAndUpdate(
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
    await internalMongoFindAndUpdate(
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

  public getUsersWithoutKrsScoreCursor(): FindCursor<InternalUser> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )

    const users = collection
      .find({
        krsScore: { $exists: false },
      })
      .batchSize(100)

    return users
  }

  public async getUsersCount(): Promise<number> {
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
    params: DefaultApiGetRuleInstancesTransactionUsersHitRequest
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

    return this.getMongoUsersCursorsPaginate({
      ...params,
      filterUserIds: uniq(data?.userIds.flat()),
    })
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
    const timestampMatch = {
      createdTimestamp: {
        $gte: timeRange.afterTimestamp,
        $lt: timeRange.beforeTimestamp,
      },
    }
    const ruleElementMatchCondition = {
      ruleInstanceId,
    }
    if (isShadowRule) {
      ruleElementMatchCondition['isShadow'] = true
    } else {
      ruleElementMatchCondition['isShadow'] = { $ne: true }
    }
    const groupBy = {
      $dateToString: {
        format: DAY_DATE_FORMAT,
        date: { $toDate: '$createdTimestamp' },
      },
    }
    const runPipeline = [
      {
        $match: {
          ...timestampMatch,
          executedRules: { $elemMatch: ruleElementMatchCondition },
        },
      },
      {
        $group: {
          _id: groupBy,
          runCount: { $sum: 1 },
        },
      },
    ]
    const hitPipeline = [
      {
        $match: {
          ...timestampMatch,
          hitRules: { $elemMatch: ruleElementMatchCondition },
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
    await internalMongoFindAndUpdate(
      this.mongoDb,
      USERS_COLLECTION(this.tenantId),
      { userId },
      { $set: update }
    )
  }
}
