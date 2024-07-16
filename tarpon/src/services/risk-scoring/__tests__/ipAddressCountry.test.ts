import { DEFAULT_CLASSIFICATION_SETTINGS } from '../repositories/risk-repository'
import { DEFAULT_RISK_VALUE } from '../utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { getTestUser } from '@/test-utils/user-test-utils'
import { createArsRiskFactorTestCases } from '@/test-utils/pulse-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  ParameterAttributeRiskValues,
  ParameterAttributeRiskValuesParameterEnum,
} from '@/@types/openapi-internal/ParameterAttributeRiskValues'

withFeatureHook(['RISK_LEVELS', 'RISK_SCORING'])
dynamoDbSetupHook()

const TEST_IP_LOOKUPS = {
  '69.162.81.155': 'US',
  '101.33.10.0': 'DE',
}

jest.mock('@/services/rules-engine/utils/geoip', () => {
  return {
    lookupIpLocation: jest.fn().mockImplementation((ip: string) => {
      return { country: TEST_IP_LOOKUPS[ip] }
    }),
  }
})

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
      riskValue: {
        type: 'RISK_LEVEL',
        value: 'MEDIUM',
      },
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
      riskValue: {
        type: 'RISK_LEVEL',
        value: 'VERY_LOW',
      },
    },
  ],
  parameterType: 'VARIABLE',
  defaultValue: DEFAULT_RISK_VALUE,
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
