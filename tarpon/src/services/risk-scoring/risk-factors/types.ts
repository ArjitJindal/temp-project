import { Omit } from 'lodash'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'
import { RiskParameterLevelKeyValue } from '@/@types/openapi-internal/RiskParameterLevelKeyValue'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'
import { RiskFactorParameter } from '@/@types/openapi-internal/RiskFactorParameter'

export type V2V8RiskFactor = Omit<RiskFactor, 'id'>

export type V8MigrationParameters = {
  riskLevelAssignmentValues: RiskParameterLevelKeyValue[]
  riskClassificationValues: RiskClassificationScore[]
  defaultWeight: number
}

export type RiskFactorLogicGenerator = (parameterValue: RiskParameterValue) => {
  logic: any
}

export type RiskFactorMigrationEntry = {
  key: RiskFactorParameter
  logicGenerator: RiskFactorLogicGenerator
}
