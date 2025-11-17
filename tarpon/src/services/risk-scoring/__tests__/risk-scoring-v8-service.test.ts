import { RiskScoringV8Service } from '../risk-scoring-v8-service'
import { RiskRepository } from '../repositories/risk-repository'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import {
  getTestTransaction,
  getTestTransactionEvent,
} from '@/test-utils/transaction-test-utils'
import {
  getTestRiskFactor,
  setUpRiskFactorsHook,
} from '@/test-utils/pulse-test-utils'
import { getTestUser, setUpUsersHooks } from '@/test-utils/user-test-utils'
import { TenantService } from '@/services/tenants'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { FormulaCustom } from '@/@types/openapi-internal/FormulaCustom'
import { FormulaLegacyMovingAvg } from '@/@types/openapi-internal/FormulaLegacyMovingAvg'
import { FormulaSimpleAvg } from '@/@types/openapi-internal/FormulaSimpleAvg'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { User } from '@/@types/openapi-internal/User'
import { UserEvent } from '@/services/rules-engine/repositories/user-repository-interface'

dynamoDbSetupHook()
withFeatureHook(['RISK_SCORING'])
describe('V8 Risk scoring ', () => {
  describe('handle Transaction only ARS', () => {
    let riskScoringService: RiskScoringV8Service
    const tenantId = getTestTenantId()
    beforeEach(async () => {
      const mongoDb = await getMongoDbClient()
      const dynamoDb = getDynamoDbClient()
      const tenantRepository = new TenantRepository(tenantId, {
        dynamoDb,
      })
      await tenantRepository.createOrUpdateTenantSettings({
        riskScoringCraEnabled: false,
      })
      const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
      riskScoringService = new RiskScoringV8Service(tenantId, logicEvaluator, {
        mongoDb,
        dynamoDb,
      })
    })
    describe('basic cases with one risk factor for ARS', () => {
      setUpRiskFactorsHook(tenantId, [
        getTestRiskFactor({
          id: 'RF1',
          riskLevelLogic: [
            {
              logic: {
                and: [{ '==': [{ var: 'TRANSACTION:type' }, 'DEPOSIT'] }],
              },
              riskLevel: 'VERY_LOW',
              riskScore: 8,
              weight: 1,
            },
            {
              logic: {
                and: [{ '==': [{ var: 'TRANSACTION:type' }, 'TRANSFER'] }],
              },
              riskLevel: 'LOW',
              riskScore: 25,
              weight: 1,
            },
            {
              logic: {
                and: [{ '==': [{ var: 'TRANSACTION:type' }, 'REFUND'] }],
              },
              riskLevel: 'MEDIUM',
              riskScore: 44,
              weight: 1,
            },
          ],
        }),
      ])
      test('simple transaction only ARS (low)', async () => {
        const result = await riskScoringService.handleTransaction(
          getTestTransaction({
            type: 'TRANSFER',
          }),
          []
        )
        expect(result).toEqual({
          trsScore: 25,
          trsRiskLevel: 'LOW',
        })
      })
      test('simple transaction only ARS (very low)', async () => {
        const result = await riskScoringService.handleTransaction(
          getTestTransaction({
            type: 'DEPOSIT',
          }),
          []
        )
        expect(result).toEqual({
          trsScore: 8,
          trsRiskLevel: 'VERY_LOW',
        })
      })
      test('simple transaction only ARS (medium) and check components', async () => {
        const transaction = getTestTransaction({
          type: 'REFUND',
        })
        const result = await riskScoringService.handleTransaction(
          transaction,
          []
        )
        expect(result).toEqual({
          trsScore: 44,
          trsRiskLevel: 'MEDIUM',
        })

        const ars = await riskScoringService.getArsScore(
          transaction.transactionId
        )
        expect(ars?.factorScoreDetails).toEqual([
          {
            score: 44,
            weight: 1,
            hit: true,
            vars: [
              {
                direction: 'ORIGIN',
                value: { 'TRANSACTION:type': 'REFUND' },
              },
            ],
            riskLevel: 'MEDIUM',
            riskFactorId: 'RF1',
          },
        ])
      })
      test('simple transaction only ARS (default)', async () => {
        const result = await riskScoringService.handleTransaction(
          getTestTransaction({
            type: 'WITHDRAWAL',
          }),
          []
        )
        expect(result).toEqual({
          trsScore: 75,
          trsRiskLevel: 'HIGH',
        })
      })
    })
    describe('basic cases with two risk factors for ARS', () => {
      setUpRiskFactorsHook(tenantId, [
        getTestRiskFactor({
          id: 'RF1',
          riskLevelLogic: [
            {
              logic: {
                and: [{ '==': [{ var: 'TRANSACTION:type' }, 'DEPOSIT'] }],
              },
              riskLevel: 'VERY_LOW',
              riskScore: 8,
              weight: 1,
            },
          ],
        }),
        getTestRiskFactor({
          id: 'RF2',
          riskLevelLogic: [
            {
              logic: {
                and: [{ '==': [{ var: 'TRANSACTION:transactionId' }, 'TEST'] }],
              },
              riskLevel: 'LOW',
              riskScore: 25,
              weight: 1,
            },
          ],
        }),
      ])
      test('simple transaction only one condition matches ARS other defaults (medium)', async () => {
        const result = await riskScoringService.handleTransaction(
          getTestTransaction({
            transactionId: 'TEST',
          }),
          []
        )
        expect(result).toEqual({
          trsScore: 50,
          trsRiskLevel: 'MEDIUM',
        })
      })

      test('simple transaction only both condition matches ARS (very low), components should be saved ', async () => {
        const transaction = getTestTransaction({
          transactionId: 'TEST',
          type: 'DEPOSIT',
        })
        const result = await riskScoringService.handleTransaction(
          transaction,
          []
        )
        expect(result).toEqual({
          trsScore: 16.5,
          trsRiskLevel: 'VERY_LOW',
        })
        const ars = await riskScoringService.getArsScore(
          transaction.transactionId
        )
        expect(ars?.factorScoreDetails).toEqual([
          {
            score: 8,
            weight: 1,
            hit: true,
            vars: [
              { direction: 'ORIGIN', value: { 'TRANSACTION:type': 'DEPOSIT' } },
            ],
            riskLevel: 'VERY_LOW',
            riskFactorId: 'RF1',
          },
          {
            score: 25,
            weight: 1,
            hit: true,
            vars: [
              {
                direction: 'ORIGIN',
                value: { 'TRANSACTION:transactionId': 'TEST' },
              },
            ],
            riskLevel: 'LOW',
            riskFactorId: 'RF2',
          },
        ])
      })
    })
    describe('Ars score with aggregation variables', () => {
      const userTest = getTestUser({
        userId: 'AggUser',
      })
      setUpUsersHooks(tenantId, [userTest], false)
      setUpRiskFactorsHook(tenantId, [
        getTestRiskFactor({
          id: 'RF1',
          riskLevelLogic: [
            {
              logic: { and: [{ '==': [{ var: 'agg:123' }, 2] }] },
              riskLevel: 'MEDIUM',
              riskScore: 50,
              weight: 0.5,
            },
            {
              logic: {
                and: [{ '==': [{ var: 'agg:123' }, 1] }],
              },
              riskLevel: 'VERY_HIGH',
              riskScore: 100,
              weight: 1,
            },
          ],
          logicAggregationVariables: [
            {
              key: 'agg:123',
              type: 'USER_TRANSACTIONS',
              userDirection: 'SENDER_OR_RECEIVER',
              transactionDirection: 'SENDING_RECEIVING',
              aggregationFieldKey: 'TRANSACTION:transactionId',
              aggregationFunc: 'COUNT',
              timeWindow: {
                start: { units: 30, granularity: 'day' },
                end: { units: 0, granularity: 'day' },
              },
              includeCurrentEntity: true,
            },
          ],
        }),
      ])
      test('Ars score with aggregation variable (VERY_HIGH)', async () => {
        const result = await riskScoringService.handleTransaction(
          getTestTransaction({
            originUserId: 'AggUser',
            destinationUserId: '1',
            timestamp: Date.now(),
          }),
          [],
          userTest
        )
        expect(result).toEqual({
          trsScore: 100,
          trsRiskLevel: 'VERY_HIGH',
        })
        const result2 = await riskScoringService.handleTransaction(
          getTestTransaction({
            originUserId: '2',
            destinationUserId: 'AggUser',
            timestamp: Date.now() + 2,
          }),
          [],
          undefined,
          userTest
        )
        /* As the destination user has transaction count == 2 and the origin user has transaction count == 1 
        but as the priority of lower risk is lower so we hit VERY_HIGH logic condition not the MEDIUM */
        expect(result2).toEqual({
          trsScore: 100,
          trsRiskLevel: 'VERY_HIGH',
        })
      })
      test('Ars score with aggregation variable defaulting to high as no userId (high)', async () => {
        const transaction = getTestTransaction({
          originUserId: undefined,
          destinationUserId: undefined,
          transactionId: 'TEST',
          type: 'DEPOSIT',
        })
        const result = await riskScoringService.handleTransaction(
          transaction,
          []
        )
        expect(result).toEqual({
          trsScore: 75,
          trsRiskLevel: 'HIGH',
        })
      })
    })
    describe('check updation of averageARScores', () => {
      const user1 = getTestUser({
        userId: 'USER1',
      })
      const user2 = getTestUser({
        userId: 'USER2',
      })
      const user3 = getTestUser({
        userId: 'USER3',
      })

      const user4 = getTestUser({
        userId: 'USER4',
      })

      setUpRiskFactorsHook(tenantId, [
        getTestRiskFactor({
          id: 'RF1',
          riskLevelLogic: [
            {
              logic: {
                and: [{ '==': [{ var: 'TRANSACTION:type' }, 'DEPOSIT'] }],
              },
              riskLevel: 'VERY_LOW',
              riskScore: 10,
              weight: 0.5,
            },
          ],
        }),
        getTestRiskFactor({
          id: 'RF2',
          type: 'TRANSACTION',
          baseCurrency: 'USD',
          riskLevelLogic: [
            {
              logic: {
                and: [
                  {
                    '>=': [
                      {
                        var: 'TRANSACTION:originAmountDetails-transactionAmount',
                      },
                      100,
                    ],
                  },
                ],
              },
              weight: 1,
              riskScore: 60,
              riskLevel: 'HIGH',
            },
          ],
        }),
      ])
      setUpUsersHooks(tenantId, [user1, user2, user3], false)
      test('should update averageARScores only one user', async () => {
        const result1 = await riskScoringService.handleTransaction(
          getTestTransaction({
            originUserId: 'USER1',
            transactionId: 'TEST',
            type: 'REFUND',
            originAmountDetails: {
              transactionCurrency: 'USD',
              transactionAmount: 100,
            },
          }),
          [],
          user1
        )
        expect(result1).toEqual({
          trsScore: 67.5,
          trsRiskLevel: 'HIGH',
        })
        const dynamoDb = getDynamoDbClient()
        const riskRepository = new RiskRepository(tenantId, { dynamoDb })
        const user1AverageArsScore1 =
          await riskRepository.getAverageArsScoreDynamo('USER1')
        expect(user1AverageArsScore1).toEqual({
          userId: 'USER1',
          value: 67.5,
          transactionCount: 1,
          createdAt: expect.any(Number),
          updateCount: expect.any(Number),
        })
        const result2 = await riskScoringService.handleTransaction(
          getTestTransaction({
            destinationUserId: 'USER1',
            originAmountDetails: {
              transactionAmount: 10,
              transactionCurrency: 'USD',
            },
          }),
          [],
          user1
        )
        expect(result2).toEqual({
          trsScore: 75,
          trsRiskLevel: 'HIGH',
        })
        const user1AverageArsScore2 =
          await riskRepository.getAverageArsScoreDynamo('USER1')
        expect(user1AverageArsScore2).toEqual({
          userId: 'USER1',
          value: 71.25,
          transactionCount: 2,
          createdAt: expect.any(Number),
          updateCount: expect.any(Number),
        })
      })
      test('should update averageARScores only one user with transaction events', async () => {
        const tx1 = getTestTransaction({
          originUserId: 'USER4',
          transactionId: 'TEST',
          type: 'REFUND',
          originAmountDetails: {
            transactionCurrency: 'USD',
            transactionAmount: 100,
          },
        })
        const result1 = await riskScoringService.handleTransaction(
          tx1,
          [],
          user4
        )
        expect(result1).toEqual({
          trsScore: 67.5,
          trsRiskLevel: 'HIGH',
        })
        const dynamoDb = getDynamoDbClient()
        const riskRepository = new RiskRepository(tenantId, { dynamoDb })
        const user4AverageArsScore1 =
          await riskRepository.getAverageArsScoreDynamo('USER4')
        expect(user4AverageArsScore1).toEqual({
          userId: 'USER4',
          value: 67.5,
          transactionCount: 1,
          createdAt: expect.any(Number),
          updateCount: expect.any(Number),
        })
        const result2 = await riskScoringService.handleTransaction(
          getTestTransaction({
            destinationUserId: 'USER4',
            originAmountDetails: {
              transactionAmount: 10,
              transactionCurrency: 'USD',
            },
            type: 'OTHER',
          }),
          [],
          user4
        )
        expect(result2).toEqual({
          trsScore: 75,
          trsRiskLevel: 'HIGH',
        })
        const user4AverageArsScore2 =
          await riskRepository.getAverageArsScoreDynamo('USER4')
        expect(user4AverageArsScore2).toEqual({
          userId: 'USER4',
          value: 71.25,
          transactionCount: 2,
          createdAt: expect.any(Number),
          updateCount: expect.any(Number),
        })
        const result3 = await riskScoringService.handleTransaction(
          {
            ...tx1,
            originAmountDetails: {
              transactionAmount: 10,
              transactionCurrency: 'USD',
            },
          },
          [
            getTestTransactionEvent({
              transactionId: tx1.transactionId,
            }),
            getTestTransactionEvent({
              transactionId: tx1.transactionId,
              updatedTransactionAttributes: {
                originAmountDetails: {
                  transactionAmount: 10,
                  transactionCurrency: 'USD',
                },
              },
            }),
          ],
          user4
        )
        expect(result3).toEqual({
          trsScore: 75,
          trsRiskLevel: 'HIGH',
        })
        const user4AverageArsScore3 =
          await riskRepository.getAverageArsScoreDynamo('USER4')
        expect(user4AverageArsScore3).toEqual({
          userId: 'USER4',
          value: 75,
          transactionCount: 2,
          updateCount: expect.any(Number),
          createdAt: expect.any(Number),
        })
      })
      test('should update averageARScores for both users', async () => {
        const result1 = await riskScoringService.handleTransaction(
          getTestTransaction({
            originUserId: 'USER3',
            destinationUserId: 'USER2',
            transactionId: 'TEST',
            type: 'REFUND',
            originAmountDetails: {
              transactionAmount: 100,
              transactionCurrency: 'USD',
            },
          }),
          [],
          user3,
          user2
        )
        expect(result1).toEqual({
          trsScore: 67.5,
          trsRiskLevel: 'HIGH',
        })
        const dynamoDb = getDynamoDbClient()
        const riskRepository = new RiskRepository(tenantId, { dynamoDb })
        const user2AverageArsScore1 =
          await riskRepository.getAverageArsScoreDynamo('USER2')
        expect(user2AverageArsScore1).toEqual({
          userId: 'USER2',
          value: 67.5,
          transactionCount: 1,
          createdAt: expect.any(Number),
          updateCount: expect.any(Number),
        })
        const user3AverageArsScore1 =
          await riskRepository.getAverageArsScoreDynamo('USER3')
        expect(user3AverageArsScore1).toEqual({
          userId: 'USER3',
          value: 67.5,
          transactionCount: 1,
          createdAt: expect.any(Number),
          updateCount: expect.any(Number),
        })
        const result2 = await riskScoringService.handleTransaction(
          getTestTransaction({
            originUserId: 'USER3',
            destinationUserId: 'USER2',
            transactionId: 'TEST',
            type: 'REFUND',
            originAmountDetails: {
              transactionAmount: 10,
              transactionCurrency: 'USD',
            },
          }),
          [],
          user3,
          user2
        )
        expect(result2).toEqual({
          trsScore: 75,
          trsRiskLevel: 'HIGH',
        })
        const user2AverageArsScore2 =
          await riskRepository.getAverageArsScoreDynamo('USER2')
        expect(user2AverageArsScore2).toEqual({
          userId: 'USER2',
          value: 71.25,
          transactionCount: 2,
          createdAt: expect.any(Number),
          updateCount: expect.any(Number),
        })
        const user3AverageArsScore2 =
          await riskRepository.getAverageArsScoreDynamo('USER3')
        expect(user3AverageArsScore2).toEqual({
          userId: 'USER3',
          value: 71.25,
          transactionCount: 2,
          createdAt: expect.any(Number),
          updateCount: expect.any(Number),
        })
      })
    })
  })

  describe('handle user only KRS', () => {
    let riskScoringService: RiskScoringV8Service
    const tenantId = getTestTenantId()
    beforeEach(async () => {
      const mongoDb = await getMongoDbClient()
      const dynamoDb = getDynamoDbClient()
      const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
      riskScoringService = new RiskScoringV8Service(tenantId, logicEvaluator, {
        mongoDb,
        dynamoDb,
      })
      const tenantRepository = new TenantRepository(tenantId, {
        dynamoDb,
      })
      await tenantRepository.createOrUpdateTenantSettings({
        riskScoringCraEnabled: false,
      })
    })
    describe('basic cases with one risk factor for KRS', () => {
      setUpRiskFactorsHook(tenantId, [
        getTestRiskFactor({
          id: 'RF2',
          type: 'CONSUMER_USER',
          riskLevelLogic: [
            {
              logic: {
                and: [
                  {
                    '==': [
                      { var: 'CONSUMER_USER:acquisitionChannel__SENDER' },
                      'ORGANIC',
                    ],
                  },
                ],
              },
              riskLevel: 'VERY_LOW',
              riskScore: 8,
              weight: 1,
            },
            {
              logic: {
                and: [
                  {
                    '==': [
                      { var: 'CONSUMER_USER:acquisitionChannel__SENDER' },
                      'PAID',
                    ],
                  },
                ],
              },
              riskLevel: 'LOW',
              riskScore: 25,
              weight: 1,
            },
            {
              logic: {
                and: [
                  {
                    '==': [
                      { var: 'CONSUMER_USER:acquisitionChannel__SENDER' },
                      'REFERRAL',
                    ],
                  },
                ],
              },
              riskLevel: 'MEDIUM',
              riskScore: 44,
              weight: 1,
            },
          ],
        }),
      ])
      test('simple user only KRS (medium) and check components', async () => {
        const user = getTestUser({
          acquisitionChannel: 'REFERRAL',
        })

        const result = await riskScoringService.handleUserUpdate({ user })
        expect(result).toEqual({
          kycRiskScore: 44,
          kycRiskLevel: 'MEDIUM',
        })
        const krs = await riskScoringService.getKrsScore(user.userId)
        expect(krs?.factorScoreDetails).toEqual([
          {
            score: 44,
            weight: 1,
            hit: true,
            vars: [
              {
                direction: 'ORIGIN',
                value: {
                  'CONSUMER_USER:acquisitionChannel__SENDER': 'REFERRAL',
                },
              },
            ],
            riskLevel: 'MEDIUM',
            riskFactorId: 'RF2',
          },
        ])
      })
      test('simple user only KRS (low)', async () => {
        const result = await riskScoringService.handleUserUpdate({
          user: getTestUser({
            acquisitionChannel: 'PAID',
          }),
        })
        expect(result).toEqual({
          kycRiskScore: 25,
          kycRiskLevel: 'LOW',
        })
      })
      test('simple user only KRS (default)', async () => {
        const result = await riskScoringService.handleUserUpdate({
          user: getTestUser({
            acquisitionChannel: 'GATHERING',
          }),
        })
        expect(result).toEqual({
          kycRiskScore: 75,
          kycRiskLevel: 'HIGH',
        })
      })
    })
    describe('basic cases with two risk factors for KRS', () => {
      setUpRiskFactorsHook(tenantId, [
        getTestRiskFactor({
          id: 'RF2',
          type: 'CONSUMER_USER',
          riskLevelLogic: [
            {
              logic: {
                and: [
                  {
                    '==': [
                      { var: 'CONSUMER_USER:acquisitionChannel__SENDER' },
                      'PAID',
                    ],
                  },
                ],
              },
              riskLevel: 'LOW',
              riskScore: 25,
              weight: 1,
            },
          ],
        }),
        getTestRiskFactor({
          id: 'RF3',
          type: 'CONSUMER_USER',
          riskLevelLogic: [
            {
              logic: {
                and: [
                  {
                    '==': [
                      { var: 'CONSUMER_USER:kycStatusDetails-status__SENDER' },
                      'FAILED',
                    ],
                  },
                ],
              },
              riskLevel: 'MEDIUM',
              riskScore: 44,
              weight: 1,
            },
          ],
        }),
      ])
      test('simple user only one of two condition matches KRS (medium)', async () => {
        const result = await riskScoringService.handleUserUpdate({
          user: getTestUser({
            kycStatusDetails: {
              status: 'FAILED',
            },
          }),
        })
        expect(result).toEqual({
          kycRiskScore: 59.5,
          kycRiskLevel: 'MEDIUM',
        })
      })
      test('simple user only one of two condition matches KRS (medium)', async () => {
        const result = await riskScoringService.handleUserUpdate({
          user: getTestUser({
            acquisitionChannel: 'PAID',
          }),
        })
        expect(result).toEqual({
          kycRiskScore: 50,
          kycRiskLevel: 'MEDIUM',
        })
      })
      test('simple user both condition matches KRS (low), components should be saved', async () => {
        const user = getTestUser({
          acquisitionChannel: 'PAID',
          kycStatusDetails: {
            status: 'FAILED',
          },
        })
        const result = await riskScoringService.handleUserUpdate({ user })
        expect(result).toEqual({
          kycRiskScore: 34.5,
          kycRiskLevel: 'LOW',
        })
        const krs = await riskScoringService.getKrsScore(user.userId)
        expect(krs?.factorScoreDetails).toEqual([
          {
            score: 25,
            weight: 1,
            hit: true,
            vars: [
              {
                direction: 'ORIGIN',
                value: {
                  'CONSUMER_USER:acquisitionChannel__SENDER': 'PAID',
                },
              },
            ],
            riskLevel: 'LOW',
            riskFactorId: 'RF2',
          },
          {
            score: 44,
            weight: 1,
            hit: true,
            vars: [
              {
                direction: 'ORIGIN',
                value: {
                  'CONSUMER_USER:kycStatusDetails-status__SENDER': 'FAILED',
                },
              },
            ],
            riskLevel: 'MEDIUM',
            riskFactorId: 'RF3',
          },
        ])
      })
    })
    describe('User KRS with User Aggregation risk factor', () => {
      setUpRiskFactorsHook(tenantId, [
        getTestRiskFactor({
          id: 'RF1',
          type: 'CONSUMER_USER',
          logicAggregationVariables: [
            {
              includeCurrentEntity: true,
              type: 'USER_DETAILS',
              aggregationFieldKey:
                'CONSUMER_USER:userDetails-name-firstName__SENDER',
              aggregationFunc: 'UNIQUE_COUNT',
              key: 'agg:user1',
              timeWindow: {
                start: {
                  units: 1,
                  granularity: 'day',
                },
                end: {
                  units: 0,
                  granularity: 'now',
                },
              },
            },
          ],
          riskLevelLogic: [
            {
              logic: {
                and: [
                  {
                    '>': [{ var: 'agg:user1' }, 1],
                  },
                ],
              },
              riskLevel: 'LOW',
              riskScore: 25,
              weight: 1,
            },
          ],
        }),
      ])
      test('Risk factor condition hit with user creation and 1 user event', async () => {
        const testUser = getTestUser({
          userDetails: {
            name: {
              firstName: 'abc',
            },
          },
        })
        const initialUserEvent: UserEvent = {
          eventId: 'test-1',
          timestamp: testUser.createdTimestamp,
          userId: testUser.userId,
          updatedConsumerUserAttributes: {
            userDetails: { name: { firstName: 'abc' } },
          },
        }
        const initialRiskData = await riskScoringService.handleUserUpdate({
          user: testUser,
          userEvent: initialUserEvent,
        })
        expect(initialRiskData).toEqual({
          kycRiskScore: 75,
          kycRiskLevel: 'HIGH',
        })
        const secondUserEvent: UserEvent = {
          eventId: 'test-2',
          timestamp: testUser.createdTimestamp + 10,
          userId: testUser.userId,
          updatedConsumerUserAttributes: {
            userDetails: { name: { firstName: 'abc1' } },
          },
        }
        const secondEventRiskData = await riskScoringService.handleUserUpdate({
          user: { ...testUser, userDetails: { name: { firstName: 'abc1' } } },
          userEvent: secondUserEvent,
        })
        expect(secondEventRiskData).toEqual({
          kycRiskScore: 25,
          kycRiskLevel: 'LOW',
        })
      })
    })
  })
  describe('Knock off risk factors', () => {
    describe('Only KRS score with one knock off factor', () => {
      let riskScoringService: RiskScoringV8Service
      const tenantId = getTestTenantId()
      beforeAll(async () => {
        const mongoDb = await getMongoDbClient()
        const dynamoDb = getDynamoDbClient()
        const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
        riskScoringService = new RiskScoringV8Service(
          tenantId,
          logicEvaluator,
          {
            mongoDb,
            dynamoDb,
          }
        )
        const tenantRepository = new TenantRepository(tenantId, {
          dynamoDb,
        })
        await tenantRepository.createOrUpdateTenantSettings({
          riskScoringCraEnabled: false,
        })
      })
      setUpRiskFactorsHook(tenantId, [
        getTestRiskFactor({
          id: 'RF1',
          type: 'CONSUMER_USER',
          riskLevelLogic: [
            {
              logic: {
                and: [
                  {
                    '==': [
                      { var: 'CONSUMER_USER:acquisitionChannel__SENDER' },
                      'PAID',
                    ],
                  },
                ],
              },
              riskLevel: 'LOW',
              riskScore: 25,
              weight: 1,
              overrideScore: true,
            },
          ],
        }),
        getTestRiskFactor({
          id: 'RF2',
          type: 'CONSUMER_USER',
          riskLevelLogic: [
            {
              logic: {
                and: [
                  {
                    '==': [
                      { var: 'CONSUMER_USER:kycStatusDetails-status__SENDER' },
                      'FAILED',
                    ],
                  },
                ],
              },
              riskLevel: 'MEDIUM',
              riskScore: 44,
              weight: 1,
            },
          ],
        }),
      ])
      test('Overrides KRS', async () => {
        const user = getTestUser({
          acquisitionChannel: 'PAID',
          kycStatusDetails: {
            status: 'FAILED',
          },
        })
        const result = await riskScoringService.handleUserUpdate({ user })
        expect(result).toEqual({
          kycRiskLevel: 'LOW',
          kycRiskScore: 25,
        })
        const krs = await riskScoringService.getKrsScore(user.userId)
        expect(krs?.factorScoreDetails).toEqual([
          {
            score: 25,
            weight: 1,
            hit: true,
            vars: [
              {
                direction: 'ORIGIN',
                value: {
                  'CONSUMER_USER:acquisitionChannel__SENDER': 'PAID',
                },
              },
            ],
            riskLevel: 'LOW',
            riskFactorId: 'RF1',
            overrideScore: true,
          },
          {
            score: 44,
            weight: 1,
            hit: true,
            vars: [
              {
                direction: 'ORIGIN',
                value: {
                  'CONSUMER_USER:kycStatusDetails-status__SENDER': 'FAILED',
                },
              },
            ],
            riskLevel: 'MEDIUM',
            riskFactorId: 'RF2',
          },
        ])
      })
    })
    describe('Only KRS score with multiple knock off factor', () => {
      let riskScoringService: RiskScoringV8Service
      const tenantId = getTestTenantId()
      beforeAll(async () => {
        const mongoDb = await getMongoDbClient()
        const dynamoDb = getDynamoDbClient()
        const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
        riskScoringService = new RiskScoringV8Service(
          tenantId,
          logicEvaluator,
          {
            mongoDb,
            dynamoDb,
          }
        )
        const tenantRepository = new TenantRepository(tenantId, {
          dynamoDb,
        })
        await tenantRepository.createOrUpdateTenantSettings({
          riskScoringCraEnabled: false,
        })
      })
      setUpRiskFactorsHook(tenantId, [
        getTestRiskFactor({
          id: 'RF1',
          type: 'CONSUMER_USER',
          riskLevelLogic: [
            {
              logic: {
                and: [
                  {
                    '==': [
                      { var: 'CONSUMER_USER:acquisitionChannel__SENDER' },
                      'PAID',
                    ],
                  },
                ],
              },
              riskLevel: 'LOW',
              riskScore: 25,
              weight: 1,
              overrideScore: true,
            },
          ],
        }),
        getTestRiskFactor({
          id: 'RF2',
          type: 'CONSUMER_USER',
          riskLevelLogic: [
            {
              logic: {
                and: [
                  {
                    '==': [
                      { var: 'CONSUMER_USER:kycStatusDetails-status__SENDER' },
                      'FAILED',
                    ],
                  },
                ],
              },
              riskLevel: 'MEDIUM',
              riskScore: 44,
              weight: 1,
              overrideScore: true,
            },
          ],
        }),
      ])
      test('Overrides KRS', async () => {
        const user = getTestUser({
          acquisitionChannel: 'PAID',
          kycStatusDetails: {
            status: 'FAILED',
          },
        })
        const result = await riskScoringService.handleUserUpdate({ user })
        expect(result).toEqual({
          kycRiskScore: 34.5,
          kycRiskLevel: 'LOW',
        })
        const krs = await riskScoringService.getKrsScore(user.userId)
        expect(krs?.factorScoreDetails).toEqual([
          {
            score: 25,
            weight: 1,
            hit: true,
            vars: [
              {
                direction: 'ORIGIN',
                value: {
                  'CONSUMER_USER:acquisitionChannel__SENDER': 'PAID',
                },
              },
            ],
            riskLevel: 'LOW',
            riskFactorId: 'RF1',
            overrideScore: true,
          },
          {
            score: 44,
            weight: 1,
            hit: true,
            vars: [
              {
                direction: 'ORIGIN',
                value: {
                  'CONSUMER_USER:kycStatusDetails-status__SENDER': 'FAILED',
                },
              },
            ],
            riskLevel: 'MEDIUM',
            riskFactorId: 'RF2',
            overrideScore: true,
          },
        ])
      })
    })
    describe('KRS and CRA score with one knock off factor', () => {
      let riskScoringService: RiskScoringV8Service
      const tenantId = getTestTenantId()
      beforeAll(async () => {
        const mongoDb = await getMongoDbClient()
        const dynamoDb = getDynamoDbClient()
        const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
        riskScoringService = new RiskScoringV8Service(
          tenantId,
          logicEvaluator,
          {
            mongoDb,
            dynamoDb,
          }
        )
        const tenantRepository = new TenantRepository(tenantId, {
          dynamoDb,
        })
        await tenantRepository.createOrUpdateTenantSettings({
          riskScoringCraEnabled: true,
        })
      })
      setUpRiskFactorsHook(tenantId, [
        getTestRiskFactor({
          id: 'RF1',
          type: 'CONSUMER_USER',
          riskLevelLogic: [
            {
              logic: {
                and: [
                  {
                    '==': [
                      { var: 'CONSUMER_USER:acquisitionChannel__SENDER' },
                      'PAID',
                    ],
                  },
                ],
              },
              riskLevel: 'LOW',
              riskScore: 25,
              weight: 1,
              overrideScore: true,
            },
          ],
        }),
        getTestRiskFactor({
          id: 'RF2',
          type: 'CONSUMER_USER',
          riskLevelLogic: [
            {
              logic: {
                and: [
                  {
                    '==': [
                      { var: 'CONSUMER_USER:kycStatusDetails-status__SENDER' },
                      'FAILED',
                    ],
                  },
                ],
              },
              riskLevel: 'MEDIUM',
              riskScore: 44,
              weight: 1,
            },
          ],
        }),
      ])
      test('Overrides KRS and CRA', async () => {
        const user = getTestUser({
          acquisitionChannel: 'GATHERING',
          kycStatusDetails: {
            status: 'FAILED',
          },
        })
        const result = await riskScoringService.handleUserUpdate({ user })
        expect(result).toEqual({
          kycRiskScore: 59.5,
          kycRiskLevel: 'MEDIUM',
          craRiskScore: 59.5,
          craRiskLevel: 'MEDIUM',
        })
        const krs = await riskScoringService.getKrsScore(user.userId)
        expect(krs?.factorScoreDetails).toEqual([
          {
            score: 75,
            weight: 1,
            hit: false,
            vars: [],
            riskLevel: 'HIGH',
            riskFactorId: 'RF1',
          },
          {
            score: 44,
            weight: 1,
            hit: true,
            vars: [
              {
                direction: 'ORIGIN',
                value: {
                  'CONSUMER_USER:kycStatusDetails-status__SENDER': 'FAILED',
                },
              },
            ],
            riskLevel: 'MEDIUM',
            riskFactorId: 'RF2',
          },
        ])

        const updatedUser: User = {
          ...user,
          acquisitionChannel: 'PAID',
        }
        const result2 = await riskScoringService.handleUserUpdate({
          user: updatedUser,
        })
        expect(result2).toEqual({
          kycRiskScore: 25,
          kycRiskLevel: 'LOW',
          craRiskScore: 25,
          craRiskLevel: 'LOW',
        })
      })
    })
    describe('KRS and CRA score with multiple knock off factor', () => {
      let riskScoringService: RiskScoringV8Service
      const tenantId = getTestTenantId()
      beforeAll(async () => {
        const mongoDb = await getMongoDbClient()
        const dynamoDb = getDynamoDbClient()
        const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
        riskScoringService = new RiskScoringV8Service(
          tenantId,
          logicEvaluator,
          {
            mongoDb,
            dynamoDb,
          }
        )
        const tenantRepository = new TenantRepository(tenantId, {
          dynamoDb,
        })
        await tenantRepository.createOrUpdateTenantSettings({
          riskScoringCraEnabled: true,
        })
      })
      setUpRiskFactorsHook(tenantId, [
        getTestRiskFactor({
          id: 'RF1',
          type: 'CONSUMER_USER',
          riskLevelLogic: [
            {
              logic: {
                and: [
                  {
                    '==': [
                      { var: 'CONSUMER_USER:acquisitionChannel__SENDER' },
                      'PAID',
                    ],
                  },
                ],
              },
              riskLevel: 'LOW',
              riskScore: 25,
              weight: 1,
              overrideScore: true,
            },
          ],
        }),
        getTestRiskFactor({
          id: 'RF2',
          type: 'CONSUMER_USER',
          riskLevelLogic: [
            {
              logic: {
                and: [
                  {
                    '==': [
                      { var: 'CONSUMER_USER:kycStatusDetails-status__SENDER' },
                      'FAILED',
                    ],
                  },
                ],
              },
              riskLevel: 'MEDIUM',
              riskScore: 44,
              weight: 1,
              overrideScore: true,
            },
          ],
        }),
      ])
      test('Overrides KRS and CRA', async () => {
        const user = getTestUser({
          acquisitionChannel: 'GATHERING',
          kycStatusDetails: {
            status: 'FAILED',
          },
        })
        const result = await riskScoringService.handleUserUpdate({ user })
        expect(result).toEqual({
          kycRiskScore: 44,
          kycRiskLevel: 'MEDIUM',
          craRiskScore: 44,
          craRiskLevel: 'MEDIUM',
        })
        const krs = await riskScoringService.getKrsScore(user.userId)
        expect(krs?.factorScoreDetails).toEqual([
          {
            score: 75,
            weight: 1,
            hit: false,
            vars: [],
            riskLevel: 'HIGH',
            riskFactorId: 'RF1',
          },
          {
            score: 44,
            weight: 1,
            hit: true,
            vars: [
              {
                direction: 'ORIGIN',
                value: {
                  'CONSUMER_USER:kycStatusDetails-status__SENDER': 'FAILED',
                },
              },
            ],
            riskLevel: 'MEDIUM',
            riskFactorId: 'RF2',
            overrideScore: true,
          },
        ])

        const updatedUser: User = {
          ...user,
          acquisitionChannel: 'PAID',
        }
        const result2 = await riskScoringService.handleUserUpdate({
          user: updatedUser,
        })
        expect(result2).toEqual({
          kycRiskScore: 34.5,
          kycRiskLevel: 'LOW',
          craRiskScore: 34.5,
          craRiskLevel: 'LOW',
        })
      })
    })
  })
  describe('V8 Risk Scoring Algorithms', () => {
    const tenantId = getTestTenantId()
    describe('Calculation for Transaction', () => {
      test('should calculate new drs score using ars legacy moving avg', async () => {
        const mongoDb = await getMongoDbClient()
        const dynamoDb = getDynamoDbClient()
        const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
        const riskScoringService = new RiskScoringV8Service(
          tenantId,
          logicEvaluator,
          {
            mongoDb,
            dynamoDb,
          }
        )
        const newDrsScore1 = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_LEGACY_MOVING_AVG',
          },
          oldDrsScore: undefined,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
        })
        expect(newDrsScore1).toBe(15)
        const newDrsScore2 = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_LEGACY_MOVING_AVG',
          },
          oldDrsScore: 10,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
        })
        expect(newDrsScore2).toBe(10)
      })
      test('should calculate new drs score using ars simple avg', async () => {
        const mongoDb = await getMongoDbClient()
        const dynamoDb = getDynamoDbClient()
        const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
        const riskScoringService = new RiskScoringV8Service(
          tenantId,
          logicEvaluator,
          {
            mongoDb,
            dynamoDb,
          }
        )
        const newDrsScore = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_SIMPLE_AVG',
          },
          oldDrsScore: undefined,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
        })
        expect(newDrsScore).toBe(15)
        const newDrsScore2 = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_SIMPLE_AVG',
          },
          oldDrsScore: 10,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
        })
        expect(newDrsScore2).toBe(15)
      })
      test('should calculate new drs score using ars custom', async () => {
        const mongoDb = await getMongoDbClient()
        const dynamoDb = getDynamoDbClient()
        const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
        const riskScoringService = new RiskScoringV8Service(
          tenantId,
          logicEvaluator,
          {
            mongoDb,
            dynamoDb,
          }
        )
        const newDrsScore = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_CUSTOM',
            krsWeight: 0.4,
            avgArsWeight: 0.6,
          },
          oldDrsScore: undefined,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
        })
        expect(newDrsScore).toBe(14)
        const newDrsScore2 = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_CUSTOM',
            krsWeight: 0.4,
            avgArsWeight: 0.6,
          },
          oldDrsScore: 10,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
        })
        expect(newDrsScore2).toBe(14)
      })
    })

    describe('User Events', () => {
      let riskScoringService: RiskScoringV8Service

      beforeAll(async () => {
        const mongoDb = await getMongoDbClient()
        const dynamoDb = getDynamoDbClient()
        const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
        riskScoringService = new RiskScoringV8Service(
          tenantId,
          logicEvaluator,
          {
            mongoDb,
            dynamoDb,
          }
        )
      })

      test('should calculate new drs score using legacy moving avg for user event', () => {
        const newDrsScore1 = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_LEGACY_MOVING_AVG',
          },
          oldDrsScore: undefined,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
          userEvent: true,
        })
        expect(newDrsScore1).toBe(20)

        const newDrsScore2 = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_LEGACY_MOVING_AVG',
          },
          oldDrsScore: 30,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
          userEvent: true,
        })
        expect(newDrsScore2).toBe(25)
      })

      test('should calculate new drs score using simple avg for user event', () => {
        const newDrsScore1 = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_SIMPLE_AVG',
          },
          oldDrsScore: undefined,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
          userEvent: true,
        })
        expect(newDrsScore1).toBe(15)

        const newDrsScore2 = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_SIMPLE_AVG',
          },
          oldDrsScore: 30,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
          userEvent: true,
        })
        expect(newDrsScore2).toBe(15)
      })

      test('should calculate new drs score using custom formula for user event', () => {
        const newDrsScore1 = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_CUSTOM',
            krsWeight: 0.6,
            avgArsWeight: 0.4,
          },
          oldDrsScore: undefined,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
          userEvent: true,
        })
        expect(newDrsScore1).toBe(16)

        const newDrsScore2 = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_CUSTOM',
            krsWeight: 0.6,
            avgArsWeight: 0.4,
          },
          oldDrsScore: 30,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
          userEvent: true,
        })
        expect(newDrsScore2).toBe(16)
      })
    })
  })

  describe('Exclusion of risk factors', () => {
    let riskScoringService: RiskScoringV8Service
    const tenantId = getTestTenantId()
    beforeEach(async () => {
      const mongoDb = await getMongoDbClient()
      const dynamoDb = getDynamoDbClient()
      const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
      riskScoringService = new RiskScoringV8Service(tenantId, logicEvaluator, {
        mongoDb,
        dynamoDb,
      })
    })
    setUpRiskFactorsHook(tenantId, [
      getTestRiskFactor({
        id: 'RF1',
        type: 'CONSUMER_USER',
        riskLevelLogic: [
          {
            logic: {
              and: [
                {
                  '==': [
                    { var: 'CONSUMER_USER:acquisitionChannel__SENDER' },
                    'PAID',
                  ],
                },
              ],
            },
            riskLevel: 'VERY_LOW',
            riskScore: 0,
            weight: 1,
            excludeFactor: false,
          },
          {
            logic: {
              and: [
                {
                  '==': [
                    { var: 'CONSUMER_USER:acquisitionChannel__SENDER' },
                    'REFERRAL',
                  ],
                },
              ],
            },
            riskLevel: 'VERY_LOW',
            riskScore: 0,
            weight: 1,
            excludeFactor: true,
          },
        ],
      }),
      getTestRiskFactor({
        id: 'RF2',
        type: 'CONSUMER_USER',
        riskLevelLogic: [
          {
            logic: {
              and: [
                {
                  '==': [
                    { var: 'CONSUMER_USER:kycStatusDetails-status__SENDER' },
                    'FAILED',
                  ],
                },
              ],
            },
            riskLevel: 'MEDIUM',
            riskScore: 44,
            weight: 1,
          },
        ],
      }),
    ])
    test('Include risk factor with 0 score (from weighted score)', async () => {
      const user = getTestUser({
        acquisitionChannel: 'PAID',
        kycStatusDetails: {
          status: 'FAILED',
        },
      })
      const result = await riskScoringService.handleUserUpdate({ user })

      // Verify that both factors are included in the calculation
      // Factor 1: score 0, weight 1 (not excluded)
      // Factor 2: score 44, weight 1
      // Expected weighted average: (0*1 + 44*1)/(1+1) = 22
      expect(result).toEqual({
        kycRiskScore: 22,
        kycRiskLevel: 'LOW',
        craRiskLevel: 'LOW',
        craRiskScore: 22,
      })

      // Verify both factors are in the details
      const krs = await riskScoringService.getKrsScore(user.userId)
      expect(krs?.factorScoreDetails?.length).toBe(2)

      // Verify the scores are as expected
      const scores = krs?.factorScoreDetails
        ?.map((detail) => detail.score)
        .sort()
      expect(scores).toEqual([0, 44])
    })

    test('Exclude risk factor with 0 score (From weighted score)', async () => {
      const user = getTestUser({
        acquisitionChannel: 'REFERRAL',
        kycStatusDetails: {
          status: 'FAILED',
        },
      })
      const result = await riskScoringService.handleUserUpdate({ user })

      // Verify that the factor with excludeFactor=true is not included in calculation
      // Factor 1 (excluded): score 0, weight 1, but excluded
      // Factor 2: score 44, weight 1
      // Expected: only Factor 2 is used, so score is 44
      expect(result).toEqual({
        kycRiskScore: 44,
        kycRiskLevel: 'MEDIUM',
        craRiskLevel: 'MEDIUM',
        craRiskScore: 44,
      })

      // Verify only one factor is in the details (the excluded one is filtered out)
      const krs = await riskScoringService.getKrsScore(user.userId)
      expect(krs?.factorScoreDetails?.length).toBe(1)

      // Verify the included factor has the correct score
      expect(krs?.factorScoreDetails?.[0].score).toBe(44)
      expect(krs?.factorScoreDetails?.[0].riskFactorId).toBe('RF2')
    })
  })
})
describe('complete risk scoring flow (DRS)', () => {
  let riskScoringService: RiskScoringV8Service
  const tenantId = getTestTenantId()

  const algorithms = [
    { type: 'FORMULA_SIMPLE_AVG' },
    { type: 'FORMULA_LEGACY_MOVING_AVG' },
    { type: 'FORMULA_CUSTOM', krsWeight: 0.6, avgArsWeight: 0.4 },
  ]

  const results = [
    [
      {
        craRiskLevel: 'HIGH',
        craRiskScore: 60,
        kycRiskScore: 60,
        kycRiskLevel: 'HIGH',
      },
      {
        craRiskLevel: 'MEDIUM',
        craRiskScore: 40,
        kycRiskScore: 40,
        kycRiskLevel: 'MEDIUM',
      },
      {
        trsScore: 10,
        trsRiskLevel: 'VERY_LOW',
        originUserCraRiskScore: 35,
        originUserCraRiskLevel: 'LOW',
        destinationUserCraRiskScore: 25,
        destinationUserCraRiskLevel: 'LOW',
      },
      {
        trsScore: 20,
        trsRiskLevel: 'LOW',
        originUserCraRiskScore: 37.5,
        originUserCraRiskLevel: 'LOW',
        destinationUserCraRiskScore: 27.5,
        destinationUserCraRiskLevel: 'LOW',
      },
      {
        craRiskLevel: 'MEDIUM',
        craRiskScore: 45,
        kycRiskScore: 75,
        kycRiskLevel: 'HIGH',
      },
    ],
    [
      {
        craRiskLevel: 'HIGH',
        craRiskScore: 60,
        kycRiskScore: 60,
        kycRiskLevel: 'HIGH',
      },
      {
        craRiskLevel: 'MEDIUM',
        craRiskScore: 40,
        kycRiskScore: 40,
        kycRiskLevel: 'MEDIUM',
      },
      {
        trsScore: 10,
        trsRiskLevel: 'VERY_LOW',
        originUserCraRiskScore: 35,
        originUserCraRiskLevel: 'LOW',
        destinationUserCraRiskScore: 25,
        destinationUserCraRiskLevel: 'LOW',
      },
      {
        trsScore: 20,
        trsRiskLevel: 'LOW',
        originUserCraRiskScore: 27.5,
        originUserCraRiskLevel: 'LOW',
        destinationUserCraRiskScore: 22.5,
        destinationUserCraRiskLevel: 'LOW',
      },
      {
        craRiskLevel: 'MEDIUM',
        craRiskScore: 51.25,
        kycRiskScore: 75,
        kycRiskLevel: 'HIGH',
      },
    ],
    [
      {
        craRiskLevel: 'HIGH',
        craRiskScore: 60,
        kycRiskScore: 60,
        kycRiskLevel: 'HIGH',
      },
      {
        craRiskLevel: 'MEDIUM',
        craRiskScore: 40,
        kycRiskScore: 40,
        kycRiskLevel: 'MEDIUM',
      },
      {
        trsScore: 10,
        trsRiskLevel: 'VERY_LOW',
        originUserCraRiskScore: 40,
        originUserCraRiskLevel: 'MEDIUM',
        destinationUserCraRiskScore: 28,
        destinationUserCraRiskLevel: 'LOW',
      },
      {
        trsScore: 20,
        trsRiskLevel: 'LOW',
        originUserCraRiskScore: 42,
        originUserCraRiskLevel: 'MEDIUM',
        destinationUserCraRiskScore: 30,
        destinationUserCraRiskLevel: 'LOW',
      },
      {
        craRiskLevel: 'MEDIUM',
        craRiskScore: 51,
        kycRiskScore: 75,
        kycRiskLevel: 'HIGH',
      },
    ],
  ]

  algorithms.forEach((algorithm, index) => {
    const TEST_USER_1 = getTestUser({
      userId: `USER4_${index}`,
      acquisitionChannel: 'PAID',
    })
    const TEST_USER_2 = getTestUser({
      userId: `USER5_${index}`,
      acquisitionChannel: 'REFERRAL',
    })
    describe(`Using ${algorithm.type}`, () => {
      beforeAll(async () => {
        const mongoDb = await getMongoDbClient()
        const dynamoDb = getDynamoDbClient()
        const tenantService = new TenantService(tenantId, {
          mongoDb,
          dynamoDb,
        })
        await tenantService.createOrUpdateTenantSettings({
          riskScoringCraEnabled: true,
          riskScoringAlgorithm: algorithm as
            | FormulaCustom
            | FormulaLegacyMovingAvg
            | FormulaSimpleAvg,
        })
      })

      beforeAll(async () => {
        const mongoDb = await getMongoDbClient()
        const dynamoDb = getDynamoDbClient()
        const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
        riskScoringService = new RiskScoringV8Service(
          tenantId,
          logicEvaluator,
          {
            mongoDb,
            dynamoDb,
          }
        )
      })

      setUpUsersHooks(tenantId, [TEST_USER_1, TEST_USER_2], false)
      setUpRiskFactorsHook(tenantId, [
        getTestRiskFactor({
          id: 'RF1',
          riskLevelLogic: [
            {
              logic: {
                and: [{ '==': [{ var: 'TRANSACTION:type' }, 'DEPOSIT'] }],
              },
              riskLevel: 'VERY_LOW',
              riskScore: 10,
              weight: 1,
            },
            {
              logic: {
                and: [{ '==': [{ var: 'TRANSACTION:type' }, 'REFUND'] }],
              },
              riskLevel: 'LOW',
              riskScore: 20,
              weight: 1,
            },
          ],
        }),
        getTestRiskFactor({
          id: 'RF2',
          type: 'CONSUMER_USER',
          riskLevelLogic: [
            {
              logic: {
                and: [
                  {
                    '==': [
                      { var: 'CONSUMER_USER:acquisitionChannel__SENDER' },
                      'PAID',
                    ],
                  },
                ],
              },
              riskLevel: 'HIGH',
              riskScore: 60,
              weight: 1,
            },
            {
              logic: {
                and: [
                  {
                    '==': [
                      { var: 'CONSUMER_USER:acquisitionChannel__SENDER' },
                      'REFERRAL',
                    ],
                  },
                ],
              },
              riskLevel: 'MEDIUM',
              riskScore: 40,
              weight: 1,
            },
          ],
        }),
      ])

      test('should calculate initial KRS score', async () => {
        const result1 = await riskScoringService.handleUserUpdate({
          user: TEST_USER_1,
        })
        expect(result1).toEqual(results[index][0])
        const result2 = await riskScoringService.handleUserUpdate({
          user: getTestUser({
            userId: TEST_USER_2.userId,
            acquisitionChannel: 'REFERRAL',
          }),
        })
        expect(result2).toEqual(results[index][1])
      })

      test('should calculate first new Drs for transaction', async () => {
        const result3 = await riskScoringService.handleTransaction(
          getTestTransaction({
            originUserId: TEST_USER_1.userId,
            destinationUserId: TEST_USER_2.userId,
            transactionId: 'TEST',
            type: 'DEPOSIT',
          }),
          [],
          TEST_USER_1,
          TEST_USER_2
        )
        expect(result3).toEqual(results[index][2])
        const result4 = await riskScoringService.handleTransaction(
          getTestTransaction({
            originUserId: TEST_USER_1.userId,
            destinationUserId: TEST_USER_2.userId,
            transactionId: 'TEST',
            type: 'REFUND',
          }),
          [],
          TEST_USER_1,
          TEST_USER_2
        )
        expect(result4).toEqual(results[index][3])
      })

      test('should calculate new Drs for user event', async () => {
        const userRepository = new UserRepository(tenantId, {
          mongoDb: await getMongoDbClient(),
          dynamoDb: getDynamoDbClient(),
        })
        await userRepository.saveConsumerUser({
          ...TEST_USER_1,
          acquisitionChannel: 'OFFLINE',
        })
        const result5 = await riskScoringService.handleUserUpdate({
          user: {
            ...TEST_USER_1,
            acquisitionChannel: 'OFFLINE',
          },
        })
        expect(result5).toEqual(results[index][4])
      })
    })
  })
  describe('Locking and unlocking DRS and manual update', () => {
    beforeAll(async () => {
      const mongoDb = await getMongoDbClient()
      const dynamoDb = getDynamoDbClient()
      const tenantService = new TenantService(tenantId, {
        mongoDb,
        dynamoDb,
      })
      await tenantService.createOrUpdateTenantSettings({
        riskScoringCraEnabled: true,
        riskScoringAlgorithm: {
          type: 'FORMULA_SIMPLE_AVG',
        },
      })
    })
    const riskScoringService = new RiskScoringV8Service(
      tenantId,
      new LogicEvaluator(tenantId, getDynamoDbClient()),
      {
        dynamoDb: getDynamoDbClient(),
      }
    )
    setUpRiskFactorsHook(tenantId, [
      getTestRiskFactor({
        id: 'RF1',
        type: 'CONSUMER_USER',
        riskLevelLogic: [
          {
            logic: {
              and: [
                {
                  '==': [
                    { var: 'CONSUMER_USER:kycStatusDetails-status__SENDER' },
                    'SUCCESSFUL',
                  ],
                },
              ],
            },
            riskLevel: 'LOW',
            riskScore: 30,
            weight: 1,
          },
        ],
      }),
    ])
    const TEST_USER_1 = getTestUser({
      userId: 'USER6',
      acquisitionChannel: 'PAID',
      kycStatusDetails: {
        status: 'FAILED',
      },
    })
    test('should lock and unlock DRS for manual risk level update', async () => {
      const result = await riskScoringService.handleUserUpdate({
        user: TEST_USER_1,
        manualRiskLevel: 'HIGH',
        isDrsUpdatable: false,
      })

      expect(result).toEqual({
        craRiskLevel: 'HIGH',
        craRiskScore: 70,
        kycRiskScore: 75,
        kycRiskLevel: 'HIGH',
      })

      const result2 = await riskScoringService.handleUserUpdate({
        user: TEST_USER_1,
        manualRiskLevel: 'MEDIUM',
      })
      expect(result2).toEqual({
        // No change as it is locked
        craRiskLevel: 'HIGH',
        craRiskScore: 70,
        kycRiskScore: 75,
        kycRiskLevel: 'HIGH',
      })

      const result3 = await riskScoringService.handleUserUpdate({
        user: TEST_USER_1,
        manualRiskLevel: 'LOW',
        isDrsUpdatable: true,
      })
      expect(result3).toEqual({
        craRiskLevel: 'LOW',
        craRiskScore: 30,
        kycRiskScore: 75,
        kycRiskLevel: 'HIGH',
      })
    })
    test('should not update DRS for user if it is not updatable', async () => {
      const result = await riskScoringService.handleUserUpdate({
        user: TEST_USER_1,
        manualRiskLevel: undefined,
        isDrsUpdatable: false,
      })
      expect(result).toEqual({
        craRiskLevel: 'HIGH',
        craRiskScore: 75,
        kycRiskScore: 75,
        kycRiskLevel: 'HIGH',
      })
      const result2 = await riskScoringService.handleUserUpdate({
        user: {
          ...TEST_USER_1,
          kycStatusDetails: {
            status: 'SUCCESSFUL',
          },
        },
      })
      expect(result2).toEqual({
        // CRA locked
        kycRiskLevel: 'LOW',
        kycRiskScore: 30,
        craRiskLevel: 'HIGH',
        craRiskScore: 75,
      })
      const result3 = await riskScoringService.handleUserUpdate({
        user: {
          ...TEST_USER_1,
          kycStatusDetails: {
            status: 'SUCCESSFUL',
          },
        },
        manualRiskLevel: undefined,
        isDrsUpdatable: true,
      })
      expect(result3).toEqual({
        // CRA unlocked
        kycRiskLevel: 'LOW',
        kycRiskScore: 30,
        craRiskLevel: 'LOW',
        craRiskScore: 30,
      })
    })
  })
  describe('Locking and unlocking KRS and manual update', () => {
    beforeAll(async () => {
      const mongoDb = await getMongoDbClient()
      const dynamoDb = getDynamoDbClient()
      const tenantService = new TenantService(tenantId, {
        mongoDb,
        dynamoDb,
      })
      await tenantService.createOrUpdateTenantSettings({
        riskScoringCraEnabled: true,
        riskScoringAlgorithm: {
          type: 'FORMULA_SIMPLE_AVG',
        },
      })
    })
    const riskScoringService = new RiskScoringV8Service(
      tenantId,
      new LogicEvaluator(tenantId, getDynamoDbClient()),
      {
        dynamoDb: getDynamoDbClient(),
      }
    )
    setUpRiskFactorsHook(tenantId, [
      getTestRiskFactor({
        id: 'RF1',
        type: 'CONSUMER_USER',
        riskLevelLogic: [
          {
            logic: {
              and: [
                {
                  '==': [
                    { var: 'CONSUMER_USER:kycStatusDetails-status__SENDER' },
                    'SUCCESSFUL',
                  ],
                },
              ],
            },
            riskLevel: 'LOW',
            riskScore: 30,
            weight: 1,
          },
        ],
      }),
    ])
    const TEST_USER_1 = getTestUser({
      userId: 'USER6',
      acquisitionChannel: 'PAID',
      kycStatusDetails: {
        status: 'FAILED',
      },
    })
    test('should lock and unlock KRS for manual KRS risk level update', async () => {
      const result = await riskScoringService.handleUserUpdate({
        user: TEST_USER_1,
        manualKrsRiskLevel: 'HIGH',
        lockKrs: true,
      })
      expect(result).toEqual({
        craRiskLevel: 'HIGH',
        craRiskScore: 70,
        kycRiskScore: 70,
        kycRiskLevel: 'HIGH',
      })

      const result2 = await riskScoringService.handleUserUpdate({
        user: TEST_USER_1,
        manualKrsRiskLevel: 'VERY_LOW',
      })
      expect(result2).toEqual({
        // No change as it is locked
        craRiskLevel: 'HIGH',
        craRiskScore: 70,
        kycRiskScore: 70,
        kycRiskLevel: 'HIGH',
      })

      const result3 = await riskScoringService.handleUserUpdate({
        user: TEST_USER_1,
        manualKrsRiskLevel: 'VERY_LOW',
        lockKrs: false,
      })
      expect(result3).toEqual({
        craRiskLevel: 'VERY_LOW',
        craRiskScore: 10,
        kycRiskScore: 10,
        kycRiskLevel: 'VERY_LOW',
      })
    })
    test('should not update KRS for user if it is not updatable', async () => {
      const result = await riskScoringService.handleUserUpdate({
        user: TEST_USER_1,
        lockKrs: true,
      })
      expect(result).toEqual({
        craRiskLevel: 'HIGH',
        craRiskScore: 75,
        kycRiskScore: 75,
        kycRiskLevel: 'HIGH',
      })
      const result2 = await riskScoringService.handleUserUpdate({
        user: {
          ...TEST_USER_1,
          kycStatusDetails: {
            status: 'SUCCESSFUL',
          },
        },
      })
      expect(result2).toEqual({
        // KRS is locked
        kycRiskLevel: 'HIGH',
        kycRiskScore: 75,
        craRiskLevel: 'HIGH',
        craRiskScore: 75,
      })
      const result3 = await riskScoringService.handleUserUpdate({
        user: {
          ...TEST_USER_1,
          kycStatusDetails: {
            status: 'SUCCESSFUL',
          },
        },
        lockKrs: false,
      })
      expect(result3).toEqual({
        // KRS is unlocked
        kycRiskLevel: 'LOW',
        kycRiskScore: 30,
        craRiskLevel: 'LOW',
        craRiskScore: 30,
      })
    })
  })
})
