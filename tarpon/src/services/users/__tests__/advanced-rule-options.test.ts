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
import { TransactionWithRulesResult } from '@/@types/openapi-internal/TransactionWithRulesResult'
import * as Context from '@/core/utils/context'
import { getS3Client } from '@/utils/s3'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { FLAGRIGHT_SYSTEM_USER } from '@/services/alerts/repository'
import { UserEventRepository } from '@/services/rules-engine/repositories/user-event-repository'

dynamoDbSetupHook()

const getContextMocker = jest.spyOn(Context, 'getContext')

beforeAll(() => {
  getContextMocker.mockReturnValue({
    user: { id: 'test', role: 'ADMIN' },
  })
})

describe('Advanced Rule Options Tests', () => {
  const tenantId = getTestTenantId()

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
  ])

  const user1 = getTestUser({
    userId: 'user1',
  })

  const business1 = getTestBusiness({
    userId: 'business1',
  })

  setUpUsersHooks(tenantId, [user1, business1])

  it('should change user state', async () => {
    const dynamoDb = getDynamoDbClient()
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

    await userService.handleTransactionUserStatusUpdateTrigger(
      transaction as TransactionWithRulesResult,
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

    const business = await userRepo.getBusinessUser('business1')
    const mongoBusiness = await userRepo.getMongoUser('business1')

    expect(mongoBusiness?.comments).toMatchObject([
      {
        body:
          `Rule test-rule(${
            ruleInstances.find((rule) => rule.ruleId === 'test-rule')?.id
          }) is hit and KYC status updated to FAILED and Rule test-rule-2(${
            ruleInstances.find((rule) => rule.ruleId === 'test-rule-2')?.id
          }) is hit and User status updated to UNACCEPTABLE` +
          '\nUser state update reason: Test 2\n' +
          'User state update description: Test Description User State\n' +
          'KYC status update reason: Test 1 Kyc' +
          '\nKYC status update description: Test Description Kyc Test Rule',
        userId: FLAGRIGHT_SYSTEM_USER,
        files: [],
      },
    ])

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
  })
})
