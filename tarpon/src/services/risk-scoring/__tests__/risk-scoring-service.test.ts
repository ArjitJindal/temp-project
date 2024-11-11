import { v4 as uuid4 } from 'uuid'
import { RiskScoringService } from '..'
import {
  DEFAULT_CLASSIFICATION_SETTINGS,
  RiskRepository,
} from '../repositories/risk-repository'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestUser, setUpUsersHooks } from '@/test-utils/user-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import {
  TEST_ITERABLE_RISK_ITEM,
  TEST_TRANSACTION_RISK_PARAMETERS,
  TEST_VARIABLE_RISK_ITEM,
} from '@/test-utils/pulse-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { ParameterAttributeRiskValues } from '@/@types/openapi-internal/ParameterAttributeRiskValues'

const dynamoDb = getDynamoDbClient()
withFeatureHook(['RISK_LEVELS', 'RISK_SCORING'])
dynamoDbSetupHook()
const testUser1 = getTestUser({ userId: '1' })
const testUser2 = getTestUser({ userId: '2' })
const testTenantId = getTestTenantId()

setUpUsersHooks(testTenantId, [testUser1, testUser2])

const getRiskRepository = async (tenantId = testTenantId) => {
  const mongoDb = await getMongoDbClient()
  return new RiskRepository(tenantId, {
    dynamoDb,
    mongoDb,
  })
}

describe('Risk Scoring', () => {
  describe('Risk Scoring Tests', () => {
    it('should update inital the risk score of a user', async () => {
      const mongoDb = await getMongoDbClient()
      const riskScoringService = new RiskScoringService(testTenantId, {
        dynamoDb,
        mongoDb,
      })
      await riskScoringService.updateInitialRiskScores(testUser1)

      const getRiskScore = await (
        await getRiskRepository()
      ).getDrsScore(testUser1.userId)

      expect(getRiskScore).toEqual(
        expect.objectContaining({
          createdAt: expect.any(Number),
          isUpdatable: true,
          drsScore: 90,
          userId: testUser1.userId,
          transactionId: 'FIRST_DRS',
        })
      )
    })
  })
  it('should update the risk score of a user', async () => {
    await (
      await getRiskRepository()
    ).createOrUpdateDrsScore(testUser1.userId, 70, 'TEST_DRS', [])

    const getRiskScore = await (
      await getRiskRepository()
    ).getDrsScore(testUser1.userId)

    expect(getRiskScore).toEqual(
      expect.objectContaining({
        createdAt: expect.any(Number),
        isUpdatable: true,
        drsScore: 70,
        userId: testUser1.userId,
        transactionId: 'TEST_DRS',
      })
    )
  })

  it('should not update drs score when is updatable is false', async () => {
    await (
      await getRiskRepository()
    ).createOrUpdateManualDRSRiskItem(testUser1.userId, 'VERY_LOW', false)

    const testTransaction1 = getTestTransaction({
      originUserId: testUser1.userId,
      destinationUserId: testUser2.userId,
      originAmountDetails: {
        country: 'IN',
        transactionAmount: 10000000,
        transactionCurrency: 'INR',
      },
    })

    await (
      await getRiskRepository()
    ).createOrUpdateParameterRiskItem(TEST_VARIABLE_RISK_ITEM)

    const mongoDb = await getMongoDbClient()
    const riskScoringService = new RiskScoringService(testTenantId, {
      dynamoDb,
      mongoDb,
    })
    await riskScoringService.updateDynamicRiskScores(testTransaction1)

    const getRiskScore = await (
      await getRiskRepository()
    ).getDrsScore(testUser1.userId)

    expect(getRiskScore).toEqual(
      expect.objectContaining({
        manualRiskLevel: 'VERY_LOW',
        isUpdatable: false,
        drsScore: 10,
      })
    )
  })
  it('VARIABLE risk factor', async () => {
    const mongoDb = await getMongoDbClient()
    const riskScoringService = new RiskScoringService(testTenantId, {
      dynamoDb,
      mongoDb,
    })
    const testTransaction = getTestTransaction({
      originUserId: testUser1.userId,
      destinationUserId: testUser2.userId,
      originAmountDetails: {
        country: 'IN',
        transactionAmount: 10000000,
        transactionCurrency: 'INR',
      },
    })
    await (
      await getRiskRepository()
    ).createOrUpdateParameterRiskItem(TEST_VARIABLE_RISK_ITEM)
    await riskScoringService.updateDynamicRiskScores(testTransaction)

    const arsScore = await (
      await getRiskRepository()
    ).getArsScore(testTransaction.transactionId)

    expect(arsScore).toEqual(
      expect.objectContaining({
        arsScore: 50,
        originUserId: testUser1.userId,
        destinationUserId: testUser2.userId,
      })
    )
  })

  it('ITERABLE risk factor', async () => {
    const mongoDb = await getMongoDbClient()
    const riskScoringService = new RiskScoringService(testTenantId, {
      dynamoDb,
      mongoDb,
    })
    const testTransaction = getTestTransaction({
      originUserId: testUser1.userId,
      destinationUserId: testUser2.userId,
      originAmountDetails: {
        country: 'IN',
        transactionAmount: 10000000,
        transactionCurrency: 'INR',
      },
    })
    await (
      await getRiskRepository()
    ).createOrUpdateParameterRiskItem(TEST_ITERABLE_RISK_ITEM)
    await riskScoringService.updateDynamicRiskScores(testTransaction)

    const arsScore = await (
      await getRiskRepository()
    ).getArsScore(testTransaction.transactionId)

    expect(arsScore).toEqual(
      expect.objectContaining({
        arsScore: 70,
        originUserId: testUser1.userId,
        destinationUserId: testUser2.userId,
      })
    )
  })
})

describe('Risk Scoring Service ARS ', () => {
  beforeAll(async () => {
    const riskRepository = await getRiskRepository()
    await riskRepository.deleteParameterRiskItem(
      TEST_ITERABLE_RISK_ITEM.parameter,
      TEST_ITERABLE_RISK_ITEM.riskEntityType
    )
    await riskRepository.deleteParameterRiskItem(
      TEST_VARIABLE_RISK_ITEM.parameter,
      TEST_VARIABLE_RISK_ITEM.riskEntityType
    )
  })

  describe.each(TEST_TRANSACTION_RISK_PARAMETERS)(
    `testing parameters`,
    (parameter) => {
      const testTransaction = getTestTransaction({
        originUserId: testUser1.userId,
        destinationUserId: testUser2.userId,
        originAmountDetails: {
          country: 'IN',
          transactionAmount: 10000000,
          transactionCurrency: 'INR',
        },
        destinationAmountDetails: {
          country: 'IN',
          transactionAmount: 10000000,
          transactionCurrency: 'INR',
        },
        originDeviceData: {
          ipAddress: '69.162.81.155',
        },
        destinationDeviceData: {
          ipAddress: '69.162.81.155',
        },
      })
      test(`checking the ${parameter.parameter}`, async () => {
        const mongoDb = await getMongoDbClient()
        const riskScoringService = new RiskScoringService(testTenantId, {
          dynamoDb,
          mongoDb,
        })
        await (
          await getRiskRepository()
        ).createOrUpdateParameterRiskItem(parameter)
        await riskScoringService.updateDynamicRiskScores(testTransaction)

        const arsScore = await (
          await getRiskRepository()
        ).getArsScore(testTransaction.transactionId)
        expect(arsScore?.arsScore).toEqual(50)
      })
    }
  )
})

const TEST_PARAMETERS: ParameterAttributeRiskValues[] = [
  {
    parameterType: 'VARIABLE',
    isDerived: false,
    riskLevelAssignmentValues: [
      {
        parameterValue: {
          content: {
            kind: 'MULTIPLE',
            values: [
              {
                kind: 'LITERAL',
                content: 'REGISTERED',
              },
            ],
          },
        },
        riskValue: {
          type: 'RISK_LEVEL',
          value: 'LOW',
        },
      },
    ],
    parameter: 'legalEntity.companyGeneralDetails.userRegistrationStatus',
    isActive: true,
    riskEntityType: 'BUSINESS',
    weight: 0.5,
    defaultValue: {
      type: 'RISK_LEVEL',
      value: 'VERY_HIGH',
    },
  },
  {
    parameterType: 'VARIABLE',
    isDerived: false,
    riskLevelAssignmentValues: [
      {
        parameterValue: {
          content: {
            kind: 'MULTIPLE',
            values: [
              {
                kind: 'LITERAL',
                content: 'RETAIL',
              },
            ],
          },
        },
        riskValue: {
          type: 'RISK_LEVEL',
          value: 'MEDIUM',
        },
      },
    ],
    parameter: 'userSegment',
    isActive: true,
    riskEntityType: 'BUSINESS',
    weight: 0.1,
    defaultValue: {
      type: 'RISK_LEVEL',
      value: 'VERY_HIGH',
    },
  },
  {
    parameterType: 'VARIABLE',
    isDerived: false,
    riskLevelAssignmentValues: [
      {
        parameterValue: {
          content: {
            kind: 'MULTIPLE',
            values: [
              {
                kind: 'LITERAL',
                content: 'DE',
              },
            ],
          },
        },
        riskValue: {
          type: 'RISK_LEVEL',
          value: 'VERY_LOW',
        },
      },
    ],
    parameter: 'legalEntity.companyRegistrationDetails.registrationCountry',
    isActive: true,
    riskEntityType: 'BUSINESS',
    weight: 1,
    defaultValue: {
      type: 'RISK_LEVEL',
      value: 'VERY_HIGH',
    },
  },
  {
    parameter: 'directors',
    targetIterableParameter: 'generalDetails.countryOfNationality',
    parameterType: 'ITERABLE',
    riskLevelAssignmentValues: [
      {
        parameterValue: {
          content: {
            kind: 'MULTIPLE',
            values: [
              {
                kind: 'LITERAL',
                content: 'DE',
              },
            ],
          },
        },
        riskValue: {
          type: 'RISK_LEVEL',
          value: 'LOW',
        },
      },
    ],
    isActive: true,
    riskEntityType: 'BUSINESS',
    weight: 0.7,
    defaultValue: {
      type: 'RISK_LEVEL',
      value: 'VERY_HIGH',
    },
    isDerived: false,
  },
  {
    parameter: 'shareHolders',
    targetIterableParameter: 'generalDetails.countryOfNationality',
    parameterType: 'ITERABLE',
    isDerived: false,
    riskLevelAssignmentValues: [
      {
        parameterValue: {
          content: {
            kind: 'MULTIPLE',
            values: [
              {
                kind: 'LITERAL',
                content: 'DE',
              },
            ],
          },
        },
        riskValue: {
          type: 'RISK_LEVEL',
          value: 'LOW',
        },
      },
    ],
    isActive: true,
    riskEntityType: 'BUSINESS',
    weight: 0.8,
    defaultValue: {
      type: 'RISK_LEVEL',
      value: 'VERY_HIGH',
    },
  },
  {
    parameterType: 'VARIABLE',
    isDerived: true,
    riskLevelAssignmentValues: [
      {
        parameterValue: {
          content: {
            kind: 'MULTIPLE',
            values: [
              {
                kind: 'LITERAL',
                content: 'BUSINESS',
              },
            ],
          },
        },
        riskValue: {
          type: 'RISK_LEVEL',
          value: 'LOW',
        },
      },
    ],
    parameter: 'type',
    isActive: true,
    riskEntityType: 'BUSINESS',
    weight: 1,
    defaultValue: {
      type: 'RISK_LEVEL',
      value: 'VERY_HIGH',
    },
  },
  {
    parameterType: 'ITERABLE',
    isDerived: false,
    riskLevelAssignmentValues: [
      {
        parameterValue: {
          content: {
            kind: 'MULTIPLE',
            values: [
              {
                kind: 'LITERAL',
                content: 'FARMING',
              },
            ],
          },
        },
        riskValue: {
          type: 'RISK_LEVEL',
          value: 'LOW',
        },
      },
    ],
    isNullableAllowed: true,
    parameter: 'legalEntity.companyGeneralDetails.businessIndustry',
    isActive: true,
    riskEntityType: 'BUSINESS',
    weight: 0.3,
    defaultValue: {
      type: 'RISK_LEVEL',
      value: 'VERY_HIGH',
    },
  },
  {
    parameterType: 'VARIABLE',
    isDerived: true,
    riskLevelAssignmentValues: [
      {
        parameterValue: {
          content: {
            kind: 'MULTIPLE',
            values: [
              {
                kind: 'LITERAL',
                content: 'CONSUMER',
              },
            ],
          },
        },
        riskValue: {
          type: 'RISK_LEVEL',
          value: 'MEDIUM',
        },
      },
    ],
    parameter: 'type',
    isActive: true,
    riskEntityType: 'CONSUMER_USER',
    weight: 0.4,
    defaultValue: {
      type: 'RISK_LEVEL',
      value: 'VERY_HIGH',
    },
  },
  {
    parameterType: 'VARIABLE',
    isDerived: false,
    riskLevelAssignmentValues: [
      {
        parameterValue: {
          content: {
            kind: 'MULTIPLE',
            values: [
              {
                kind: 'LITERAL',
                content: 'PK',
              },
            ],
          },
        },
        riskValue: {
          type: 'RISK_LEVEL',
          value: 'MEDIUM',
        },
      },
    ],
    parameter: 'userDetails.countryOfResidence',
    isActive: true,
    riskEntityType: 'CONSUMER_USER',
    weight: 0.1,
    defaultValue: {
      type: 'RISK_LEVEL',
      value: 'VERY_HIGH',
    },
  },
  {
    parameterType: 'VARIABLE',
    isDerived: false,
    riskLevelAssignmentValues: [
      {
        parameterValue: {
          content: {
            kind: 'MULTIPLE',
            values: [
              {
                kind: 'LITERAL',
                content: 'PK',
              },
            ],
          },
        },
        riskValue: {
          type: 'RISK_LEVEL',
          value: 'MEDIUM',
        },
      },
    ],
    parameter: 'userDetails.countryOfNationality',
    isActive: true,
    riskEntityType: 'CONSUMER_USER',
    weight: 0.9,
    defaultValue: {
      type: 'RISK_LEVEL',
      value: 'VERY_HIGH',
    },
  },
  {
    parameterType: 'VARIABLE',
    isDerived: false,
    riskLevelAssignmentValues: [
      {
        parameterValue: {
          content: {
            kind: 'MULTIPLE',
            values: [
              {
                kind: 'LITERAL',
                content: 'RETAIL',
              },
            ],
          },
        },
        riskValue: {
          type: 'RISK_LEVEL',
          value: 'MEDIUM',
        },
      },
    ],
    parameter: 'userSegment',
    isActive: true,
    riskEntityType: 'CONSUMER_USER',
    weight: 0.6,
    defaultValue: {
      type: 'RISK_LEVEL',
      value: 'VERY_HIGH',
    },
  },
  {
    parameterType: 'VARIABLE',
    isDerived: false,
    riskLevelAssignmentValues: [
      {
        parameterValue: {
          content: {
            kind: 'MULTIPLE',
            values: [
              {
                kind: 'LITERAL',
                content: 'UNEMPLOYED',
              },
            ],
          },
        },
        riskValue: {
          type: 'RISK_LEVEL',
          value: 'VERY_LOW',
        },
      },
    ],
    parameter: 'employmentStatus',
    isActive: true,
    riskEntityType: 'CONSUMER_USER',
    weight: 0.3,
    defaultValue: {
      type: 'RISK_LEVEL',
      value: 'VERY_HIGH',
    },
  },
]

describe('Risk Scoring Service KRS', () => {
  it('Should only check for Consumer User Risk Score', async () => {
    const dynamoDb = await getDynamoDbClient()
    const mongoDb = await getMongoDbClient()

    const riskScoringService = new RiskScoringService(testTenantId, {
      dynamoDb,
      mongoDb,
    })
    const testUser = getTestUser({
      createdTimestamp: 1685969811000,
      userId: 'test-user-0',
      reasonForAccountOpening: ['Payment', 'Deposits'],
      userSegment: 'RETAIL',
      userDetails: {
        name: {
          firstName: 'Aman Ji',
          lastName: 'Dugar',
        },
        dateOfBirth: '2007-01-15',
        countryOfResidence: 'IN',
        countryOfNationality: 'PK',
      },
      employmentStatus: 'UNEMPLOYED',
      legalDocuments: [
        {
          documentType: 'passport',
          documentNumber: 'CB33GME6',
          documentIssuedDate: 1639939034,
          documentExpirationDate: 1839939034,
          documentIssuedCountry: 'US',
        },
      ],
      tags: [
        {
          key: 'hello',
          value: 'wallet',
        },
      ],
    })

    const { components, score } = await riskScoringService.calculateKrsScore(
      testUser,
      DEFAULT_CLASSIFICATION_SETTINGS,
      TEST_PARAMETERS
    )

    expect(Math.round(score)).toEqual(47)
    expect(components).toMatchObject([
      {
        entityType: 'CONSUMER_USER',
        parameter: 'type',
        riskLevel: 'MEDIUM',
        value: 'CONSUMER',
        score: 50,
        weight: 0.4,
      },
      {
        entityType: 'CONSUMER_USER',
        parameter: 'userDetails.countryOfResidence',
        riskLevel: 'VERY_HIGH',
        value: 'IN',
        score: 90,
      },
      {
        entityType: 'CONSUMER_USER',
        parameter: 'userDetails.countryOfNationality',
        riskLevel: 'MEDIUM',
        value: 'PK',
        score: 50,
      },
      {
        entityType: 'CONSUMER_USER',
        parameter: 'userSegment',
        riskLevel: 'MEDIUM',
        value: 'RETAIL',
        score: 50,
      },
      {
        entityType: 'CONSUMER_USER',
        parameter: 'employmentStatus',
        riskLevel: 'VERY_LOW',
        value: 'UNEMPLOYED',
        score: 10,
      },
    ])
  })
  it('Should only check for Business User Risk Score', async () => {
    const dynamoDb = await getDynamoDbClient()
    const mongoDb = await getMongoDbClient()

    const riskScoringService = new RiskScoringService(testTenantId, {
      dynamoDb,
      mongoDb,
    })

    const testUser = getTestUser({
      createdTimestamp: 1685969811000,
      type: 'BUSINESS',
      userId: 'test-user-0',
      reasonForAccountOpening: ['Payment', 'Deposits'],
      userSegment: 'RETAIL',
      legalEntity: {
        companyGeneralDetails: {
          legalName: 'Flag check',
          businessIndustry: ['FARMING'],
          userRegistrationStatus: 'REGISTERED',
        },
        companyRegistrationDetails: {
          registrationCountry: 'DE',
          registrationIdentifier: 'PSDSDADA',
        },
      },
      shareHolders: [
        {
          userId: uuid4(),
          generalDetails: {
            name: {
              firstName: 'kavish',
            },
            countryOfNationality: 'DE',
          },
        },
      ],
      directors: [
        {
          userId: uuid4(),
          generalDetails: {
            name: {
              firstName: 'kavish',
            },
            countryOfNationality: 'DE',
          },
        },
      ],
      userDetails: {
        name: {
          firstName: 'Aman Ji',
          lastName: 'Dugar',
        },
        dateOfBirth: '2007-01-15',
        countryOfResidence: 'IN',
        countryOfNationality: 'PK',
      },
      employmentStatus: 'UNEMPLOYED',
      legalDocuments: [
        {
          documentType: 'passport',
          documentNumber: 'CB33GME6',
          documentIssuedDate: 1639939034,
          documentExpirationDate: 1839939034,
          documentIssuedCountry: 'US',
        },
      ],
      tags: [
        {
          key: 'hello',
          value: 'wallet',
        },
      ],
    })

    const { components, score } = await riskScoringService.calculateKrsScore(
      testUser,
      DEFAULT_CLASSIFICATION_SETTINGS,
      TEST_PARAMETERS
    )
    expect(Math.round(score)).toEqual(26)
    expect(components).toMatchObject([
      {
        entityType: 'BUSINESS',
        parameter: 'legalEntity.companyGeneralDetails.userRegistrationStatus',
        riskLevel: 'LOW',
        value: 'REGISTERED',
        score: 30,
      },
      {
        entityType: 'BUSINESS',
        parameter: 'userSegment',
        riskLevel: 'MEDIUM',
        value: 'RETAIL',
        score: 50,
      },

      {
        entityType: 'BUSINESS',
        parameter: 'legalEntity.companyRegistrationDetails.registrationCountry',
        riskLevel: 'VERY_LOW',
        value: 'DE',
        score: 10,
      },
      {
        entityType: 'BUSINESS',
        parameter: 'directors',
        riskLevel: 'LOW',
        value: 'DE',
        score: 30,
      },
      {
        entityType: 'BUSINESS',
        parameter: 'shareHolders',
        riskLevel: 'LOW',
        value: 'DE',
        score: 30,
      },
      {
        entityType: 'BUSINESS',
        parameter: 'type',
        riskLevel: 'LOW',
        value: 'BUSINESS',
        score: 30,
      },
      {
        entityType: 'BUSINESS',
        parameter: 'legalEntity.companyGeneralDetails.businessIndustry',
        riskLevel: 'LOW',
        value: 'FARMING',
        score: 30,
      },
    ])
  })
})
