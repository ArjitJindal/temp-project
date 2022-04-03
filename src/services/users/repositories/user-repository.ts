import { v4 as uuidv4 } from 'uuid'
import { MongoClient } from 'mongodb'
import { TarponStackConstants } from '@cdk/constants'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { USERS_COLLECTION } from '@/utils/docDBUtils'

export type UserType = 'BUSINESS' | 'CONSUMER'

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

  public async getUsers(
    // TOOD: Add filtering and sorting
    pagination: { limit: number; skip: number; beforeTimestamp: number },
    userType: UserType
  ): Promise<{ total: number; data: any }> {
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)
    const collection = db.collection<Business | User>(
      USERS_COLLECTION(this.tenantId)
    )
    const query = {
      createdTimestamp: { $lte: pagination.beforeTimestamp },
      type: userType,
    }
    const users = await collection
      .find(query)
      .sort({ timestamp: -1 })
      .limit(pagination.limit)
      .skip(pagination.skip)
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

  public async createBusinessUser(user: Business): Promise<Business> {
    return (await this.createUser(user, 'BUSINESS')) as Business
  }

  public async createConsumerUser(user: User): Promise<User> {
    return (await this.createUser(user, 'CONSUMER')) as User
  }

  public async createUser(
    user: User | Business,
    type: UserType
  ): Promise<User | Business> {
    const userId = user.userId || uuidv4()
    const newUser = {
      ...user,
      userId,
    }
    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Item: {
        ...DynamoDbKeys.USER(this.tenantId, userId),
        type,
        ...newUser,
      },
      ReturnConsumedCapacity: 'TOTAL',
    }
    await this.dynamoDb.put(putItemInput).promise()
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
