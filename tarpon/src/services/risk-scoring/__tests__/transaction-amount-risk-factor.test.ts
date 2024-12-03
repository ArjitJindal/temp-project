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
          kind: 'AMOUNT_RANGE',
          start: 10,
          end: 40,
          currency: 'USD',
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
          kind: 'AMOUNT_RANGE',
          start: 40,
          end: 60,
          currency: 'USD',
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
  'originAmountDetails.transactionAmount',
  DEFAULT_CLASSIFICATION_SETTINGS,
  RISK_FACTOR('originAmountDetails.transactionAmount'),
  [
    {
      testName: 'Card issued country is US',
      transaction: getTestTransaction({
        originAmountDetails: {
          transactionAmount: 11,
          transactionCurrency: 'USD',
        },
      }),
      users: [getTestUser()],
      expectedScore: 50,
    },
  ]
)

createArsRiskFactorTestCases(
  'originAmountDetails.transactionAmount',
  DEFAULT_CLASSIFICATION_SETTINGS,
  RISK_FACTOR('originAmountDetails.transactionAmount'),
  [
    {
      testName: 'Card issued country is DE',
      transaction: getTestTransaction({
        originAmountDetails: {
          transactionAmount: 18,
          transactionCurrency: 'USD',
        },
      }),
      users: [getTestUser()],
      expectedScore: 50,
    },
  ]
)

createArsRiskFactorTestCases(
  'originAmountDetails.transactionAmount',
  DEFAULT_CLASSIFICATION_SETTINGS,
  RISK_FACTOR('originAmountDetails.transactionAmount'),
  [
    {
      testName: 'Card issued Default Risk Level Test',
      transaction: getTestTransaction({
        originAmountDetails: {
          transactionAmount: 50,
          transactionCurrency: 'USD',
        },
      }),
      users: [getTestUser()],
      expectedScore: 10,
    },
  ]
)

createArsRiskFactorTestCases(
  'originAmountDetails.transactionAmount',
  DEFAULT_CLASSIFICATION_SETTINGS,
  RISK_FACTOR('originAmountDetails.transactionAmount'),
  [
    {
      testName: 'Card issued Default Risk Level Test',
      transaction: getTestTransaction({
        originAmountDetails: {
          transactionAmount: 200,
          transactionCurrency: 'USD',
        },
      }),
      users: [getTestUser()],
      expectedScore: 30,
    },
  ]
)
