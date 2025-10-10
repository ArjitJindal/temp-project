import {
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  PutCommand,
  PutCommandInput,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { RuleVarsOptimzationData } from './types'
import { traceable } from '@/core/xray'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

@traceable
export class RuleThresholdOptimizerRepository {
  private dynamoDb: DynamoDBDocumentClient
  private tenantId: string
  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
  }
  public async getRuleInstanceThresholdData(
    ruleInstanceId: string
  ): Promise<RuleVarsOptimzationData | undefined> {
    const command: GetCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.RULE_INSTANCE_THRESHOLD_OPTIMIZATION_DATA(
        this.tenantId,
        ruleInstanceId,
        '1'
      ),
    }
    const result = await this.dynamoDb.send(new GetCommand(command))
    if (!result.Item) {
      return undefined
    }
    return result.Item as RuleVarsOptimzationData
  }

  public async updateorCreateRuleInstanceThresholdData(
    ruleInstanceId: string,
    data: RuleVarsOptimzationData
  ) {
    const command: PutCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Item: {
        ...DynamoDbKeys.RULE_INSTANCE_THRESHOLD_OPTIMIZATION_DATA(
          this.tenantId,
          ruleInstanceId,
          '1'
        ),
        ...data,
      },
    }
    await this.dynamoDb.send(new PutCommand(command))
  }
}
