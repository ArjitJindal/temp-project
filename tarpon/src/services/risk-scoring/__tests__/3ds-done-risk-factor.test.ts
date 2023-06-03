import { v4 as uuidv4 } from 'uuid'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { getTestUser } from '@/test-utils/user-test-utils'
import { createArsRiskFactorTestCases } from '@/test-utils/pulse-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import {
  ParameterAttributeRiskValues,
  ParameterAttributeRiskValuesParameterEnum,
} from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import dayjs from '@/utils/dayjs'

withFeatureHook(['PULSE'])
dynamoDbSetupHook()

const CLASSFICATIONS: RiskClassificationScore[] = [
  {
    riskLevel: 'VERY_LOW',
    lowerBoundRiskScore: 0,
    upperBoundRiskScore: 20,
  },
  {
    riskLevel: 'LOW',
    lowerBoundRiskScore: 20,
    upperBoundRiskScore: 40,
  },
  {
    riskLevel: 'MEDIUM',
    lowerBoundRiskScore: 40,
    upperBoundRiskScore: 60,
  },
  {
    riskLevel: 'HIGH',
    lowerBoundRiskScore: 60,
    upperBoundRiskScore: 80,
  },
  {
    riskLevel: 'VERY_HIGH',
    lowerBoundRiskScore: 80,
    upperBoundRiskScore: 100,
  },
]

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
          kind: 'LITERAL',
          content: undefined,
        },
      },
      riskLevel: 'MEDIUM',
    },
    {
      parameterValue: {
        content: {
          kind: 'LITERAL',
          content: true,
        },
      },
      riskLevel: 'VERY_LOW',
    },
    {
      parameterValue: {
        content: {
          kind: 'LITERAL',
          content: false,
        },
      },
      riskLevel: 'VERY_HIGH',
    },
  ],
  parameterType: 'VARIABLE',
  isNullableAllowed: true,
})

createArsRiskFactorTestCases(
  '_3dsDone',
  CLASSFICATIONS,
  RISK_FACTOR('_3dsDone'),
  [
    {
      testName: '3dsDone is true',
      transaction: getTestTransaction({
        originUserId: '1',
        destinationUserId: '2',
        originAmountDetails: {
          transactionCurrency: 'EUR',
          transactionAmount: 100,
          country: 'DE',
        },
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: uuidv4(),
          cardIssuedCountry: 'US',
          transactionReferenceField: 'DEPOSIT',
          '3dsDone': true,
        },
      }),
      users: [
        getTestUser({
          userId: '1',
          userDetails: {
            name: { firstName: 'test' },
            countryOfResidence: 'DE',
          },
        }),
      ],
      expectedScore: 10,
    },
  ]
)

createArsRiskFactorTestCases(
  '_3dsDone',
  CLASSFICATIONS,
  RISK_FACTOR('_3dsDone'),
  [
    {
      testName: '3dsDone is false',
      transaction: getTestTransaction({
        originUserId: '1',
        destinationUserId: '2',
        originAmountDetails: {
          transactionCurrency: 'EUR',
          transactionAmount: 100,
          country: 'DE',
        },
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: uuidv4(),
          cardIssuedCountry: 'US',
          transactionReferenceField: 'DEPOSIT',
          '3dsDone': false,
        },
      }),
      users: [
        getTestUser({
          userId: '1',
          userDetails: {
            name: { firstName: 'test' },
            countryOfResidence: 'TW',
          },
        }),
      ],
      expectedScore: 90,
    },
  ]
)

createArsRiskFactorTestCases(
  '_3dsDone',
  CLASSFICATIONS,
  RISK_FACTOR('_3dsDone'),
  [
    {
      testName: '3dsDone is undefined',
      transaction: {
        transactionId: uuidv4(),
        transactionState: 'SUCCESSFUL',
        originUserId: '8650a2611d0771cba03310f74bf6',
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        timestamp: dayjs().valueOf(),
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: uuidv4(),
          cardIssuedCountry: 'US',
          transactionReferenceField: 'DEPOSIT',
        },
      },
      users: [
        getTestUser({
          userId: '1',
          userDetails: {
            name: { firstName: 'test' },
            countryOfResidence: 'TW',
          },
        }),
      ],
      expectedScore: 50,
    },
  ]
)
