import { Filter, MongoClient } from 'mongodb'
import { StackConstants } from '@cdk/constants'
import { AttributeMap, ItemList } from 'aws-sdk/clients/dynamodb'
import {
  BatchGetCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb'
import _ from 'lodash'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { USERS_COLLECTION } from '@/utils/mongoDBUtils'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { UserType } from '@/@types/user/user-type'
import { FilterOperator } from '@/@types/openapi-internal/FilterOperator'

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

  public async getMongoBusinessUsers(params: {
    limit: number
    skip: number
    afterTimestamp?: number
    beforeTimestamp: number
    filterId?: string
    filterName?: string
    filterOperator?: FilterOperator
  }): Promise<{ total: number; data: Array<InternalBusinessUser> }> {
    return (await this.getMongoUsers(params, 'BUSINESS')) as {
      total: number
      data: Array<InternalBusinessUser>
    }
  }

  public async getMongoConsumerUsers(params: {
    limit: number
    skip: number
    afterTimestamp?: number
    beforeTimestamp: number
    filterId?: string
    filterName?: string
    filterOperator?: FilterOperator
  }): Promise<{ total: number; data: Array<InternalConsumerUser> }> {
    return (await this.getMongoUsers(params, 'CONSUMER')) as {
      total: number
      data: Array<InternalConsumerUser>
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
    params: {
      limit: number
      skip: number
      afterTimestamp?: number
      beforeTimestamp: number
      filterId?: string
      filterName?: string
      filterOperator?: FilterOperator
    },
    userType: UserType
  ): Promise<{
    total: number
    data: Array<InternalBusinessUser | InternalConsumerUser>
  }> {
    const db = this.mongoDb.db()

    const collectionName = USERS_COLLECTION(this.tenantId)
    const collection = db.collection<
      InternalBusinessUser | InternalConsumerUser
    >(collectionName)

    const filterConditions: Filter<
      InternalBusinessUser | InternalConsumerUser
    >[] = []

    if (params.filterId != null) {
      filterConditions.push({
        userId: { $regex: params.filterId },
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
              'userDetails.name.firstName': {
                $regex: part,
                $options: 'i',
              },
            },
            {
              'userDetails.name.middleName': {
                $regex: part,
                $options: 'i',
              },
            },
            {
              'userDetails.name.lastName': {
                $regex: part,
                $options: 'i',
              },
            },
            {
              'legalEntity.companyGeneralDetails.legalName': {
                $regex: part,
                $options: 'i',
              },
            },
          ],
        })
      }
      filterConditions.push({ $and: filterNameConditions })
    }

    const queryConditions: Filter<
      InternalBusinessUser | InternalConsumerUser
    >[] = [
      {
        createdTimestamp: {
          $gte: params.afterTimestamp || 0,
          $lte: params.beforeTimestamp,
        },
        type: userType,
      },
    ]

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

    const users = await collection
      .find(query)
      .sort({ timestamp: -1 })
      .limit(params.limit)
      .skip(params.skip)
      .toArray()
    const total = await collection.count(query)
    return { total, data: users }
  }

  public async getBusinessUser(userId: string): Promise<Business | undefined> {
    return await this.getUser<Business>(userId)
  }

  public async getConsumerUser(userId: string): Promise<User | undefined> {
    return await this.getUser<User>(userId)
  }

  public async getUsers(userIds: string[]): Promise<(User | Business)[]> {
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

  public async getMongoUsersById(
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

    if (process.env.NODE_ENV === 'development') {
      const { localTarponChangeCaptureHandler } = await import(
        '@/utils/local-dynamodb-change-handler'
      )
      await localTarponChangeCaptureHandler(primaryKey)
    }
    return newUser
  }

  async deleteUser(userId: string): Promise<void> {
    const deleteItemInput: AWS.DynamoDB.DocumentClient.DeleteItemInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.USER(this.tenantId, userId),
    }
    await this.dynamoDb.send(new DeleteCommand(deleteItemInput))
  }
}
