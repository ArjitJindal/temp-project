import { TarponStackConstants } from '../../../lib/constants'
import { v4 as uuidv4 } from 'uuid'
import { User } from '../../@types/openapi/user'
import { Business } from '../../@types/openapi/business'

type UserType = 'BUSINESS' | 'CONSUMER'

export class UserRepository {
  dynamoDb: AWS.DynamoDB.DocumentClient
  tenantId: string

  constructor(tenantId: string, dynamoDb: AWS.DynamoDB.DocumentClient) {
    this.dynamoDb = dynamoDb
    this.tenantId = tenantId
  }

  public async getBusinessUser(userId: string): Promise<Business> {
    return await this.getUser<Business>(userId)
  }

  public async getConsumerUser(userId: string): Promise<User> {
    return await this.getUser<User>(userId)
  }

  private async getUser<T>(userId: string): Promise<T> {
    const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: {
        PartitionKeyID: `${this.tenantId}#user`,
        SortKeyID: userId,
      },
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
    return await this.createUser(<Business>user, 'BUSINESS')
  }

  public async createConsumerUser(user: User): Promise<User> {
    return await this.createUser<User>(user, 'CONSUMER')
  }

  public async createUser<T>(
    user: User | Business,
    type: UserType
  ): Promise<T> {
    const userId = user.userId || uuidv4()
    const newUser = {
      ...user,
      userId,
    }
    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Item: {
        PartitionKeyID: `${this.tenantId}#user`,
        SortKeyID: userId,
        type,
        ...newUser,
      },
      ReturnConsumedCapacity: 'TOTAL',
    }
    await this.dynamoDb.put(putItemInput).promise()
    return newUser as any as T
  }
}
