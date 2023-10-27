import { Filter, MongoClient, Document, FindCursor } from 'mongodb'
import { StackConstants } from '@lib/constants'
import { v4 as uuidv4 } from 'uuid'
import {
  BatchGetCommand,
  BatchGetCommandInput,
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

import { get, isEmpty, set } from 'lodash'
import { Comment } from '@/@types/openapi-internal/Comment'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import {
  paginatePipeline,
  prefixRegexMatchFilter,
  regexMatchFilter,
} from '@/utils/mongodb-utils'
import { CASES_COLLECTION, USERS_COLLECTION } from '@/utils/mongodb-definitions'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { UserType } from '@/@types/user/user-type'
import { FilterOperator } from '@/@types/openapi-internal/FilterOperator'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { UsersUniquesField } from '@/@types/openapi-internal/UsersUniquesField'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { hasFeature } from '@/core/utils/context'
import { RiskLevel } from '@/@types/openapi-public/RiskLevel'
import {
  getRiskLevelFromScore,
  getRiskScoreBoundsFromLevel,
} from '@/services/risk-scoring/utils'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'
import { neverThrow } from '@/utils/lang'
import {
  OptionalPaginationParams,
  PaginationParams,
  COUNT_QUERY_LIMIT,
} from '@/utils/pagination'
import { Tag } from '@/@types/openapi-public/Tag'
import { UserRegistrationStatus } from '@/@types/openapi-internal/UserRegistrationStatus'
import { ExecutedRulesResult } from '@/@types/openapi-internal/ExecutedRulesResult'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { BusinessWithRulesResult } from '@/@types/openapi-public/BusinessWithRulesResult'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { SortOrder } from '@/@types/openapi-internal/SortOrder'
import { UserResponse } from '@/@types/openapi-public/UserResponse'
import { RiskScoringService } from '@/services/risk-scoring'
import { RiskScoreDetails } from '@/@types/openapi-public/RiskScoreDetails'
import { BusinessResponse } from '@/@types/openapi-public/BusinessResponse'
import { runLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { traceable } from '@/core/xray'
import { isBusinessUser } from '@/services/rules-engine/utils/user-rule-utils'

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

  public async getMongoBusinessUsers(
    params: OptionalPaginationParams & {
      afterTimestamp?: number
      beforeTimestamp: number
      filterId?: string
      filterName?: string
      filterOperator?: FilterOperator
      filterBusinessIndustry?: string
      filterTagKey?: string
      filterTagValue?: string
      filterRiskLevel?: RiskLevel[]
      filterUserRegistrationStatus?: UserRegistrationStatus[]
      sortField?: string
      sortOrder?: SortOrder
    }
  ): Promise<{ total: number; data: Array<InternalBusinessUser> }> {
    return (await this.getMongoUsers(params, 'BUSINESS')) as {
      total: number
      data: Array<InternalBusinessUser>
    }
  }

  public async getMongoConsumerUsers(
    params: PaginationParams & {
      afterTimestamp?: number
      beforeTimestamp: number
      filterId?: string
      filterName?: string
      filterOperator?: FilterOperator
      filterTagKey?: string
      filterTagValue?: string
      filterRiskLevel?: RiskLevel[]
    }
  ): Promise<{ total: number; data: Array<InternalConsumerUser> }> {
    return (await this.getMongoUsers(params, 'CONSUMER')) as {
      total: number
      data: Array<InternalConsumerUser>
    }
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

  public async updateMonitoringStatus(
    userId: string,
    isMonitoringEnabled: boolean
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalBusinessUser>(
      USERS_COLLECTION(this.tenantId)
    )

    await collection.updateOne({ userId }, { $set: { isMonitoringEnabled } })
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

    const filterConditions: Filter<
      InternalBusinessUser | InternalConsumerUser
    >[] = []

    const isPulseEnabled =
      hasFeature('RISK_LEVELS') || hasFeature('RISK_SCORING')

    if (params.filterId != null) {
      filterConditions.push({
        userId: params.filterId,
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
    const riskRepository = new RiskRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: this.mongoDb,
    })
    const riskClassificationValues = isPulseEnabled
      ? await riskRepository.getRiskClassificationValues()
      : []

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
          isPulseEnabled && {
            $or: [
              {
                'drsScore.manualRiskLevel': { $in: params.filterRiskLevel },
              },
              {
                $or: params.filterRiskLevel.map((riskLevel) => {
                  const { lowerBoundRiskScore, upperBoundRiskScore } =
                    getRiskScoreBoundsFromLevel(
                      riskClassificationValues,
                      riskLevel
                    )
                  return {
                    'drsScore.drsScore': {
                      $gte: lowerBoundRiskScore,
                      $lt: upperBoundRiskScore,
                    },
                  }
                }),
              },
            ],
          }),
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
      users = users.map((user) => {
        const drsScore = user?.drsScore
        const krsScore = user?.krsScore
        let newUser = user
        if (drsScore != null) {
          const derivedRiskLevel = drsScore?.manualRiskLevel
            ? undefined
            : getRiskLevelFromScore(
                riskClassificationValues,
                drsScore?.drsScore
              )
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
  ): Promise<RiskScoreDetails> {
    const riskScoringService = new RiskScoringService(this.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: this.mongoDb,
    })

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
  ): Promise<UserResponse | undefined> {
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
  ): Promise<BusinessResponse | undefined> {
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

  public async getAllUserIdsCursor(): Promise<FindCursor<{ userId: string }>> {
    const db = await this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )
    return collection.find({}).project({ userId: 1 }) as FindCursor<{
      userId: string
    }>
  }

  public async getUsers(userIds: string[]): Promise<(User | Business)[]> {
    if (userIds.length === 0) {
      return []
    }
    const batchGetItemInput: BatchGetCommandInput = {
      RequestItems: {
        [StackConstants.TARPON_DYNAMODB_TABLE_NAME]: {
          Keys: Array.from(new Set(userIds)).map((userId) =>
            DynamoDbKeys.USER(this.tenantId, userId)
          ),
        },
      },
    }
    const result = await this.dynamoDb.send(
      new BatchGetCommand(batchGetItemInput)
    )
    const users =
      result.Responses?.[StackConstants.TARPON_DYNAMODB_TABLE_NAME] ?? []

    return users.map((user) => {
      const projectedUser = {
        ...user,
      }
      delete projectedUser.type
      delete projectedUser.PartitionKeyID
      delete projectedUser.SortKeyID
      return projectedUser as unknown as User | Business
    })
  }

  public async getMongoBusinessUser(
    userId: string
  ): Promise<InternalBusinessUser | null> {
    const mongoUser = this.getMongoUser(userId)
    // todo: add 'type' field to users and check
    return mongoUser as unknown as InternalBusinessUser | null
  }

  public async getMongoConsumerUser(
    userId: string
  ): Promise<InternalConsumerUser | null> {
    const mongoUser = this.getMongoUser(userId)
    // todo: add 'type' field to users and check
    return mongoUser as unknown as InternalConsumerUser | null
  }

  public async getMongoUser(userId: string): Promise<InternalUser | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )

    return await collection.findOne({ userId })
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

  public async getUser<T>(userId: string): Promise<T | undefined> {
    const getItemInput: GetCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.USER(this.tenantId, userId),
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

    return user as T
  }

  public async updateUserWithExecutedRules(
    userId: string,
    executedRules: ExecutedRulesResult[],
    hitRulesResults: HitRulesDetails[]
  ): Promise<UserWithRulesResult | BusinessWithRulesResult> {
    const primaryKey = DynamoDbKeys.USER(this.tenantId, userId)
    const updateItemInput: UpdateCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
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
      await localTarponChangeCaptureHandler(primaryKey)
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
    const primaryKey = DynamoDbKeys.USER(this.tenantId, userId)
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
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
      await localTarponChangeCaptureHandler(primaryKey)
    }
    return newUser
  }

  public async saveUserMongo(user: InternalUser): Promise<InternalUser> {
    const db = this.mongoDb.db()
    const userCollection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )

    await userCollection.replaceOne({ userId: user.userId }, user, {
      upsert: true,
    })
    return user
  }

  public async deleteUser(userId: string): Promise<void> {
    const deleteItemInput: DeleteCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
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
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )
    const commentToSave: Comment = {
      ...comment,
      id: uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await collection.updateOne(
      {
        userId,
      },
      [
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
      ]
    )
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

  public async deleteUserComment(userId: string, commentId: string) {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )
    await collection.updateOne(
      {
        userId,
      },
      {
        $pull: { comments: { id: commentId } },
      }
    )
  }

  public async updateDrsScoreOfUser(
    userId: string,
    drsScore: DrsScore
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )
    await collection.updateOne({ userId }, { $set: { drsScore } })

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
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )
    await collection.updateOne({ userId }, { $set: { krsScore } })
  }

  public async getUsersWithoutKrsScoreCursor(): Promise<
    FindCursor<InternalUser>
  > {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )

    const users = await collection
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
}
