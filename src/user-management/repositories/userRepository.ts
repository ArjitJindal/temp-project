import { TarponStackConstants } from '../../../lib/constants'
import { v4 as uuidv4 } from 'uuid'

type UserType = 'BUSINESS' | 'CONSUMER'

export class UserRepository {
  dynamoDb: AWS.DynamoDB.DocumentClient
  tenantId: string

  constructor(tenantId: string, dynamoDb: AWS.DynamoDB.DocumentClient) {
    this.dynamoDb = dynamoDb
    this.tenantId = tenantId
  }

  // TODO: User type will be generated in FDT-45
  public async getBusinessUser(userId: string): Promise<any> {
    return await this.getUser<any>(userId)
  }

  public async getConsumerUser(userId: string): Promise<any> {
    return await this.getUser<any>(userId)
  }

  private async getUser<T>(userId: string): Promise<any> {
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

  public async createBusinessUser(user: any): Promise<any> {
    return await this.createUser(user, 'BUSINESS')
  }

  public async createConsumerUser(user: any): Promise<any> {
    return await this.createUser(user, 'CONSUMER')
  }

  public async createUser(user: any, type: UserType): Promise<any> {
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
    return newUser
  }
}
