import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { CaseCreationService } from '@/lambdas/console-api-case/services/case-creation-service'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoClient } from '@/test-utils/mongo-test-utils'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  bulkVerifyTransactions,
  setUpRulesHooks,
} from '@/test-utils/rule-test-utils'
import {
  getTestUser,
  setUpConsumerUsersHooks,
} from '@/test-utils/user-test-utils'
import { Case } from '@/@types/openapi-internal/Case'

dynamoDbSetupHook()

async function getService(tenantId: string) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoClient()
  const caseRepository = new CaseRepository(tenantId, {
    mongoDb,
  })
  const userRepository = new UserRepository(tenantId, {
    dynamoDb,
    mongoDb,
  })
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })
  const transactionRepository = new TransactionRepository(tenantId, {
    mongoDb,
    dynamoDb,
  })
  const caseCreationService = new CaseCreationService(
    caseRepository,
    userRepository,
    ruleInstanceRepository,
    transactionRepository
  )
  return caseCreationService
}

const TEST_USER_1 = getTestUser()
const TEST_USER_2 = getTestUser()

describe('User cases', () => {
  describe('Run #1', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setup(TEST_TENANT_ID)

    test('By origin user, no prior cases', async () => {
      const caseCreationService = await getService(TEST_TENANT_ID)

      const transaction = getTestTransaction({
        originUserId: TEST_USER_1.userId,
        destinationUserId: undefined,
      })

      const results = await bulkVerifyTransactions(TEST_TENANT_ID, [
        transaction,
      ])
      expect(results.length).not.toEqual(0)
      const [result] = results

      const cases = await caseCreationService.handleTransaction({
        ...transaction,
        ...result,
      })
      expect(cases.length).toEqual(1)
      expectUserCase(cases, {
        originUserId: TEST_USER_1.userId,
      })
    })
  })

  describe('Run #2', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setup(TEST_TENANT_ID)
    test('By destination user, no prior cases', async () => {
      const caseCreationService = await getService(TEST_TENANT_ID)

      const transaction = getTestTransaction({
        originUserId: undefined,
        destinationUserId: TEST_USER_1.userId,
      })

      const results = await bulkVerifyTransactions(TEST_TENANT_ID, [
        transaction,
      ])
      expect(results.length).not.toEqual(0)
      const [result] = results

      const cases = await caseCreationService.handleTransaction({
        ...transaction,
        ...result,
      })
      expect(cases.length).toEqual(1)
      expectUserCase(cases, {
        destinationUserId: TEST_USER_1.userId,
      })
    })
  })

  describe('Run #3', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setup(TEST_TENANT_ID)
    test('Both users, no prior cases', async () => {
      const caseCreationService = await getService(TEST_TENANT_ID)

      const transaction = getTestTransaction({
        originUserId: TEST_USER_1.userId,
        destinationUserId: TEST_USER_2.userId,
      })

      const results = await bulkVerifyTransactions(TEST_TENANT_ID, [
        transaction,
      ])
      expect(results.length).not.toEqual(0)
      const [result] = results

      const cases = await caseCreationService.handleTransaction({
        ...transaction,
        ...result,
      })
      expect(cases.length).toEqual(2)
      expectUserCase(cases, {
        originUserId: TEST_USER_1.userId,
      })
      expectUserCase(cases, {
        destinationUserId: TEST_USER_2.userId,
      })
    })
  })

  describe('Run #4', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setup(TEST_TENANT_ID)
    test('Previous open case should be updated', async () => {
      const caseCreationService = await getService(TEST_TENANT_ID)

      // Create case
      let firstCase: Case
      {
        const transaction = getTestTransaction({
          transactionId: '111',
          originUserId: TEST_USER_1.userId,
          destinationUserId: undefined,
        })
        const results = await bulkVerifyTransactions(TEST_TENANT_ID, [
          transaction,
        ])
        expect(results.length).not.toEqual(0)
        const [result] = results
        const cases = await caseCreationService.handleTransaction({
          ...transaction,
          ...result,
        })
        firstCase = cases[0]
      }

      // Add transaction, it should land into existed case
      {
        const transaction = getTestTransaction({
          transactionId: '222',
          originUserId: TEST_USER_1.userId,
          destinationUserId: undefined,
        })
        const results = await bulkVerifyTransactions(TEST_TENANT_ID, [
          transaction,
        ])
        expect(results.length).not.toEqual(0)
        const [result] = results
        const cases = await caseCreationService.handleTransaction({
          ...transaction,
          ...result,
        })

        const nextCase = cases[0]
        expect(firstCase.caseId).toEqual(nextCase.caseId)
        expect(nextCase.caseTransactionsIds).toHaveLength(2)
      }
    })
  })
})

/*
  Helpers
 */

function setup(tenantId: string) {
  setUpRulesHooks(tenantId, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'tests/test-always-hit-rule',
      defaultCaseCreationType: 'USER',
    },
  ])
  setUpConsumerUsersHooks(tenantId, [TEST_USER_1, TEST_USER_2])
}

function expectUserCase(
  cases: Case[],
  params: {
    originUserId?: string
    destinationUserId?: string
  } = {}
) {
  const caseItem = cases.find((x) => {
    if (x.caseType !== 'USER') {
      return false
    }
    if (
      params.originUserId != null &&
      x.caseUsers?.origin?.userId != params.originUserId
    ) {
      return false
    }
    if (
      params.destinationUserId != null &&
      x.caseUsers?.destination?.userId != params.destinationUserId
    ) {
      return false
    }
    return true
  })
  expect(caseItem).not.toBeNull()
  if (params.originUserId != null) {
    expect(caseItem?.caseUsers?.origin?.userId).toEqual(params.originUserId)
  }
  if (params.destinationUserId != null) {
    expect(caseItem?.caseUsers?.destination?.userId).toEqual(
      params.destinationUserId
    )
  }
}

// function expectTransactionCase(
//   cases: Case[],
//   params: {
//     transactionIds?: string[]
//   } = {}
// ) {
//   const caseItem = cases.find((x) => x.caseType === 'TRANSACTION')
//   expect(caseItem).not.toBeNull()
//   if (params.transactionIds != null) {
//     const caseTransactions = caseItem?.caseTransactions ?? []
//     expect(caseTransactions).toEqual(
//       expect.arrayContaining(
//         params.transactionIds.map((transactionId) =>
//           expect.objectContaining({ transactionId })
//         )
//       )
//     )
//   }
// }
