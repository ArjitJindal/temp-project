import { Filter, MongoClient, Document } from 'mongodb'
import { StackConstants } from '@cdk/constants'
import { AttributeMap, ItemList } from 'aws-sdk/clients/dynamodb'
import { v4 as uuidv4 } from 'uuid'
import {
  BatchGetCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb'
import _ from 'lodash'
import { Comment } from '@/@types/openapi-internal/Comment'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import {
  CASES_COLLECTION,
  paginatePipeline,
  prefixRegexMatchFilter,
  regexMatchFilter,
  USERS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
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

  public async saveMongoUserFile(
    userId: string,
    file: FileInfo
  ): Promise<FileInfo> {
    const db = this.mongoDb.db()
    const collection = db.collection<
      InternalBusinessUser | InternalConsumerUser
    >(USERS_COLLECTION(this.tenantId))
    await collection.updateOne(
      {
        userId,
      },
      {
        $push: { files: file },
      }
    )
    return file
  }

  public async deleteMongoUserFile(userId: string, fileId: string) {
    const db = this.mongoDb.db()
    const collection = db.collection<
      InternalBusinessUser | InternalConsumerUser
    >(USERS_COLLECTION(this.tenantId))
    await collection.updateOne(
      {
        userId,
      },
      {
        $pull: { files: { s3Key: fileId } },
      }
    )
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

    const isPulseEnabled = hasFeature('PULSE')

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
        elemCondition['key'] = { $eq: params.filterTagKey }
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
                  $ne: 'CLOSED',
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

    let users = await collection
      .aggregate<InternalBusinessUser | InternalConsumerUser>([
        {
          $match: query,
        },
        { $sort: { createdTimestamp: -1 } },
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
    const total = await collection.count(query, { limit: COUNT_QUERY_LIMIT })
    return { total, data: users }
  }

  public async getBusinessUser(userId: string): Promise<Business | undefined> {
    return await this.getUser<Business>(userId)
  }

  public async getConsumerUser(userId: string): Promise<User | undefined> {
    return await this.getUser<User>(userId)
  }

  public async getUsers(userIds: string[]): Promise<(User | Business)[]> {
    if (userIds.length === 0) {
      return []
    }
    const batchGetItemInput: AWS.DynamoDB.DocumentClient.BatchGetItemInput = {
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
    const users: ItemList =
      result.Responses?.[StackConstants.TARPON_DYNAMODB_TABLE_NAME] || []
    return users.map((user: AttributeMap) => {
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

  public async getMongoUser(
    userId: string
  ): Promise<InternalConsumerUser | InternalBusinessUser | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<
      InternalConsumerUser | InternalBusinessUser
    >(USERS_COLLECTION(this.tenantId))
    return await collection.findOne({ userId })
  }

  public async getMongoUsersByIds(
    userIds: string[]
  ): Promise<(InternalConsumerUser | InternalBusinessUser)[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<
      InternalConsumerUser | InternalBusinessUser
    >(USERS_COLLECTION(this.tenantId))
    return (await collection.find({ userId: { $in: userIds } }).toArray()) as (
      | InternalConsumerUser
      | InternalBusinessUser
    )[]
  }

  public async getUser<T>(userId: string): Promise<T | undefined> {
    const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
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
    delete user.type
    delete user.PartitionKeyID
    delete user.SortKeyID
    return user as T
  }

  public async saveBusinessUser(user: Business): Promise<Business> {
    return (await this.saveUser(user, 'BUSINESS')) as Business
  }

  public async saveConsumerUser(user: User): Promise<User> {
    return (await this.saveUser(user, 'CONSUMER')) as User
  }

  private sanitizeUserInPlace(user: User | Business) {
    const COUNTRY_FIELD_PATHS = [
      'userDetails.countryOfResidence',
      'userDetails.countryOfNationality',
      'legalEntity.companyRegistrationDetails.registrationCountry',
    ]
    COUNTRY_FIELD_PATHS.forEach((path) => {
      if (_.get(user, path) === 'N/A') {
        _.set(user, path, undefined)
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
    user: User | Business,
    type: UserType
  ): Promise<User | Business> {
    this.sanitizeUserInPlace(user)
    const userId = user.userId
    const newUser = {
      ...user,
      userId,
      type,
    }
    const primaryKey = DynamoDbKeys.USER(this.tenantId, userId)
    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Item: {
        ...primaryKey,
        ...newUser,
      },
    }
    await this.dynamoDb.send(new PutCommand(putItemInput))

    if (
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'local' ||
      process.env.NODE_ENV === 'test'
    ) {
      const { localTarponChangeCaptureHandler } = await import(
        '@/utils/local-dynamodb-change-handler'
      )
      await localTarponChangeCaptureHandler(primaryKey)
    }
    return newUser
  }

  public async saveUserMongo(
    user: (User | Business) & { krsScore?: KrsScore; drsScore?: DrsScore }
  ): Promise<(User | Business) & { krsScore?: KrsScore; drsScore?: DrsScore }> {
    const db = this.mongoDb.db()
    const userCollection = db.collection<
      (User | Business) & { krsScore?: KrsScore; drsScore?: DrsScore }
    >(USERS_COLLECTION(this.tenantId))

    await userCollection.replaceOne({ userId: user.userId }, user, {
      upsert: true,
    })
    return user
  }

  public async deleteUser(userId: string): Promise<void> {
    const deleteItemInput: AWS.DynamoDB.DocumentClient.DeleteItemInput = {
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
    const filterConditions = []
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
    ].filter((stage) => !_.isEmpty(stage))

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
      {
        $push: { comments: commentToSave },
      }
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
}
