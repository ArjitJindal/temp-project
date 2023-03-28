import { RiskScoringService } from '..'
import { RiskRepository } from '../repositories/risk-repository'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestUser, setUpUsersHooks } from '@/test-utils/user-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import {
  TEST_ITERABLE_RISK_ITEM,
  TEST_VARIABLE_RISK_ITEM,
} from '@/test-utils/pulse-test-utils'
import { getMongoDbClient } from '@/utils/mongoDBUtils'

const dynamoDb = getDynamoDbClient()
withFeatureHook(['PULSE'])
dynamoDbSetupHook()

const testUser1 = getTestUser({ userId: '1' })
const testUser2 = getTestUser({ userId: '2' })
const testTenantId = getTestTenantId()

setUpUsersHooks(testTenantId, [testUser1, testUser2])

const getRiskRepository = async () => {
  const mongoDb = await getMongoDbClient()
  return new RiskRepository(testTenantId, {
    dynamoDb,
    mongoDb,
  })
}

describe('Risk Scoring', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'development'
    process.env.ENV = 'local'
  })

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
