import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { RiskScoreValueLevel } from '@/@types/openapi-internal/RiskScoreValueLevel'

async function migrateTenant(tenant: Tenant) {
  const tenantId = tenant.id
  const dynamoDb = getDynamoDbClient()
  const riskRepository = new RiskRepository(tenantId, { dynamoDb })
  const riskParameters = (await riskRepository.getParameterRiskItems()) || []

  console.info(`Migrating tenant ${tenantId}`)
  console.info(`Found ${riskParameters.length} risk parameters`)

  for (const riskParameter of riskParameters) {
    const defaultRiskLevel = (riskParameter as any).defaultRiskLevel
    const riskValue: RiskScoreValueLevel = {
      type: 'RISK_LEVEL',
      value: defaultRiskLevel,
    }

    const riskAssignmentValues = riskParameter.riskLevelAssignmentValues.map(
      (assignmentValue) => {
        return {
          ...assignmentValue,
          riskValue: {
            type: 'RISK_LEVEL' as const,
            value: (assignmentValue as any).riskLevel,
          },
        }
      }
    )

    console.info(
      `Migrating risk parameter ${riskParameter.parameter} with default risk level ${defaultRiskLevel}`
    )

    await riskRepository.createOrUpdateParameterRiskItem({
      ...riskParameter,
      riskLevelAssignmentValues: riskAssignmentValues,
      defaultValue: riskValue,
    })
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
