import { migrateAllTenants } from './tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { RiskFactorParameter } from '@/@types/openapi-internal/RiskFactorParameter'

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
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const riskRepository = new RiskRepository(tenantId, { dynamoDb, mongoDb })

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

export async function removePulseRiskParameterField(
  parameterField: RiskFactorParameter,
  entityType: RiskEntityType
) {
  await migrateAllTenants((tenant) =>
    removePulseRiskParameterFieldPrivate(parameterField, entityType, tenant.id)
  )
}

async function removePulseRiskParameterFieldPrivate(
  parameterField: RiskFactorParameter,
  entityType: RiskEntityType,
  tenantId: string
) {
  const dynamoDb = await getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const riskRepository = new RiskRepository(tenantId, { dynamoDb, mongoDb })

  await riskRepository.deleteParameterRiskItem(parameterField, entityType)
}

export async function renamePulseRiskParameterField(
  parameterField: RiskFactorParameter,
  entityType: RiskEntityType,
  newParameterName: RiskFactorParameter
) {
  await migrateAllTenants((tenant) =>
    renamePulseRiskParameterFieldPrivate(
      parameterField,
      entityType,
      newParameterName,
      tenant.id
    )
  )
}

async function renamePulseRiskParameterFieldPrivate(
  parameterField: RiskFactorParameter,
  entityType: RiskEntityType,
  newParameterName: RiskFactorParameter,
  tenantId: string
) {
  const dynamoDb = await getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const riskRepository = new RiskRepository(tenantId, { dynamoDb, mongoDb })

  const parameters = (await riskRepository.getParameterRiskItems()) ?? []

  for (const parameterAttributeDetails of parameters) {
    if (
      parameterField === parameterAttributeDetails.parameter &&
      entityType === parameterAttributeDetails.riskEntityType
    ) {
      await riskRepository.createOrUpdateParameterRiskItem({
        ...parameterAttributeDetails,
        parameter: newParameterName,
      })
    }
  }
}
