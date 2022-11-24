import _ from 'lodash'
import { migrateAllTenants } from './tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'

export type ParameterNewFieldRequest = {
  parameterName: string
  newField: Record<string, unknown>
  entityType: RiskEntityType
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
  const { newField, parameterName, entityType } = parameterNewFieldRequest
  for (const parameterAttributeDetails of parameters) {
    if (
      parameterName === parameterAttributeDetails.parameter &&
      entityType === parameterAttributeDetails.riskEntityType
    ) {
      await riskRepository.createOrUpdateParameterRiskItem({
        ...parameterAttributeDetails,
        ...newField,
      })
    }
  }
}
