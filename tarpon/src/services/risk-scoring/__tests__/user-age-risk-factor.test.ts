import { DEFAULT_CLASSIFICATION_SETTINGS } from '../repositories/risk-repository'
import { DEFAULT_RISK_VALUE } from '../utils'
import dayjs from '@/utils/dayjs'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { getTestBusiness, getTestUser } from '@/test-utils/user-test-utils'
import {
  createArsRiskFactorTestCases,
  createKrsRiskFactorTestCases,
} from '@/test-utils/pulse-test-utils'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'

withFeatureHook(['RISK_LEVELS', 'RISK_SCORING'])
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

createKrsRiskFactorTestCases(
  'legalEntity.companyRegistrationDetails.dateOfRegistration',
  CLASSFICATIONS,
  {
    defaultValue: DEFAULT_RISK_VALUE,
    parameter: 'legalEntity.companyRegistrationDetails.dateOfRegistration',
    isActive: true,
    isDerived: true,
    riskEntityType: 'BUSINESS',
    riskLevelAssignmentValues: [
      {
        parameterValue: {
          content: {
            kind: 'RANGE',
            start: 0,
            end: 5,
          },
        },
        riskValue: {
          type: 'RISK_LEVEL',
          value: 'LOW',
        },
      },
      {
        parameterValue: {
          content: {
            kind: 'RANGE',
            start: 5,
            end: 10,
          },
        },
        riskValue: {
          type: 'RISK_LEVEL',
          value: 'HIGH',
        },
      },
    ],
    parameterType: 'VARIABLE',
    weight: 1,
  },
  [
    {
      testName: 'Low Risk',
      user: getTestBusiness({
        userId: '1',
        legalEntity: {
          companyGeneralDetails: { legalName: 'Test Business' },
          companyRegistrationDetails: {
            registrationIdentifier: '123',
            registrationCountry: 'DE',
            dateOfRegistration: `${dayjs().year() - 2}-01-01`,
          },
        },
      }),
      expectedScore: 25,
    },
    {
      testName: 'High Risk',
      user: getTestBusiness({
        userId: '1',
        legalEntity: {
          companyGeneralDetails: { legalName: 'Test Business' },
          companyRegistrationDetails: {
            registrationIdentifier: '123',
            registrationCountry: 'DE',
            dateOfRegistration: `${dayjs().year() - 7}-01-01`,
          },
        },
      }),
      expectedScore: 75,
    },
  ]
)

createKrsRiskFactorTestCases(
  'userDetails.dateOfBirth',
  CLASSFICATIONS,
  {
    parameter: 'userDetails.dateOfBirth',
    isActive: true,
    isDerived: true,
    riskEntityType: 'CONSUMER_USER',
    riskLevelAssignmentValues: [
      {
        parameterValue: {
          content: {
            kind: 'RANGE',
            start: 0,
            end: 5,
          },
        },
        riskValue: {
          type: 'RISK_LEVEL',
          value: 'LOW',
        },
      },
      {
        parameterValue: {
          content: {
            kind: 'RANGE',
            start: 5,
            end: 10,
          },
        },
        riskValue: {
          type: 'RISK_LEVEL',
          value: 'HIGH',
        },
      },
    ],
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  [
    {
      testName: 'Low Risk',
      user: getTestUser({
        userId: '1',
        userDetails: {
          name: { firstName: 'test' },
          dateOfBirth: `${dayjs().year() - 2}-01-01`,
        },
      }),
      expectedScore: 25,
    },
    {
      testName: 'High Risk',
      user: getTestUser({
        userId: '1',
        userDetails: {
          name: { firstName: 'test' },
          dateOfBirth: `${dayjs().year() - 8}-01-01`,
        },
      }),
      expectedScore: 75,
    },
  ]
)

createArsRiskFactorTestCases(
  'consumerCreatedTimestamp',
  DEFAULT_CLASSIFICATION_SETTINGS,
  {
    parameter: 'consumerCreatedTimestamp',
    isActive: true,
    isDerived: true,
    riskEntityType: 'TRANSACTION',
    riskLevelAssignmentValues: [
      {
        parameterValue: {
          content: {
            kind: 'DAY_RANGE',
            start: 0,
            end: 5,
            startGranularity: 'DAYS',
            endGranularity: 'MONTHS',
          },
        },
        riskValue: {
          type: 'RISK_LEVEL',
          value: 'LOW',
        },
      },
      {
        parameterValue: {
          content: {
            kind: 'DAY_RANGE',
            start: 5,
            end: 10,
            startGranularity: 'MONTHS',
            endGranularity: 'MONTHS',
          },
        },
        riskValue: {
          type: 'RISK_LEVEL',
          value: 'HIGH',
        },
      },
      {
        parameterValue: {
          content: {
            kind: 'DAY_RANGE',
            start: 10,
            end: 0,
            startGranularity: 'MONTHS',
            endGranularity: 'INFINITE',
          },
        },
        riskValue: {
          type: 'RISK_LEVEL',
          value: 'VERY_HIGH',
        },
      },
    ],
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  [
    {
      testName: 'Low Risk',
      users: [
        getTestUser({
          userId: '1',
          createdTimestamp: dayjs().subtract(1, 'day').valueOf(),
        }),
      ],
      transaction: {
        type: 'TRANSFER',
        transactionId: '1',
        timestamp: dayjs().valueOf(),
        originUserId: '1',
      },
      expectedScore: 30,
    },
    {
      testName: 'High Risk',
      users: [
        getTestUser({
          userId: '2',
          createdTimestamp: dayjs().subtract(6, 'month').valueOf(),
        }),
      ],
      transaction: {
        transactionId: '2',
        originUserId: '2',
        type: 'TRANSFER',
        timestamp: dayjs().valueOf(),
      },
      expectedScore: 70,
    },
    {
      testName: 'Very High Risk',
      users: [
        getTestUser({
          userId: '3',
          createdTimestamp: dayjs().subtract(11, 'month').valueOf(),
        }),
      ],
      transaction: {
        transactionId: '3',
        type: 'TRANSFER',
        timestamp: dayjs().valueOf(),
        originUserId: '3',
      },
      expectedScore: 90,
    },
  ]
)

createArsRiskFactorTestCases(
  'businessCreatedTimestamp',
  DEFAULT_CLASSIFICATION_SETTINGS,
  {
    parameter: 'businessCreatedTimestamp',
    isActive: true,
    isDerived: true,
    riskEntityType: 'TRANSACTION',
    riskLevelAssignmentValues: [
      {
        parameterValue: {
          content: {
            kind: 'DAY_RANGE',
            start: 0,
            end: 5,
            startGranularity: 'DAYS',
            endGranularity: 'MONTHS',
          },
        },
        riskValue: {
          type: 'RISK_LEVEL',
          value: 'LOW',
        },
      },
      {
        parameterValue: {
          content: {
            kind: 'DAY_RANGE',
            start: 5,
            end: 10,
            startGranularity: 'MONTHS',
            endGranularity: 'MONTHS',
          },
        },
        riskValue: {
          type: 'RISK_LEVEL',
          value: 'HIGH',
        },
      },
      {
        parameterValue: {
          content: {
            kind: 'DAY_RANGE',
            start: 10,
            end: 0,
            startGranularity: 'MONTHS',
            endGranularity: 'INFINITE',
          },
        },
        riskValue: {
          type: 'RISK_LEVEL',
          value: 'VERY_HIGH',
        },
      },
    ],
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  [
    {
      testName: 'Low Risk',
      users: [
        getTestBusiness({
          userId: '1',
          createdTimestamp: dayjs().subtract(1, 'day').valueOf(),
        }),
      ],
      transaction: {
        type: 'TRANSFER',
        transactionId: '1',
        timestamp: dayjs().valueOf(),
        originUserId: '1',
      },
      expectedScore: 30,
    },
    {
      testName: 'High Risk',
      users: [
        getTestBusiness({
          userId: '2',
          createdTimestamp: dayjs().subtract(6, 'month').valueOf(),
        }),
      ],
      transaction: {
        type: 'TRANSFER',
        transactionId: '2',
        originUserId: '2',
        timestamp: dayjs().valueOf(),
      },
      expectedScore: 70,
    },
    {
      testName: 'Very High Risk',
      users: [
        getTestBusiness({
          userId: '3',
          createdTimestamp: dayjs().subtract(11, 'month').valueOf(),
        }),
      ],
      transaction: {
        type: 'TRANSFER',
        transactionId: '3',
        timestamp: dayjs().valueOf(),
        originUserId: '3',
      },
      expectedScore: 90,
    },
  ]
)

createArsRiskFactorTestCases(
  'consumerCreatedTimestamp',
  DEFAULT_CLASSIFICATION_SETTINGS,
  {
    parameter: 'consumerCreatedTimestamp',
    isActive: true,
    isDerived: true,
    riskEntityType: 'TRANSACTION',
    riskLevelAssignmentValues: [
      {
        parameterValue: {
          content: {
            kind: 'DAY_RANGE',
            start: 0,
            end: 1,
            startGranularity: 'DAYS',
            endGranularity: 'DAYS',
          },
        },
        riskValue: {
          type: 'RISK_LEVEL',
          value: 'VERY_HIGH',
        },
      },
    ],
    parameterType: 'VARIABLE',
    defaultValue: {
      type: 'RISK_LEVEL',
      value: 'MEDIUM',
    },
    weight: 1,
  },
  [
    {
      testName: 'Very High Risk',
      users: [
        getTestUser({
          userId: '1-2-4',
          createdTimestamp: dayjs().subtract(5, 'minutes').valueOf(),
        }),
      ],
      transaction: {
        type: 'TRANSFER',
        transactionId: '1-2-4',
        timestamp: dayjs().valueOf(),
        originUserId: '1-2-4',
      },
      expectedScore: 90,
    },
  ]
)
