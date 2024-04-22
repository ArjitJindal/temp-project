import { v4 as uuidv4 } from 'uuid'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '../repositories/risk-repository'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { getTestUser } from '@/test-utils/user-test-utils'
import { createArsRiskFactorTestCases } from '@/test-utils/pulse-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  ParameterAttributeRiskValues,
  ParameterAttributeRiskValuesParameterEnum,
} from '@/@types/openapi-internal/ParameterAttributeRiskValues'

withFeatureHook(['RISK_SCORING', 'RISK_LEVELS'])
dynamoDbSetupHook()

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
  defaultValue: {
    type: 'RISK_LEVEL',
    value: 'LOW',
  },
  weight: 1,
})

createArsRiskFactorTestCases(
  'cardIssuedCountry',
  DEFAULT_CLASSIFICATION_SETTINGS,
  RISK_FACTOR('cardIssuedCountry'),
  [
    {
      testName: 'Card issued country is US',
      transaction: getTestTransaction({
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: uuidv4(),
          cardIssuedCountry: 'US',
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
  'cardIssuedCountry',
  DEFAULT_CLASSIFICATION_SETTINGS,
  RISK_FACTOR('cardIssuedCountry'),
  [
    {
      testName: 'Card issued country is DE',
      transaction: getTestTransaction({
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: uuidv4(),
          cardIssuedCountry: 'DE',
          transactionReferenceField: 'DEPOSIT',
          '3dsDone': true,
        },
      }),
      users: [getTestUser()],
      expectedScore: 10,
    },
  ]
)

createArsRiskFactorTestCases(
  'cardIssuedCountry',
  DEFAULT_CLASSIFICATION_SETTINGS,
  RISK_FACTOR('cardIssuedCountry'),
  [
    {
      testName: 'Card issued Default Risk Level Test',
      transaction: getTestTransaction({
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: uuidv4(),
          cardIssuedCountry: 'FR',
          transactionReferenceField: 'DEPOSIT',
          '3dsDone': true,
        },
      }),
      users: [getTestUser()],
      expectedScore: 30,
    },
  ]
)
