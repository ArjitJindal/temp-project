import { StackConstants } from '@lib/constants'
import { QueryCommandInput } from '@aws-sdk/lib-dynamodb'
import { omit } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient, paginateQuery } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { ParameterAttributeRiskValues } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { RiskParameterLevelKeyValue } from '@/@types/openapi-internal/RiskParameterLevelKeyValue'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const riskRepository = new RiskRepository(tenant.id, { dynamoDb, mongoDb })
  const { PartitionKeyID } = DynamoDbKeys.PARAMETER_RISK_SCORES_DETAILS(
    tenant.id
  )
  const expressionAttributeVals = {
    ':pk': PartitionKeyID,
  }
  const keyConditionExpr = 'PartitionKeyID = :pk'
  const queryInput: QueryCommandInput = {
    TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
    KeyConditionExpression: keyConditionExpr,
    ExpressionAttributeValues: expressionAttributeVals,
  }
  try {
    const result = await paginateQuery(dynamoDb, queryInput)

    if (!result.Items?.length) {
      return
    }

    const parameterRiskItems = result.Items.map((item) => {
      return omit(item, [
        'PartitionKeyID',
        'SortKeyID',
      ]) as ParameterAttributeRiskValues
    })
    for await (const parameterRiskItem of parameterRiskItems) {
      const updatedParameterRiskItem = omit(parameterRiskItem, [
        'defaultRiskLevel',
      ])
      updatedParameterRiskItem.riskLevelAssignmentValues =
        updatedParameterRiskItem?.riskLevelAssignmentValues?.map(
          (riskLevelAssignmentValue) => {
            return omit(riskLevelAssignmentValue, [
              'riskLevel',
            ]) as RiskParameterLevelKeyValue
          }
        )
      await riskRepository.createOrUpdateParameterRiskItem(
        updatedParameterRiskItem as ParameterAttributeRiskValues
      )
    }
  } catch (error) {
    console.error('Error while fetching parameter risk items', error)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
