import _ from 'lodash'
import { migrateAllTenants } from './tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'

export type ParameterNewFieldRequest = {
  parameterName: string
  newField: Record<string, unknown>
}

export async function addNewPulseRiskParameterField(
  parameterNewFieldRequest: ParameterNewFieldRequest
) {
  await migrateAllTenants((tenant) =>
    addNewPulseRiskParameterFieldPrivate(parameterNewFieldRequest, tenant.id)
  )
}

async function addNewPulseRiskParameterFieldPrivate(
  parameterNewFieldRequest: ParameterNewFieldRequest,
  tenantId: string
) {
  const dynamoDb = await getDynamoDbClient()

  const riskRepository = new RiskRepository(tenantId, { dynamoDb })

  const parameters = (await riskRepository.getParameterRiskItems()) ?? []
  const { newField, parameterName } = parameterNewFieldRequest
  for (const parameterAttributeDetails of parameters) {
    if (parameterName === parameterAttributeDetails.parameter) {
      riskRepository.createOrUpdateParameterRiskItem({
        ...parameterAttributeDetails,
        ...newField,
      })
    }
  }
}
