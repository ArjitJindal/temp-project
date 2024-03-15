import { DEFAULT_CLASSIFICATION_SETTINGS } from '../repositories/risk-repository'
import { DEFAULT_RISK_LEVEL } from '../utils'

import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { getTestUser } from '@/test-utils/user-test-utils'
import { createArsRiskFactorTestCases } from '@/test-utils/pulse-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  ParameterAttributeRiskValues,
  ParameterAttributeRiskValuesParameterEnum,
} from '@/@types/openapi-internal/ParameterAttributeRiskValues'

withFeatureHook(['RISK_LEVELS', 'RISK_SCORING'])

const RISK_FACTOR: (
  parameter: ParameterAttributeRiskValuesParameterEnum
) => ParameterAttributeRiskValues = (parameter) => ({
  parameter,
  isActive: true,
  isDerived: true,
  riskEntityType: 'TRANSACTION',
  riskLevelAssignmentValues: [
    {
      parameterValue: {
        content: {
          kind: 'MULTIPLE',
          values: [
            { kind: 'LITERAL', content: 'US' },
            { kind: 'LITERAL', content: 'IN' },
          ],
        },
      },
      riskLevel: 'MEDIUM',
    },
    {
      parameterValue: {
        content: {
          kind: 'MULTIPLE',
          values: [
            { kind: 'LITERAL', content: 'DE' },
            { kind: 'LITERAL', content: 'CA' },
          ],
        },
      },
      riskLevel: 'VERY_LOW',
    },
  ],
  parameterType: 'VARIABLE',
  defaultRiskLevel: DEFAULT_RISK_LEVEL,
  weight: 1,
})

createArsRiskFactorTestCases(
  'ipAddressCountry',
  DEFAULT_CLASSIFICATION_SETTINGS,
  RISK_FACTOR('ipAddressCountry'),
  [
    {
      testName: 'IP address country is US',
      transaction: getTestTransaction({
        originDeviceData: {
          ipAddress: '69.162.81.155',
        },
      }),
      users: [getTestUser()],
      expectedScore: 50,
    },
  ]
)

createArsRiskFactorTestCases(
  'ipAddressCountry',
  DEFAULT_CLASSIFICATION_SETTINGS,
  RISK_FACTOR('ipAddressCountry'),
  [
    {
      testName: 'IP address country is DE',
      transaction: getTestTransaction({
        originDeviceData: {
          ipAddress: '101.33.10.0',
        },
      }),
      users: [getTestUser()],
      expectedScore: 10,
    },
  ]
)
