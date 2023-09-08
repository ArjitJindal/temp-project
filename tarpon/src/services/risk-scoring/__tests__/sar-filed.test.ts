import { DEFAULT_CLASSIFICATION_SETTINGS } from '../repositories/risk-repository'
import { ParameterAttributeRiskValues } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { createArsRiskFactorTestCases } from '@/test-utils/pulse-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { getTestUser } from '@/test-utils/user-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { ReportRepository } from '@/services/sar/repositories/report-repository'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

withFeatureHook(['PULSE'])
dynamoDbSetupHook()

const RISK_FACTOR: ParameterAttributeRiskValues = {
  parameter: 'originUserSarFiled',
  isActive: true,
  isDerived: true,
  riskEntityType: 'TRANSACTION',
  riskLevelAssignmentValues: [
    {
      parameterValue: {
        content: {
          kind: 'LITERAL',
          content: true,
        },
      },
      riskLevel: 'HIGH',
    },
    {
      parameterValue: {
        content: {
          kind: 'LITERAL',
          content: false,
        },
      },
      riskLevel: 'VERY_LOW',
    },
  ],
  parameterType: 'VARIABLE',
  defaultRiskLevel: 'VERY_HIGH',
  isNullableAllowed: true,
}

createArsRiskFactorTestCases(
  'originUserSarFiled',
  DEFAULT_CLASSIFICATION_SETTINGS,
  RISK_FACTOR,
  [
    {
      testName: 'originUserSarFiled is true',
      transaction: getTestTransaction({
        originUserId: '1',
      }),
      expectedScore: 70,
      users: [
        getTestUser({
          userId: '1',
        }),
      ],
    },
  ],
  async (tenantId) => {
    const mongoDbClient = await getMongoDbClient()
    const reportRepository = new ReportRepository(tenantId, mongoDbClient)

    await reportRepository.saveOrUpdateReport({
      caseId: '1',
      caseUserId: '1',
      comments: [],
      createdAt: Date.now(),
      createdById: '1',
      description: '1',
      name: '1',
      parameters: {},
      reportTypeId: '1',
      revisions: [],
      status: 'draft',
      updatedAt: Date.now(),
    })
  }
)

createArsRiskFactorTestCases(
  'originUserSarFiled',
  DEFAULT_CLASSIFICATION_SETTINGS,
  RISK_FACTOR,
  [
    {
      testName: 'originUserSarFiled is false',
      transaction: getTestTransaction({
        originUserId: '2',
      }),
      expectedScore: 10,
      users: [
        getTestUser({
          userId: '2',
        }),
      ],
    },
  ],
  async (tenantId) => {
    const mongoDbClient = await getMongoDbClient()
    const reportRepository = new ReportRepository(tenantId, mongoDbClient)

    await reportRepository.saveOrUpdateReport({
      caseId: '1',
      caseUserId: '1',
      comments: [],
      createdAt: Date.now(),
      createdById: '1',
      description: '1',
      name: '1',
      parameters: {},
      reportTypeId: '1',
      revisions: [],
      status: 'draft',
      updatedAt: Date.now(),
    })
  }
)
