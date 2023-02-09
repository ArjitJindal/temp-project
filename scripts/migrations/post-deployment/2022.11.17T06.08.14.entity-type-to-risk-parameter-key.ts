import { DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@cdk/constants'
import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { Tenant } from '@/services/accounts'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = await getDynamoDbClient()
  const riskRepository = new RiskRepository(tenant.id, { dynamoDb })
  const parameters = (await riskRepository.getParameterRiskItems()) ?? []
  for (const parameterAttributeDetails of parameters) {
    await dynamoDb.send(
      new DeleteCommand({
        TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
        Key: {
          PartitionKeyID: DynamoDbKeys.PARAMETER_RISK_SCORES_DETAILS(
            tenant.id,
            parameterAttributeDetails.parameter
          ).PartitionKeyID,
          SortKeyID: parameterAttributeDetails.parameter,
        },
      })
    )
  }
}
export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
