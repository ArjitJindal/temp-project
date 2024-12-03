import { v4 as uuidv4 } from 'uuid'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '../repositories/risk-repository'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { getTestUser } from '@/test-utils/user-test-utils'
import { createArsRiskFactorTestCases } from '@/test-utils/pulse-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { ParameterAttributeRiskValues } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { RiskFactorParameter } from '@/@types/openapi-internal/RiskFactorParameter'

withFeatureHook(['RISK_SCORING', 'RISK_LEVELS'])
dynamoDbSetupHook()

const RISK_FACTOR: (
  parameter: RiskFactorParameter
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
            { kind: 'LITERAL', content: 'MD123' },
            { kind: 'LITERAL', content: 'MC12' },
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
            { kind: 'LITERAL', content: 'DE123' },
            { kind: 'LITERAL', content: 'CAG' },
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
  defaultValue: {
    type: 'RISK_LEVEL',
    value: 'LOW',
  },
  weight: 1,
})

createArsRiskFactorTestCases(
  'originMccCode',
  DEFAULT_CLASSIFICATION_SETTINGS,
  RISK_FACTOR('originMccCode'),
  [
    {
      testName: 'MCC Code Test',
      transaction: getTestTransaction({
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: uuidv4(),
          cardIssuedCountry: 'US',
          merchantDetails: {
            MCC: 'MD123',
          },
          transactionReferenceField: 'DEPOSIT',
          '3dsDone': true,
        },
      }),
      users: [getTestUser()],
      expectedScore: 50,
    },
  ]
)

createArsRiskFactorTestCases(
  'destinationMccCode',
  DEFAULT_CLASSIFICATION_SETTINGS,
  RISK_FACTOR('destinationMccCode'),
  [
    {
      testName: 'MCC Code Test',
      transaction: getTestTransaction({
        destinationPaymentDetails: {
          method: 'CARD',
          cardFingerprint: uuidv4(),
          cardIssuedCountry: 'DE',
          merchantDetails: {
            MCC: 'DE123',
          },
          transactionReferenceField: 'DEPOSIT',
          '3dsDone': true,
        },
      }),
      users: [getTestUser()],
      expectedScore: 10,
    },
  ]
)
