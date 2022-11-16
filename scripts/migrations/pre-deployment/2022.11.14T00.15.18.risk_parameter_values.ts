import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/lambdas/console-api-account/services/accounts-service'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'
import { ParameterAttributeRiskValuesParameterEnum } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { RiskLevel } from '@/@types/openapi-public/RiskLevel'

const PARAMS_NEW_TYPE: {
  [key in ParameterAttributeRiskValuesParameterEnum]: RiskParameterValue['content']['kind']
} = {
  'userDetails.countryOfResidence': 'MULTIPLE',
  'userDetails.countryOfNationality': 'MULTIPLE',
  'originPaymentDetails.method': 'MULTIPLE',
  'destinationPaymentDetails.method': 'MULTIPLE',
  'originAmountDetails.country': 'MULTIPLE',
  'destinationAmountDetails.country': 'MULTIPLE',
  'originAmountDetails.transactionCurrency': 'MULTIPLE',
  'destinationAmountDetails.transactionCurrency': 'MULTIPLE',
  ipAddressCountry: 'MULTIPLE',
  type: 'MULTIPLE',
  'legalEntity.companyRegistrationDetails.registrationCountry': 'MULTIPLE',
  shareHolders: 'MULTIPLE',
  directors: 'MULTIPLE',
  'legalEntity.companyGeneralDetails.businessIndustry': 'LITERAL',
  'userDetails.dateOfBirth': 'RANGE',
  'legalEntity.companyRegistrationDetails.dateOfRegistration': 'RANGE',
  createdTimestamp: 'RANGE',
}

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const riskRepository = new RiskRepository(tenant.id, {
    dynamoDb: dynamoDb,
  })
  const items = await riskRepository.getParameterRiskItems()
  for (const x of items ?? []) {
    const newType = PARAMS_NEW_TYPE[x.parameter]
    await riskRepository.createOrUpdateParameterRiskItem({
      ...x,
      riskLevelAssignmentValues: x.riskLevelAssignmentValues.map((item) => {
        const parameterValue = item.parameterValue as unknown
        let newValue: RiskParameterValue['content']
        if (typeof parameterValue === 'string') {
          if (newType === 'MULTIPLE') {
            newValue = {
              kind: 'MULTIPLE',
              values: parameterValue.split(',').map((x) => ({
                kind: 'LITERAL',
                content: x,
              })),
            }
          } else if (newType === 'RANGE') {
            const [startStr, endStr] = parameterValue.split(',')
            newValue = {
              kind: 'RANGE',
              start: parseInt(startStr) || undefined,
              end: parseInt(endStr) || undefined,
            }
          } else {
            newValue = {
              kind: 'LITERAL',
              content: parameterValue,
            }
          }
          return {
            ...item,
            parameterValue: {
              content: newValue,
            },
          }
        }
        return item
      }),
    })
  }
}

async function migrateTenantDown(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const riskRepository = new RiskRepository(tenant.id, {
    dynamoDb: dynamoDb,
  })
  const items = await riskRepository.getParameterRiskItems()
  for (const x of items ?? []) {
    const oldValues: {
      parameterValue: string
      riskLevel: RiskLevel
    }[] = []
    for (const { parameterValue, riskLevel } of x.riskLevelAssignmentValues) {
      const parameterValueContent = parameterValue.content
      if (parameterValueContent.kind === 'MULTIPLE') {
        oldValues.push(
          ...parameterValueContent.values.map((x) => ({
            riskLevel,
            parameterValue: `${x.content}`,
          }))
        )
      } else if (parameterValueContent.kind === 'RANGE') {
        oldValues.push({
          riskLevel,
          parameterValue: [
            parameterValueContent.start ?? 0,
            parameterValueContent.end ?? 0,
          ].join(','),
        })
      } else if (parameterValueContent.kind === 'LITERAL') {
        oldValues.push({
          riskLevel,
          parameterValue: `${parameterValueContent.content}`,
        })
      }
    }
    await riskRepository.createOrUpdateParameterRiskItem({
      ...x,
      riskLevelAssignmentValues: oldValues.map((x) => ({
        riskLevel: x.riskLevel,
        parameterValue: x.parameterValue as unknown as RiskParameterValue,
      })),
    })
  }
}

export const up = async () => {
  await migrateAllTenants((tenant) => migrateTenant(tenant))
}
export const down = async () => {
  await migrateAllTenants((tenant) => migrateTenantDown(tenant))
}
