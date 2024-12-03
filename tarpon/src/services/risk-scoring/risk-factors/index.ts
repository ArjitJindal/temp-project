import { getRiskLevelAndScore } from '../utils'
import {
  BUSINESS_TYPE_RISK_FACTOR,
  CONSUMER_TYPE_RISK_FACTOR,
  customerTypeV8Logic,
} from './customer-type'
import {
  RiskFactorLogicGenerator,
  RiskFactorMigrationEntry,
  V2V8RiskFactor,
  V8MigrationParameters,
} from './types'
import { RiskFactorLogic } from '@/@types/openapi-internal/RiskFactorLogic'
import { RiskFactorParameter } from '@/@types/openapi-internal/RiskFactorParameter'

//  We will use risk factors from this list to initialise in dynamoDB under the RiskFactors key
export const RISK_FACTORS: V2V8RiskFactor[] = [
  CONSUMER_TYPE_RISK_FACTOR,
  BUSINESS_TYPE_RISK_FACTOR,
]

function generateV8FactorMigrator(
  logicGenerator: RiskFactorLogicGenerator
): (parameters: V8MigrationParameters) => RiskFactorLogic[] {
  return (parameters: V8MigrationParameters) => {
    const {
      riskLevelAssignmentValues,
      riskClassificationValues,
      defaultWeight,
    } = parameters
    return riskLevelAssignmentValues.map((riskLevelAssignmentValue) => {
      const { riskLevel, riskScore } = getRiskLevelAndScore(
        riskLevelAssignmentValue.riskValue,
        riskClassificationValues
      )
      return {
        logic: logicGenerator(riskLevelAssignmentValue.parameterValue).logic,
        riskLevel,
        riskScore,
        weight: defaultWeight,
      }
    })
  }
}
// List of all risk factor parameters that have a migration
const RISK_FACTOR_MIGRATIONS: RiskFactorMigrationEntry[] = [
  {
    key: 'type',
    logicGenerator: customerTypeV8Logic,
  },
]

// Map of risk factor parameters to their migration logic
export const PARAMETER_MIGRATION_MAP: Record<
  Partial<RiskFactorParameter>,
  (parameters: V8MigrationParameters) => RiskFactorLogic[]
> = RISK_FACTOR_MIGRATIONS.reduce((acc, { key, logicGenerator }) => {
  acc[key] = generateV8FactorMigrator(logicGenerator)
  return acc
}, {} as Record<Partial<RiskFactorParameter>, (parameters: V8MigrationParameters) => RiskFactorLogic[]>)
