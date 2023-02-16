import { migrateAllTenants } from '../utils/tenant'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'
import { Tenant } from '@/services/accounts'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { ParameterAttributeRiskValues } from '@/@types/openapi-internal/ParameterAttributeRiskValues'

async function migrateTenant(tenant: Tenant) {
  if (!(await tenantHasFeature(tenant.id, 'PULSE'))) {
    return
  }

  const { id: tenantId } = tenant
  const dynamoDb = getDynamoDbClient()
  const riskRepository = new RiskRepository(tenantId, { dynamoDb })
  const riskItems = (await riskRepository.getParameterRiskItem(
    'createdTimestamp',
    'TRANSACTION'
  )) as ParameterAttributeRiskValues

  if (!riskItems) {
    return
  }

  for (const riskItem of riskItems.riskLevelAssignmentValues) {
    if (riskItem.parameterValue.content.kind === 'DAY_RANGE') {
      return
    }
  }

  const riskItemsWithNewType: any = riskItems.riskLevelAssignmentValues
    .filter((x) => x.parameterValue.content.kind === 'DAY_RANGE')
    .map((x: any) => {
      return {
        ...x,
        parameterValue: {
          ...x.parameterValue,
          content: {
            ...x.parameterValue.content,
            kind: 'DAY_RANGE',
            start: x.parameterValue.content.start,
            end: x.parameterValue.content.end,
            startGranularity: 'DAY',
            endGranularity: 'DAY',
          },
        },
      }
    })

  const newRiskItems = {
    ...riskItems,
    riskLevelAssignmentValues: riskItemsWithNewType,
  } as unknown as ParameterAttributeRiskValues

  await riskRepository.createOrUpdateParameterRiskItem(newRiskItems)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
