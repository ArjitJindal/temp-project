import { RiskFactorLogicGenerator, V2V8RiskFactor } from '../types'
import { RiskParameterValueMultiple } from '@/@types/openapi-internal/RiskParameterValueMultiple'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'

const USER_SEGMENT_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'userSegment',
  name: 'User segment',
  description: 'Risk based on consumer user segment',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  valueType: 'MULTIPLE',
  type: entityType,
  status: 'INACTIVE',
  isDerived: false,
  dataType: 'CONSUMER_USER_SEGMENT',
})
const BUSINESSUSER_SEGMENT_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'legalEntity.companyGeneralDetails.userSegment',
  name: 'User segment',
  description: 'Risk based on consumer user segment',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  valueType: 'MULTIPLE',
  type: entityType,
  status: 'INACTIVE',
  dataType: 'BUSINESS_USER_SEGMENT',
  isDerived: false,
})

export const CONSUMER_USER_SEGMENT_RISK_FACTOR =
  USER_SEGMENT_RISK_FACTOR('CONSUMER_USER')

export const BUSINESS_USER_SEGMENT_RISK_FACTOR =
  BUSINESSUSER_SEGMENT_RISK_FACTOR('BUSINESS')

export const consumerUserSegmentV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  return {
    logic: {
      and: [
        {
          in: [
            { var: 'CONSUMER_USER:userSegment__SENDER' },
            (parameterValue.content as RiskParameterValueMultiple).values.map(
              (val) => val.content
            ),
          ],
        },
      ],
    },
  }
}
export const businessUserSegmentV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  return {
    logic: {
      and: [
        {
          in: [
            {
              var: 'BUSINESS_USER:legalEntity-companyGeneralDetails-userSegment__SENDER',
            },
            (parameterValue.content as RiskParameterValueMultiple).values.map(
              (val) => val.content
            ),
          ],
        },
      ],
    },
  }
}
