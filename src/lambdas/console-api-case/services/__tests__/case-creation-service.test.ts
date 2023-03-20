import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { CaseCreationService } from '@/lambdas/console-api-case/services/case-creation-service'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  bulkVerifyTransactions,
  setUpRulesHooks,
} from '@/test-utils/rule-test-utils'
import { getTestUser, setUpUsersHooks } from '@/test-utils/user-test-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { RuleHitDirection } from '@/@types/openapi-public/RuleHitDirection'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { Priority } from '@/@types/openapi-internal/Priority'
import { Alert } from '@/@types/openapi-internal/Alert'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'

dynamoDbSetupHook()

async function getService(tenantId: string) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
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
  const transactionRepository = new MongoDbTransactionRepository(
    tenantId,
    mongoDb
  )
  const caseCreationService = new CaseCreationService(
    caseRepository,
    userRepository,
    ruleInstanceRepository,
    transactionRepository
  )
  return caseCreationService
}

const TEST_USER_1 = getTestUser({ userId: 'test_user_id_1' })
const TEST_USER_2 = getTestUser({ userId: 'test_user_id_2' })

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
      expect(cases[0].alerts).toBeDefined()

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
      expect(cases[0].alerts).toBeDefined()
      expectUserCase(cases, {
        destinationUserId: TEST_USER_1.userId,
      })
    })
  })

  describe('Alert separation logic', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setup(TEST_TENANT_ID, {
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })

    const justRehitRules: HitRulesDetails[] = [
      {
        ruleId: 'REHIT_RULE',
        ruleInstanceId: 'REHIT_RULE',
        ruleName: 'REHIT_RULE',
        ruleDescription: 'REHIT_RULE',
        ruleAction: 'FLAG',
      },
    ]

    const hitRules: HitRulesDetails[] = [
      {
        ruleId: 'REHIT_RULE',
        ruleInstanceId: 'REHIT_RULE',
        ruleName: 'REHIT_RULE',
        ruleDescription: 'REHIT_RULE',
        ruleAction: 'FLAG',
      },
      {
        ruleId: 'NEW_RULE_HIT',
        ruleInstanceId: 'NEW_RULE_HIT',
        ruleName: 'NEW_RULE_HIT',
        ruleDescription: 'NEW_RULE_HIT',
        ruleAction: 'FLAG',
      },
    ]

    const ruleInstances: RuleInstance[] = [
      {
        ruleId: 'REHIT_RULE',
        casePriority: 'P1',
        nature: 'AML',
        labels: [],
      },
      {
        ruleId: 'NEW_RULE_HIT',
        casePriority: 'P1',
        nature: 'AML',
        labels: [],
      },
    ]

    const alerts: Alert[] = [
      {
        alertId: 'A1',
        createdTimestamp: 0,
        latestTransactionArrivalTimestamp: 0,
        ruleInstanceId: 'REHIT_RULE',
        ruleName: 'REHIT_RULE',
        ruleDescription: 'REHIT_RULE',
        ruleId: 'REHIT_RULE',
        ruleAction: 'FLAG',
        numberOfTransactionsHit: 1,
        priority: 'P1' as Priority,
      },
      {
        alertId: 'A1',
        createdTimestamp: 0,
        latestTransactionArrivalTimestamp: 0,
        ruleInstanceId: 'UNHIT_RULE',
        ruleName: 'UNHIT_RULE',
        ruleDescription: 'UNHIT_RULE',
        ruleId: 'UNHIT_RULE',
        ruleAction: 'FLAG',
        numberOfTransactionsHit: 1,
        priority: 'P1' as Priority,
      },
    ]

    test('Alerts are correctly separated', async () => {
      const caseCreationService = await getService(TEST_TENANT_ID)

      const { newAlerts, existingAlerts } =
        caseCreationService.separateExistingAndNewAlerts(
          hitRules,
          ruleInstances,
          alerts,
          0,
          0,
          't1'
        )

      expect(newAlerts.length).toEqual(1)
      expect(existingAlerts.length).toEqual(2)

      expect(newAlerts.find((a) => a.ruleId === 'NEW_RULE_HIT')).toBeTruthy()
      expect(existingAlerts.find((a) => a.ruleId === 'UNHIT_RULE')).toBeTruthy()
      expect(existingAlerts.find((a) => a.ruleId === 'REHIT_RULE')).toBeTruthy()
    })

    test('Alerts are correctly separated when just rehit', async () => {
      const caseCreationService = await getService(TEST_TENANT_ID)

      const { existingAlerts } =
        caseCreationService.separateExistingAndNewAlerts(
          justRehitRules,
          ruleInstances,
          alerts,
          0,
          0,
          't1'
        )

      expect(existingAlerts.length).toEqual(2)

      expect(existingAlerts.find((a) => a.ruleId === 'UNHIT_RULE')).toBeTruthy()
      expect(existingAlerts.find((a) => a.ruleId === 'REHIT_RULE')).toBeTruthy()
    })
  })

  describe('Run #3', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setup(TEST_TENANT_ID, {
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
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
      const case1 = expectUserCase(cases, {
        originUserId: TEST_USER_1.userId,
      })
      const case2 = expectUserCase(cases, {
        destinationUserId: TEST_USER_2.userId,
      })
      expect(case1.relatedCases).toHaveLength(1)
      expect(case2.relatedCases).toHaveLength(1)
      expect(case1.alerts).toBeDefined()
      expect(case2.alerts).toBeDefined()
      expect(case1.relatedCases?.[0]).toEqual(case2.caseId)
      expect(case2.relatedCases?.[0]).toEqual(case1.caseId)
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
        expect(nextCase.caseTransactions).toHaveLength(2)
      }
    })
  })

  describe('Run #5', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setup(TEST_TENANT_ID)
    test('Previous case should be updated when user is a different party', async () => {
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

      // Add transaction, same user but as destination, it should land into existed case
      {
        const transaction = getTestTransaction({
          transactionId: '222',
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

        expect(results.length).toEqual(1)
        const nextCase = cases[0]
        expect(firstCase.caseId).toEqual(nextCase.caseId)
        expect(nextCase.caseTransactions).toHaveLength(2)
      }
    })
  })

  describe('Run #6', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setup(TEST_TENANT_ID)

    test('Check that cases are not created for missing users', async () => {
      const caseCreationService = await getService(TEST_TENANT_ID)

      const transaction = getTestTransaction({
        originUserId: 'this_user_id_does_not_exists',
        destinationUserId: 'this_user_id_does_not_exists_2',
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
      expect(cases.length).toEqual(0)
    })
  })

  describe('Run #7', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setup(TEST_TENANT_ID)

    test('Make sure to select next open and not over fulled case', async () => {
      const caseCreationService = await getService(TEST_TENANT_ID)
      async function addTransaction(counter: number) {
        const transaction = getTestTransaction({
          transactionId: `transaction_${counter}`,
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
        return expectUserCase(cases)
      }

      const case1 = await addTransaction(0)
      case1.caseTransactionsIds = [...new Array(999)].map(
        (_, counter) => `fake_transaction_${counter}`
      )
      await caseCreationService.caseRepository.addCaseMongo(case1)

      // Goes to the same case, making transaction number 1000
      const _case1 = await addTransaction(1)
      expect(_case1.caseId).toEqual(case1.caseId)

      // New case should be created
      const case2 = await addTransaction(1)
      expect(case2.caseId).not.toEqual(case1.caseId)

      // Next transaction goes to the second case
      const _case2 = await addTransaction(2)
      expect(_case2.caseId).toEqual(case2.caseId)
      expect(_case2.caseTransactionsIds).toHaveLength(2)
    })
  })

  describe('Run #8', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setup(TEST_TENANT_ID, {
      hitDirections: ['ORIGIN'],
    })
    test('Both users exist, but only create the case for the hit direction - origin', async () => {
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
      expect(cases.length).toEqual(1)
      const userCase = expectUserCase(cases, {
        originUserId: TEST_USER_1.userId,
      })
      expect(userCase.relatedCases).toBeUndefined()
    })
  })

  describe('Run #9', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setup(TEST_TENANT_ID, {
      hitDirections: ['DESTINATION'],
    })
    test('Both users exist, but only create the case for the hit direction - destination', async () => {
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
      expect(cases.length).toEqual(1)
      const userCase = expectUserCase(cases, {
        destinationUserId: TEST_USER_2.userId,
      })
      expect(userCase.relatedCases).toBeUndefined()
    })
  })

  describe('Run #10', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setup(TEST_TENANT_ID, {
      hitDirections: ['DESTINATION'],
      rulesCount: 2,
    })
    test('For multiple rules hit only one case should be created', async () => {
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
      expect(cases.length).toEqual(1)
      const userCase = expectUserCase(cases, {
        destinationUserId: TEST_USER_2.userId,
      })
      expect(userCase.relatedCases).toBeUndefined()
    })
  })
})

describe('Run #1', () => {
  const TEST_TENANT_ID = getTestTenantId()
  setup(TEST_TENANT_ID, {})

  test('No prior cases', async () => {
    const caseCreationService = await getService(TEST_TENANT_ID)

    const transaction = getTestTransaction({
      originUserId: TEST_USER_1.userId,
      destinationUserId: undefined,
    })

    const results = await bulkVerifyTransactions(TEST_TENANT_ID, [transaction])
    expect(results.length).not.toEqual(0)
    const [result] = results

    const cases = await caseCreationService.handleTransaction({
      ...transaction,
      ...result,
    })
    expect(cases.length).toEqual(1)
  })
})

describe('Run #2', () => {
  const TEST_TENANT_ID = getTestTenantId()
  setup(TEST_TENANT_ID, {})

  test('Check that cases are not created for missing users', async () => {
    const caseCreationService = await getService(TEST_TENANT_ID)

    const transaction = getTestTransaction({
      originUserId: 'this_user_id_does_not_exists',
      destinationUserId: 'this_user_id_does_not_exists_2',
    })

    const results = await bulkVerifyTransactions(TEST_TENANT_ID, [transaction])
    expect(results.length).not.toEqual(0)
    const [result] = results

    const cases = await caseCreationService.handleTransaction({
      ...transaction,
      ...result,
    })
    expect(cases.length).toEqual(0)
  })
})

describe('Run #3', () => {
  const TEST_TENANT_ID = getTestTenantId()
  setup(TEST_TENANT_ID, {})

  async function createCase(): Promise<Case> {
    const caseCreationService = await getService(TEST_TENANT_ID)

    const transaction = getTestTransaction({
      originUserId: TEST_USER_1.userId,
    })

    const results = await bulkVerifyTransactions(TEST_TENANT_ID, [transaction])
    expect(results.length).not.toEqual(0)
    const [result] = results

    const cases = await caseCreationService.handleTransaction({
      ...transaction,
      ...result,
    })
    expect(cases.length).toEqual(1)
    const caseItem = expectUserCase(cases, {
      originUserId: TEST_USER_1.userId,
    })
    return caseItem
  }

  test('Create case using existed alerts', async () => {
    const caseCreationService = await getService(TEST_TENANT_ID)

    const caseItem = await createCase()
    expect(caseItem.caseId).toBeTruthy()
    expect(caseItem.alerts?.length).toBeGreaterThan(0)

    const [alert] = caseItem.alerts ?? []
    expect(alert.alertId).toBeTruthy()

    const newCase = await caseCreationService.createNewCaseFromAlerts(
      caseItem,
      [alert.alertId ?? '']
    )
    expect(newCase.caseId).toBeTruthy()
    expect(newCase.caseId).not.toEqual(caseItem.caseId)
    expect(newCase.alerts).toHaveLength(1)
    expect(newCase?.alerts?.[0]?.alertId).toEqual(alert.alertId ?? '')

    const oldCase = await caseCreationService.caseRepository.getCaseById(
      caseItem.caseId ?? ''
    )
    expect(oldCase?.alerts).toHaveLength(0)

    const newCase2 = await caseCreationService.caseRepository.getCaseById(
      newCase.caseId ?? ''
    )
    expect(newCase2).toBeTruthy()
    expect(newCase2?.alerts).toHaveLength(1)
    expect(newCase2?.alerts?.[0]?.alertId).toEqual(alert.alertId)

    const allCases = await caseCreationService.caseRepository.getCases({})
    expect(allCases.data).toHaveLength(2)
  })
})

/*
  Helpers
 */

function setup(
  tenantId: string,
  parameters: {
    hitDirections?: RuleHitDirection[]
    rulesCount?: number
  } = {}
) {
  for (let i = 0; i < (parameters.rulesCount ?? 1); i += 1) {
    setUpRulesHooks(tenantId, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'tests/test-always-hit-rule',
        parameters: {
          hitDirections: parameters.hitDirections,
        },
      },
    ])
  }
  setUpUsersHooks(tenantId, [TEST_USER_1, TEST_USER_2])
}

function expectUserCase(
  cases: Case[],
  params: {
    originUserId?: string
    destinationUserId?: string
  } = {}
): Case {
  const caseItem = cases.find((x) => {
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
  expect(caseItem).toBeTruthy()
  if (params.originUserId != null) {
    expect(caseItem?.caseUsers?.origin?.userId).toEqual(params.originUserId)
  }
  if (params.destinationUserId != null) {
    expect(caseItem?.caseUsers?.destination?.userId).toEqual(
      params.destinationUserId
    )
  }
  return caseItem as Case
}
