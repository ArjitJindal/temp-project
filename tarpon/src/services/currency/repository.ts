import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { CurrencyExchangeUSDType } from '.'
import { traceable } from '@/core/xray'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'

const TableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID)

@traceable
export class CurrencyRepository {
  dynamoDb: DynamoDBDocumentClient

  constructor(dynamoDb: DynamoDBDocumentClient) {
    this.dynamoDb = dynamoDb
  }

  public async storeCache(
    cdnData: CurrencyExchangeUSDType
  ): Promise<CurrencyExchangeUSDType> {
    const keys = DynamoDbKeys.CURRENCY_CACHE()
    const command = new PutCommand({
      TableName,
      Item: {
        ...keys,
        ...cdnData,
      },
    })

    await this.dynamoDb.send(command)

    return cdnData
  }

  public async getCache(): Promise<CurrencyExchangeUSDType | undefined> {
    const keys = DynamoDbKeys.CURRENCY_CACHE()
    const command = await this.dynamoDb.send(
      new GetCommand({
        TableName,
        Key: keys,
      })
    )

    return command.Item as CurrencyExchangeUSDType
  }

  public async clearCache(): Promise<void> {
    const keys = DynamoDbKeys.CURRENCY_CACHE()
    const command = new DeleteCommand({
      TableName,
      Key: keys,
    })

    await this.dynamoDb.send(command)
  }

  public async expireCache(): Promise<void> {
    const keys = DynamoDbKeys.CURRENCY_CACHE()
    const command = new UpdateCommand({
      TableName,
      Key: keys,
      UpdateExpression: 'set #date = :date',
      ExpressionAttributeNames: {
        '#date': 'date',
      },
      ExpressionAttributeValues: {
        ':date': '1970-01-01',
      },
    })

    await this.dynamoDb.send(command)
  }
}
