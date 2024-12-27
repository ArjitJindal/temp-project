import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { CRMIntegrations } from '@/@types/openapi-internal/CRMIntegrations'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { traceable } from '@/core/xray'

@traceable
export class CrmRepository {
  private readonly tenantId: string
  private readonly dynamoDb: DynamoDBDocumentClient

  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
  }

  public async getIntegrations(): Promise<CRMIntegrations> {
    const command = new GetCommand({
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.CRM_INTEGRATIONS(this.tenantId),
    })

    const response = await this.dynamoDb.send(command)
    return response.Item as CRMIntegrations
  }

  public async storeIntegrations(integrations: CRMIntegrations) {
    const command = new PutCommand({
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Item: {
        ...integrations,
        ...DynamoDbKeys.CRM_INTEGRATIONS(this.tenantId),
      },
    })

    await this.dynamoDb.send(command)
  }
}
