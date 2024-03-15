import { DEFAULT_RISK_LEVEL } from '../utils'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'

import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { createKrsRiskFactorTestCases } from '@/test-utils/pulse-test-utils'
import { getTestBusiness, getTestUser } from '@/test-utils/user-test-utils'

withFeatureHook(['RISK_LEVELS', 'RISK_SCORING'])

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
  'type',
  CLASSFICATIONS,
  {
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
    weight: 1,
    parameter: 'type',
    isActive: true,
    isDerived: true,
    riskEntityType: 'CONSUMER_USER',
    riskLevelAssignmentValues: [
      {
        parameterValue: {
          content: {
            kind: 'LITERAL',
            content: 'CONSUMER',
          },
        },
        riskLevel: 'LOW',
      },
    ],
    parameterType: 'VARIABLE',
  },
  [
    {
      testName: 'Low Risk',
      user: getTestUser({
        userId: '1',
      }),
      expectedScore: 25,
    },
    {
      testName: 'Business Risk',
      user: getTestBusiness({
        userId: '4',
      }),
      expectedScore: 75, // no components hence default to HIGHEST_RISK
    },
  ]
)

createKrsRiskFactorTestCases(
  'type',
  CLASSFICATIONS,
  {
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
    weight: 1,
    parameter: 'type',
    isActive: true,
    isDerived: true,
    riskEntityType: 'BUSINESS',
    riskLevelAssignmentValues: [
      {
        parameterValue: {
          content: {
            kind: 'LITERAL',
            content: 'BUSINESS',
          },
        },
        riskLevel: 'LOW',
      },
    ],
    parameterType: 'VARIABLE',
  },
  [
    {
      testName: 'Low Risk',
      user: getTestUser({
        userId: '1',
      }),
      expectedScore: 75, // no components hence default to HIGHEST_RISK
    },
    {
      testName: 'Business Risk',
      user: getTestBusiness({
        userId: '4',
      }),
      expectedScore: 25,
    },
  ]
)
