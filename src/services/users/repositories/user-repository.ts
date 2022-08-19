import { v4 as uuidv4 } from 'uuid'
import { Filter, MongoClient } from 'mongodb'
import { TarponStackConstants } from '@cdk/constants'
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
  dynamoDb: AWS.DynamoDB.DocumentClient
  mongoDb: MongoClient
  tenantId: string

  constructor(
    tenantId: string,
    connections: {
      dynamoDb?: AWS.DynamoDB.DocumentClient
      mongoDb?: MongoClient
    }
  ) {
    this.dynamoDb = connections.dynamoDb as AWS.DynamoDB.DocumentClient
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
      // todo: is it safe to pass regexp to mongo, can't it cause infinite calculation?
      filterConditions.push({
        $or: [
          {
            'userDetails.name.firstName': {
              $regex: params.filterName,
              $options: 'i',
            },
          },
          {
            'userDetails.name.middleName': {
              $regex: params.filterName,
              $options: 'i',
            },
          },
          {
            'userDetails.name.lastName': {
              $regex: params.filterName,
              $options: 'i',
            },
          },
          {
            'legalEntity.companyGeneralDetails.legalName': {
              $regex: params.filterName,
              $options: 'i',
            },
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

  public async getBusinessUser(userId: string): Promise<Business> {
    return await this.getUser<Business>(userId)
  }

  public async getConsumerUser(userId: string): Promise<User> {
    return await this.getUser<User>(userId)
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

  public async getUser<T>(userId: string): Promise<T> {
    const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.USER(this.tenantId, userId),
      ReturnConsumedCapacity: 'TOTAL',
    }
    const result = await this.dynamoDb.get(getItemInput).promise()
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

  public async saveUser(
    user: User | Business,
    type: UserType
  ): Promise<User | Business> {
    const userId = user.userId || uuidv4()
    const newUser = {
      ...user,
      userId,
    }
    const primaryKey = DynamoDbKeys.USER(this.tenantId, userId)
    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Item: {
        ...primaryKey,
        type,
        ...newUser,
      },
      ReturnConsumedCapacity: 'TOTAL',
    }
    await this.dynamoDb.put(putItemInput).promise()

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
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.USER(this.tenantId, userId),
      ReturnConsumedCapacity: 'TOTAL',
    }
    await this.dynamoDb.delete(deleteItemInput).promise()
  }
}
