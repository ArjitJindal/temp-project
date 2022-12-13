import { updateDynamicRiskScores, updateInitialRiskScores } from '..'
import { RiskRepository } from '../repositories/risk-repository'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import {
  getTestUser,
  setUpConsumerUsersHooks,
} from '@/test-utils/user-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { Feature } from '@/@types/openapi-internal/Feature'
import { testRiskItem } from '@/test-utils/risk-item-utils'

const dynamoDb = getDynamoDbClient()

const features: Feature[] = [
  'PULSE',
  'PULSE_KRS_CALCULATION',
  'PULSE_ARS_CALCULATION',
]

withFeatureHook(features)

dynamoDbSetupHook()

const testUser1 = getTestUser({ userId: '1' })
const testUser2 = getTestUser({ userId: '2' })
const testTenantId = getTestTenantId()

setUpConsumerUsersHooks(testTenantId, [testUser1, testUser2])

describe('Risk Scoring', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'development'
    process.env.ENV = 'local'
  })

  const riskRepository = new RiskRepository(testTenantId, {
    dynamoDb,
  })

  describe('Risk Scoring Tests', () => {
    it('should update inital the risk score of a user', async () => {
      await updateInitialRiskScores(testTenantId, dynamoDb, testUser1)

      const getRiskScore = await riskRepository.getDrsScore(testUser1.userId)

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
    await riskRepository.createOrUpdateDrsScore(
      testUser1.userId,
      70,
      'TEST_DRS'
    )

    const getRiskScore = await riskRepository.getDrsScore(testUser1.userId)

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
    await riskRepository.createOrUpdateManualDRSRiskItem(
      testUser1.userId,
      'VERY_LOW',
      false
    )

    const testTransaction1 = getTestTransaction({
      originUserId: testUser1.userId,
      destinationUserId: testUser2.userId,
      originAmountDetails: {
        country: 'IN',
        transactionAmount: 10000000,
        transactionCurrency: 'INR',
      },
    })

    await riskRepository.createOrUpdateParameterRiskItem(testRiskItem)

    await updateDynamicRiskScores(testTenantId, dynamoDb, testTransaction1)

    const getRiskScore = await riskRepository.getDrsScore(testUser1.userId)

    expect(getRiskScore).toEqual(
      expect.objectContaining({
        manualRiskLevel: 'VERY_LOW',
        isUpdatable: false,
        drsScore: 10,
      })
    )
  })
})
