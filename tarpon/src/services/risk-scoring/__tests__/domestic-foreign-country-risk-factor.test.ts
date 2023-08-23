import { DEFAULT_RISK_LEVEL } from '../utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { getTestBusiness, getTestUser } from '@/test-utils/user-test-utils'
import { createArsRiskFactorTestCases } from '@/test-utils/pulse-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import {
  ParameterAttributeRiskValues,
  ParameterAttributeRiskValuesParameterEnum,
} from '@/@types/openapi-internal/ParameterAttributeRiskValues'

withFeatureHook(['PULSE'])
dynamoDbSetupHook()

const CLASSFICATIONS: RiskClassificationScore[] = [
  {
    riskLevel: 'LOW',
    lowerBoundRiskScore: 0,
    upperBoundRiskScore: 50,
  },
  {
    riskLevel: 'HIGH',
    lowerBoundRiskScore: 50,
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
          kind: 'MULTIPLE',
          values: [{ kind: 'LITERAL', content: 'DOMESTIC' }],
        },
      },
      riskLevel: 'LOW',
    },
    {
      parameterValue: {
        content: {
          kind: 'MULTIPLE',
          values: [{ kind: 'LITERAL', content: 'FOREIGN' }],
        },
      },
      riskLevel: 'HIGH',
    },
  ],
  parameterType: 'VARIABLE',
  defaultRiskLevel: DEFAULT_RISK_LEVEL,
})

createArsRiskFactorTestCases(
  'domesticOrForeignOriginCountryConsumer',
  CLASSFICATIONS,
  RISK_FACTOR('domesticOrForeignOriginCountryConsumer'),
  [
    {
      testName: 'Low Risk',
      transaction: getTestTransaction({
        originUserId: '1',
        destinationUserId: '2',
        originAmountDetails: {
          transactionCurrency: 'EUR',
          transactionAmount: 100,
          country: 'DE',
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
      expectedScore: 25,
    },
    {
      testName: 'High Risk',
      transaction: getTestTransaction({
        originUserId: '1',
        destinationUserId: '2',
        originAmountDetails: {
          transactionCurrency: 'EUR',
          transactionAmount: 100,
          country: 'DE',
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
      expectedScore: 75,
    },
  ]
)

createArsRiskFactorTestCases(
  'domesticOrForeignDestinationCountryConsumer',
  CLASSFICATIONS,
  RISK_FACTOR('domesticOrForeignDestinationCountryConsumer'),
  [
    {
      testName: 'Low Risk',
      transaction: getTestTransaction({
        originUserId: '1',
        destinationUserId: '2',
        destinationAmountDetails: {
          transactionCurrency: 'EUR',
          transactionAmount: 100,
          country: 'DE',
        },
      }),
      users: [
        getTestUser({
          userId: '2',
          userDetails: {
            name: { firstName: 'test' },
            countryOfResidence: 'DE',
          },
        }),
      ],
      expectedScore: 25,
    },
    {
      testName: 'High Risk',
      transaction: getTestTransaction({
        originUserId: '1',
        destinationUserId: '2',
        destinationAmountDetails: {
          transactionCurrency: 'EUR',
          transactionAmount: 100,
          country: 'DE',
        },
      }),
      users: [
        getTestUser({
          userId: '2',
          userDetails: {
            name: { firstName: 'test' },
            countryOfResidence: 'TW',
          },
        }),
      ],
      expectedScore: 75,
    },
  ]
)

createArsRiskFactorTestCases(
  'domesticOrForeignOriginCountryBusiness',
  CLASSFICATIONS,
  RISK_FACTOR('domesticOrForeignOriginCountryBusiness'),
  [
    {
      testName: 'Low Risk',
      transaction: getTestTransaction({
        originUserId: '1',
        destinationUserId: '2',
        originAmountDetails: {
          transactionCurrency: 'EUR',
          transactionAmount: 100,
          country: 'DE',
        },
      }),
      users: [
        getTestBusiness({
          userId: '1',
          legalEntity: {
            companyGeneralDetails: { legalName: 'Test Business' },
            companyRegistrationDetails: {
              registrationIdentifier: '123',
              registrationCountry: 'DE',
            },
          },
        }),
      ],
      expectedScore: 25,
    },
    {
      testName: 'High Risk',
      transaction: getTestTransaction({
        originUserId: '1',
        destinationUserId: '2',
        originAmountDetails: {
          transactionCurrency: 'EUR',
          transactionAmount: 100,
          country: 'DE',
        },
      }),
      users: [
        getTestBusiness({
          userId: '1',
          legalEntity: {
            companyGeneralDetails: { legalName: 'Test Business' },
            companyRegistrationDetails: {
              registrationIdentifier: '123',
              registrationCountry: 'TW',
            },
          },
        }),
      ],
      expectedScore: 75,
    },
  ]
)

createArsRiskFactorTestCases(
  'domesticOrForeignDestinationCountryBusiness',
  CLASSFICATIONS,
  RISK_FACTOR('domesticOrForeignDestinationCountryBusiness'),
  [
    {
      testName: 'Low Risk',
      transaction: getTestTransaction({
        originUserId: '1',
        destinationUserId: '2',
        destinationAmountDetails: {
          transactionCurrency: 'EUR',
          transactionAmount: 100,
          country: 'DE',
        },
      }),
      users: [
        getTestBusiness({
          userId: '2',
          legalEntity: {
            companyGeneralDetails: { legalName: 'Test Business' },
            companyRegistrationDetails: {
              registrationIdentifier: '123',
              registrationCountry: 'DE',
            },
          },
        }),
      ],
      expectedScore: 25,
    },
    {
      testName: 'High Risk',
      transaction: getTestTransaction({
        originUserId: '1',
        destinationUserId: '2',
        destinationAmountDetails: {
          transactionCurrency: 'EUR',
          transactionAmount: 100,
          country: 'DE',
        },
      }),
      users: [
        getTestBusiness({
          userId: '2',
          legalEntity: {
            companyGeneralDetails: { legalName: 'Test Business' },
            companyRegistrationDetails: {
              registrationIdentifier: '123',
              registrationCountry: 'TW',
            },
          },
        }),
      ],
      expectedScore: 75,
    },
  ]
)
