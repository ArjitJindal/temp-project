import dayjs from 'dayjs'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { getTestBusiness, getTestUser } from '@/test-utils/user-test-utils'
import { createKrsRiskFactorTestCases } from '@/test-utils/pulse-test-utils'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'

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

createKrsRiskFactorTestCases(
  'legalEntity.companyRegistrationDetails.dateOfRegistration',
  CLASSFICATIONS,
  {
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
        riskLevel: 'LOW',
      },
      {
        parameterValue: {
          content: {
            kind: 'RANGE',
            start: 5,
            end: 10,
          },
        },
        riskLevel: 'HIGH',
      },
    ],
    parameterType: 'VARIABLE',
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
        riskLevel: 'LOW',
      },
      {
        parameterValue: {
          content: {
            kind: 'RANGE',
            start: 5,
            end: 10,
          },
        },
        riskLevel: 'HIGH',
      },
    ],
    parameterType: 'VARIABLE',
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
