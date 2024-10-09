import { UserService } from '..'
import { TransactionAmountRuleParameters } from '@/services/rules-engine/transaction-rules/transaction-amount'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  bulkVerifyTransactions,
  setUpRulesHooks,
} from '@/test-utils/rule-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  getTestBusiness,
  getTestUser,
  setUpUsersHooks,
} from '@/test-utils/user-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import * as Context from '@/core/utils/context'
import { getS3Client } from '@/utils/s3'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { UserEventRepository } from '@/services/rules-engine/repositories/user-event-repository'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { UserManagementService } from '@/services/rules-engine/user-rules-engine-service'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { withFeatureHook } from '@/test-utils/feature-test-utils'

dynamoDbSetupHook()

const getContextMocker = jest.spyOn(Context, 'getContext')

beforeAll(() => {
  getContextMocker.mockReturnValue({
    user: { id: 'test', role: 'ADMIN' },
  })
})

describe('Advanced Rule Options Tests', () => {
  const tenantId = getTestTenantId()
  withFeatureHook(['RULES_ENGINE_V8'])

  setUpRulesHooks(tenantId, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transaction-amount',
      defaultParameters: {
        transactionAmountThreshold: { USD: 1000, EUR: 1000 },
      } as TransactionAmountRuleParameters,
      action: 'FLAG',
      id: 'test-rule',
      triggersOnHit: {
        usersToCheck: 'ALL',
        kycStatusDetails: {
          reason: 'Test 1 Kyc',
          status: 'FAILED',
          description: 'Test Description Kyc Test Rule',
        },
        userStateDetails: {
          reason: 'Test 2',
          state: 'ACTIVE',
          description: 'Test Description User State Test Rule',
        },
        pepStatus: {
          isPepHit: true,
          pepRank: 'LEVEL_1',
        },
        tags: [
          {
            key: 'test-tag',
            value: 'test-value',
          },
        ],
      },
    },
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transaction-amount',
      id: 'test-rule-2',
      defaultParameters: {
        transactionAmountThreshold: { USD: 1000, EUR: 1000 },
      } as TransactionAmountRuleParameters,
      action: 'FLAG',
      triggersOnHit: {
        usersToCheck: 'ALL',
        kycStatusDetails: {
          reason: 'Test 1',
          status: 'SUCCESSFUL',
          description: 'Test Description',
        },
        userStateDetails: {
          reason: 'Test 2',
          state: 'UNACCEPTABLE',
          description: 'Test Description User State',
        },
      },
    },
    {
      type: 'USER',
      id: 'test-rule-3',
      ruleImplementationName: '',
      defaultLogic: {
        and: [
          {
            '==': [
              { var: 'CONSUMER_USER:userDetails-name-firstName__SENDER' },
              'TESTER',
            ],
          },
        ],
      },
      action: 'FLAG',
      triggersOnHit: {
        usersToCheck: 'ALL',
        tags: [
          {
            key: 'test-tag',
            value: 'test-value',
          },
        ],
      },
    },
  ])

  const user1 = getTestUser({
    userId: 'user1',
    tags: [
      {
        key: 'test-tag',
        value: 'test--before-value',
      },
    ],
  })
  const user2 = getTestUser({
    userId: 'user2',
    userDetails: {
      name: {
        firstName: 'TESTER',
      },
    },
    tags: undefined,
  })

  const business1 = getTestBusiness({
    userId: 'business1',
    tags: [],
  })

  setUpUsersHooks(tenantId, [user1, business1])

  it('should change user state (transaction rule)', async () => {
    const dynamoDb = getDynamoDbClient(undefined, { retry: true })
    const mongoDb = await getMongoDbClient()
    const userRepo = new UserRepository(tenantId, {
      dynamoDb,
      mongoDb,
    })
    const transactionPayload = getTestTransaction({
      originUserId: 'user1',
      destinationUserId: 'business1',
      originAmountDetails: {
        transactionAmount: 2000,
        transactionCurrency: 'USD',
      },
      destinationAmountDetails: {
        transactionAmount: 2000,
        transactionCurrency: 'USD',
      },
    })

    const data = await bulkVerifyTransactions(tenantId, [transactionPayload])
    const tranasctionId = data[0].transactionId
    const transactionRepository = new DynamoDbTransactionRepository(
      tenantId,
      dynamoDb
    )
    const transaction = await transactionRepository.getTransactionById(
      tranasctionId
    )
    const userService = new UserService(
      tenantId,
      { dynamoDb, mongoDb },
      getS3Client(),
      '',
      ''
    )

    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })

    const ruleInstances = (await ruleInstanceRepository.getActiveRuleInstances(
      'TRANSACTION'
    )) as RuleInstance[]

    const preUser = await userRepo.getMongoUser('user1')
    const preBusiness = await userRepo.getMongoUser('business1')

    jest
      .spyOn(UserEventRepository.prototype, 'saveUserEvent')
      .mockResolvedValue('test')

    await userService.handleUserStatusUpdateTrigger(
      transaction?.hitRules as HitRulesDetails[],
      ruleInstances,
      preUser,
      preBusiness
    )

    const user = await userRepo.getConsumerUser('user1')

    expect(user?.kycStatusDetails).toEqual({
      reason: 'Test 1 Kyc',
      status: 'FAILED',
      description: 'Test Description Kyc Test Rule',
    })
    expect(user?.userStateDetails).toEqual({
      reason: 'Test 2',
      state: 'UNACCEPTABLE',
      description: 'Test Description User State',
    })
    expect(user?.pepStatus).toEqual([{ isPepHit: true, pepRank: 'LEVEL_1' }])
    expect(user?.tags).toEqual([{ key: 'test-tag', value: 'test-value' }])
    const business = await userRepo.getBusinessUser('business1')
    const mongoBusiness = await userRepo.getMongoUser('business1')

    expect(business?.tags).toEqual([{ key: 'test-tag', value: 'test-value' }])
    const body = mongoBusiness?.comments?.[0]?.body.concat(
      mongoBusiness?.comments?.[1]?.body
    )

    expect(body).toEqual(
      expect.stringContaining(
        `Rule test-rule(${
          ruleInstances.find((rule) => rule.ruleId === 'test-rule')?.id
        }) is hit and KYC status updated to FAILED`
      )
    )

    expect(body).toEqual(
      expect.stringContaining(
        `Rule test-rule-2(${
          ruleInstances.find((rule) => rule.ruleId === 'test-rule-2')?.id
        }) is hit and User status updated to UNACCEPTABLE`
      )
    )

    expect(body).toEqual(
      expect.stringContaining('User state update reason: Test 2')
    )
    expect(body).toEqual(
      expect.stringContaining(
        'User state update description: Test Description User State'
      )
    )
    expect(body).toEqual(
      expect.stringContaining('KYC status update reason: Test 1 Kyc')
    )
    expect(body).toEqual(
      expect.stringContaining(
        'KYC status update description: Test Description Kyc Test Rule'
      )
    )
    expect(body).toEqual(
      expect.stringContaining(
        'User API tags updated due to hit of rule test-rule.1'
      )
    )

    expect(business?.kycStatusDetails).toEqual({
      reason: 'Test 1 Kyc',
      status: 'FAILED',
      description: 'Test Description Kyc Test Rule',
    })

    expect(business?.userStateDetails).toEqual({
      reason: 'Test 2',
      state: 'UNACCEPTABLE',
      description: 'Test Description User State',
    })
  }, 180000)
  test('should update user tags (user rule hit)', async () => {
    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const userManagementService = new UserManagementService(
      tenantId,
      dynamoDb,
      mongoDb,
      logicEvaluator
    )
    const result = await userManagementService.verifyUser(user2, 'CONSUMER')
    const userService = new UserService(
      tenantId,
      { dynamoDb, mongoDb },
      getS3Client(),
      '',
      ''
    )
    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })

    const ruleInstances = (await ruleInstanceRepository.getActiveRuleInstances(
      'USER'
    )) as RuleInstance[]
    const userRepository = new UserRepository(tenantId, {
      dynamoDb,
      mongoDb,
    })
    await userRepository.saveUserMongo({ ...user1, type: 'CONSUMER' })
    await userService.handleUserStatusUpdateTrigger(
      result.hitRules ?? [],
      ruleInstances,
      user2 as InternalUser,
      null
    )
    const updatedUser = await userRepository.getConsumerUser(user2.userId)
    expect(updatedUser?.tags).toEqual([
      {
        key: 'test-tag',
        value: 'test-value',
      },
    ])
  })
})
