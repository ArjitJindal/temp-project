import MockDate from 'mockdate'
import * as createError from 'http-errors'
import { v4 as uuidv4 } from 'uuid'

import { CaseCreationService } from '@/lambdas/console-api-case/services/case-creation-service'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  bulkVerifyTransactions,
  bulkVerifyUsers,
  createRule,
  setUpRulesHooks,
} from '@/test-utils/rule-test-utils'
import {
  getTestBusiness,
  getTestUser,
  setUpUsersHooks,
} from '@/test-utils/user-test-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { RuleHitDirection } from '@/@types/openapi-public/RuleHitDirection'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Priority } from '@/@types/openapi-internal/Priority'
import { Alert } from '@/@types/openapi-internal/Alert'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { RuleType } from '@/@types/openapi-internal/RuleType'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { AlertCreationIntervalInstantly } from '@/@types/openapi-internal/AlertCreationIntervalInstantly'
import { AlertCreationIntervalWeekly } from '@/@types/openapi-internal/AlertCreationIntervalWeekly'
import { AlertCreationIntervalMonthly } from '@/@types/openapi-internal/AlertCreationIntervalMonthly'
import { AlertsRepository } from '@/services/rules-engine/repositories/alerts-repository'
import { AlertsService } from '@/services/alerts'
import { getS3ClientByEvent } from '@/utils/s3'
import { CaseService } from '@/lambdas/console-api-case/services/case-service'
import { User } from '@/@types/openapi-public/User'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'
import { AlertCreatedForEnum } from '@/services/rules-engine/utils/rule-parameter-schemas'
import { getAlertRepo } from '@/lambdas/console-api-dashboard/repositories/__tests__/helpers'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { DerivedStatus } from '@/@types/openapi-internal/DerivedStatus'

async function getServices(tenantId: string) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const caseRepository = new CaseRepository(tenantId, {
    mongoDb,
  })

  const caseCreationService = new CaseCreationService(tenantId, {
    dynamoDb,
    mongoDb,
  })

  const dynamoDbTranasactionRepository = new DynamoDbTransactionRepository(
    tenantId,
    dynamoDb
  )
  const s3 = getS3ClientByEvent(null as any)
  const alertsRepository = new AlertsRepository(tenantId, {
    mongoDb,
    dynamoDb,
  })
  const alertsService = new AlertsService(alertsRepository, s3, {
    documentBucketName: 'test-bucket',
    tmpBucketName: 'test-bucket',
  })
  const caseService = new CaseService(caseRepository, s3, {
    documentBucketName: 'test-bucket',
    tmpBucketName: 'test-bucket',
  })
  return {
    caseCreationService,
    alertsService,
    caseService,
    dynamoDbTranasactionRepository,
    alertsRepository,
  }
}

const TODAY = '2023-06-09T12:00:00.000Z'

const TEST_USER_1 = getTestUser({ userId: 'test_user_id_1' })
const TEST_USER_2 = getTestUser({ userId: 'test_user_id_2' })

const getHitRuleInstances = async (
  tenantId: string,
  transaction: TransactionMonitoringResult
): Promise<RuleInstance[]> => {
  const dynamoDb = getDynamoDbClient()

  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })

  const ruleInstances = await ruleInstanceRepository.getRuleInstancesByIds(
    transaction.hitRules.map((r) => r.ruleInstanceId)
  )

  return ruleInstances as RuleInstance[]
}

describe('Cases (Transaction hit)', () => {
  describe('Env #1', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setupRules(TEST_TENANT_ID)
    setupUsers(TEST_TENANT_ID)

    test('By origin user, no prior cases', async () => {
      const { caseCreationService } = await getServices(TEST_TENANT_ID)

      const transaction = getTestTransaction({
        originUserId: TEST_USER_1.userId,
        destinationUserId: undefined,
      })

      const results = await bulkVerifyTransactions(TEST_TENANT_ID, [
        transaction,
      ])
      expect(results.length).not.toEqual(0)
      const [result] = results

      const cases = await caseCreationService.handleTransaction(
        { ...transaction, ...result },
        await getHitRuleInstances(TEST_TENANT_ID, result),
        await caseCreationService.getTransactionSubjects({
          ...transaction,
          ...result,
        })
      )

      expect(cases.length).toEqual(1)
      expect(cases[0].alerts).toBeDefined()

      expectUserCase(cases, {
        originUserId: TEST_USER_1.userId,
      })
    })
  })

  describe('Env #2', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setupRules(TEST_TENANT_ID)
    setupUsers(TEST_TENANT_ID)
    test('By destination user, no prior cases', async () => {
      const { caseCreationService } = await getServices(TEST_TENANT_ID)

      const transaction = getTestTransaction({
        originUserId: undefined,
        destinationUserId: TEST_USER_1.userId,
      })

      const results = await bulkVerifyTransactions(TEST_TENANT_ID, [
        transaction,
      ])
      expect(results.length).not.toEqual(0)
      const [result] = results

      const cases = await caseCreationService.handleTransaction(
        { ...transaction, ...result },
        await getHitRuleInstances(TEST_TENANT_ID, result),
        await caseCreationService.getTransactionSubjects({
          ...transaction,
          ...result,
        })
      )
      expect(cases.length).toEqual(1)
      expect(cases[0].alerts).toBeDefined()
      expectUserCase(cases, {
        destinationUserId: TEST_USER_1.userId,
      })
    })
  })

  describe('Alert separation logic', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setupRules(TEST_TENANT_ID, {
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
    setupUsers(TEST_TENANT_ID)

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
        checksFor: [],
        type: 'TRANSACTION',
      },
      {
        ruleId: 'NEW_RULE_HIT',
        casePriority: 'P1',
        nature: 'AML',
        labels: [],
        checksFor: [],
        type: 'TRANSACTION',
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
      const { caseCreationService } = await getServices(TEST_TENANT_ID)

      const { newAlerts, existingAlerts } =
        await caseCreationService.separateExistingAndNewAlerts(
          hitRules,
          ruleInstances,
          alerts,
          0,
          0,
          {
            executedRules: [],
            hitRules: [],
            type: 'TRANSFER',
            status: 'ALLOW',
            timestamp: 0,
            transactionId: 't1',
          }
        )

      expect(newAlerts.length).toEqual(1)
      expect(existingAlerts.length).toEqual(2)

      expect(newAlerts.find((a) => a.ruleId === 'NEW_RULE_HIT')).toBeTruthy()
      expect(existingAlerts.find((a) => a.ruleId === 'UNHIT_RULE')).toBeTruthy()
      expect(existingAlerts.find((a) => a.ruleId === 'REHIT_RULE')).toBeTruthy()
    })

    test('Alerts are correctly separated when just rehit', async () => {
      const { caseCreationService } = await getServices(TEST_TENANT_ID)

      const { existingAlerts } =
        await caseCreationService.separateExistingAndNewAlerts(
          justRehitRules,
          ruleInstances,
          alerts,
          0,
          0,
          {
            executedRules: [],
            hitRules: [],
            type: 'TRANSFER',
            status: 'ALLOW',
            timestamp: 0,
            transactionId: 't1',
          }
        )

      expect(existingAlerts.length).toEqual(2)

      expect(existingAlerts.find((a) => a.ruleId === 'UNHIT_RULE')).toBeTruthy()
      expect(existingAlerts.find((a) => a.ruleId === 'REHIT_RULE')).toBeTruthy()
    })
  })

  describe('Env #3', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setupRules(TEST_TENANT_ID, {
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
    setupUsers(TEST_TENANT_ID)
    test('Both users, no prior cases', async () => {
      const { caseCreationService } = await getServices(TEST_TENANT_ID)

      const transaction = getTestTransaction({
        originUserId: TEST_USER_1.userId,
        destinationUserId: TEST_USER_2.userId,
      })

      const results = await bulkVerifyTransactions(TEST_TENANT_ID, [
        transaction,
      ])
      expect(results.length).not.toEqual(0)
      const [result] = results

      const cases = await caseCreationService.handleTransaction(
        {
          ...transaction,
          ...result,
        },
        await getHitRuleInstances(TEST_TENANT_ID, result),
        await caseCreationService.getTransactionSubjects({
          ...transaction,
          ...result,
        })
      )
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

  describe('Env #4', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setupRules(TEST_TENANT_ID)
    setupUsers(TEST_TENANT_ID)
    test('Previous open case should be updated', async () => {
      const { caseCreationService } = await getServices(TEST_TENANT_ID)

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
        expect(results).toHaveLength(1)
        const [result] = results
        const cases = await caseCreationService.handleTransaction(
          {
            ...transaction,
            ...result,
          },
          await getHitRuleInstances(TEST_TENANT_ID, result),
          await caseCreationService.getTransactionSubjects({
            ...transaction,
            ...result,
          })
        )
        expect(cases).toHaveLength(1)
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
        const cases = await caseCreationService.handleTransaction(
          {
            ...transaction,
            ...result,
          },
          await getHitRuleInstances(TEST_TENANT_ID, result),
          await caseCreationService.getTransactionSubjects({
            ...transaction,
            ...result,
          })
        )

        expect(cases).toHaveLength(1)
        const nextCase = cases[0]
        expect(nextCase.caseId).toEqual(firstCase.caseId)
        expect(nextCase.caseTransactionsIds).toHaveLength(2)

        // Close the first alert in the case and assert transction not added
        const alertRepo = await getAlertRepo(TEST_TENANT_ID)
        const alert = nextCase.alerts?.at(0)
        await alertRepo.updateStatus(
          [alert?.alertId as string],
          [nextCase.caseId as string],
          {
            timestamp: Date.now().valueOf(),
            userId: 'test',
            caseStatus: 'CLOSED',
          }
        )
        const nextTransaction = getTestTransaction({
          transactionId: '333',
          originUserId: TEST_USER_1.userId,
          destinationUserId: undefined,
        })
        const nextResults = await bulkVerifyTransactions(TEST_TENANT_ID, [
          nextTransaction,
        ])
        const [nextResult] = nextResults
        const finalCases = await caseCreationService.handleTransaction(
          {
            ...nextTransaction,
            ...nextResult,
          },
          await getHitRuleInstances(TEST_TENANT_ID, nextResult),
          await caseCreationService.getTransactionSubjects({
            ...nextTransaction,
            ...nextResult,
          })
        )
        const finalCase = finalCases[0]
        expect(finalCase.alerts).toHaveLength(2)
        expect(finalCase.alerts?.at(0)?.transactionIds?.at(0)).toEqual('333')
        expect(
          finalCase.alerts?.at(1)?.transactionIds?.indexOf('333') === -1
        ).toBeTruthy()
      }
    })
  })

  describe('Env #5', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setupRules(TEST_TENANT_ID)
    setupUsers(TEST_TENANT_ID)
    test('Previous case should be updated when user is a different party', async () => {
      const { caseCreationService } = await getServices(TEST_TENANT_ID)

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
        const cases = await caseCreationService.handleTransaction(
          {
            ...transaction,
            ...result,
          },
          await getHitRuleInstances(TEST_TENANT_ID, result),
          await caseCreationService.getTransactionSubjects({
            ...transaction,
            ...result,
          })
        )

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
        const cases = await caseCreationService.handleTransaction(
          {
            ...transaction,
            ...result,
          },
          await getHitRuleInstances(TEST_TENANT_ID, result),
          await caseCreationService.getTransactionSubjects({
            ...transaction,
            ...result,
          })
        )

        expect(results.length).toEqual(1)
        const nextCase = cases[0]
        expect(firstCase.caseId).toEqual(nextCase.caseId)
        expect(nextCase.caseTransactionsIds).toHaveLength(2)
      }
    })
  })

  describe('Env #6', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setupRules(TEST_TENANT_ID)
    setupUsers(TEST_TENANT_ID)

    test('Check that cases are not created for missing users', async () => {
      const { caseCreationService } = await getServices(TEST_TENANT_ID)

      const transaction = getTestTransaction({
        originUserId: 'this_user_id_does_not_exists',
        destinationUserId: 'this_user_id_does_not_exists_2',
      })

      const results = await bulkVerifyTransactions(TEST_TENANT_ID, [
        transaction,
      ])
      expect(results.length).not.toEqual(0)
      const [result] = results

      const cases = await caseCreationService.handleTransaction(
        {
          ...transaction,
          ...result,
        },
        await getHitRuleInstances(TEST_TENANT_ID, result),
        await caseCreationService.getTransactionSubjects({
          ...transaction,
          ...result,
        })
      )
      expect(cases.length).toEqual(0)
    })
  })

  describe('Env #7', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setupRules(TEST_TENANT_ID)
    setupUsers(TEST_TENANT_ID)

    test('Make sure to select next open and not over fulled case', async () => {
      const { caseCreationService } = await getServices(TEST_TENANT_ID)

      async function addTransaction(counter: number, expectCase: boolean) {
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
        const cases = await caseCreationService.handleTransaction(
          {
            ...transaction,
            ...result,
          },
          await getHitRuleInstances(TEST_TENANT_ID, result),
          await caseCreationService.getTransactionSubjects({
            ...transaction,
            ...result,
          })
        )
        if (!expectCase) {
          expect(cases).toHaveLength(0)
        } else {
          return expectUserCase(cases)
        }
      }

      const case1 = (await addTransaction(0, true)) as Case
      case1.caseTransactionsIds = [...new Array(49_999)].map(
        (_, counter) => `fake_transaction_${counter}`
      )
      await caseCreationService.caseRepository.addCaseMongo(case1)

      // Goes to the same case, making transaction number 1000
      const case2 = (await addTransaction(1, true)) as Case
      expect(case2.caseId).toEqual(case1.caseId)

      // Same transaction with same hit rules will not return the case
      await addTransaction(1, false)

      // New case should be created
      const case3 = (await addTransaction(2, true)) as Case
      expect(case3.caseId).not.toEqual(case1.caseId)

      // Next transaction goes to the second case
      const case4 = (await addTransaction(3, true)) as Case
      expect(case4.caseId).toEqual(case3.caseId)
      expect(case4.caseTransactionsIds).toHaveLength(2)
    })
  })

  describe('Env #8', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setupRules(TEST_TENANT_ID, {
      hitDirections: ['ORIGIN'],
    })
    setupUsers(TEST_TENANT_ID)

    test('Both users exist, but only create the case for the hit direction - origin', async () => {
      const { caseCreationService } = await getServices(TEST_TENANT_ID)

      const transaction = getTestTransaction({
        originUserId: TEST_USER_1.userId,
        destinationUserId: TEST_USER_2.userId,
      })

      const results = await bulkVerifyTransactions(TEST_TENANT_ID, [
        transaction,
      ])
      expect(results.length).not.toEqual(0)
      const [result] = results

      const cases = await caseCreationService.handleTransaction(
        {
          ...transaction,
          ...result,
        },
        await getHitRuleInstances(TEST_TENANT_ID, result),
        await caseCreationService.getTransactionSubjects({
          ...transaction,
          ...result,
        })
      )
      expect(cases.length).toEqual(1)
      const userCase = expectUserCase(cases, {
        originUserId: TEST_USER_1.userId,
      })
      expect(userCase.relatedCases).toBeUndefined()
    })
  })

  describe('Env #9', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setupRules(TEST_TENANT_ID, {
      hitDirections: ['DESTINATION'],
    })
    setupUsers(TEST_TENANT_ID)

    test('Both users exist, but only create the case for the hit direction - destination', async () => {
      const { caseCreationService } = await getServices(TEST_TENANT_ID)

      const transaction = getTestTransaction({
        originUserId: TEST_USER_1.userId,
        destinationUserId: TEST_USER_2.userId,
      })

      const results = await bulkVerifyTransactions(TEST_TENANT_ID, [
        transaction,
      ])
      expect(results.length).not.toEqual(0)
      const [result] = results

      const cases = await caseCreationService.handleTransaction(
        {
          ...transaction,
          ...result,
        },
        await getHitRuleInstances(TEST_TENANT_ID, result),
        await caseCreationService.getTransactionSubjects({
          ...transaction,
          ...result,
        })
      )
      expect(cases.length).toEqual(1)
      const userCase = expectUserCase(cases, {
        destinationUserId: TEST_USER_2.userId,
      })
      expect(userCase.relatedCases).toBeUndefined()
    })
  })

  describe('Env #10', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setupRules(TEST_TENANT_ID, {
      hitDirections: ['DESTINATION'],
      rulesCount: 2,
    })
    setupUsers(TEST_TENANT_ID)

    test('For multiple rules hit only one case should be created', async () => {
      const { caseCreationService } = await getServices(TEST_TENANT_ID)

      const transaction = getTestTransaction({
        originUserId: TEST_USER_1.userId,
        destinationUserId: TEST_USER_2.userId,
      })

      const results = await bulkVerifyTransactions(TEST_TENANT_ID, [
        transaction,
      ])
      expect(results.length).not.toEqual(0)
      const [result] = results

      const cases = await caseCreationService.handleTransaction(
        {
          ...transaction,
          ...result,
        },
        await getHitRuleInstances(TEST_TENANT_ID, result),
        await caseCreationService.getTransactionSubjects({
          ...transaction,
          ...result,
        })
      )
      expect(cases.length).toEqual(1)
      const userCase = expectUserCase(cases, {
        destinationUserId: TEST_USER_2.userId,
      })
      expect(userCase.relatedCases).toBeUndefined()
    })
  })

  describe('Env #11', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setupRules(TEST_TENANT_ID, {
      hitDirections: ['ORIGIN', 'DESTINATION'],
      rulesCount: 2,
    })
    setupUsers(TEST_TENANT_ID)

    test('New transaction should be put into the correct alert', async () => {
      const { caseCreationService } = await getServices(TEST_TENANT_ID)

      const transactions = [
        getTestTransaction({
          transactionId: 'transaction-1',
          originUserId: TEST_USER_1.userId,
          destinationUserId: undefined,
        }),
        getTestTransaction({
          transactionId: 'transaction-2',
          originUserId: TEST_USER_1.userId,
          destinationUserId: undefined,
        }),
      ]

      const results = await bulkVerifyTransactions(TEST_TENANT_ID, transactions)
      expect(results.length).toEqual(2)
      results[0].hitRules = [results[0].hitRules[0]]
      results[1].hitRules = [results[1].hitRules[1]]
      await caseCreationService.handleTransaction(
        {
          ...transactions[0],
          ...results[0],
        },
        await getHitRuleInstances(TEST_TENANT_ID, results[0]),
        await caseCreationService.getTransactionSubjects({
          ...transactions[0],
          ...results[0],
        })
      )
      const cases = await caseCreationService.handleTransaction(
        {
          ...transactions[1],
          ...results[1],
        },
        await getHitRuleInstances(TEST_TENANT_ID, results[1]),
        await caseCreationService.getTransactionSubjects({
          ...transactions[1],
          ...results[1],
        })
      )
      expect(cases.length).toEqual(1)
      expect(cases[0].alerts).toHaveLength(2)
      expect(cases[0].alerts).toEqual([
        expect.objectContaining({
          alertStatus: 'OPEN',
          ruleId: 'TRANSACTION-R-0',
          ruleName: 'test rule name',
          ruleDescription: 'test rule description.',
          ruleAction: 'FLAG',
          numberOfTransactionsHit: 1,
          transactionIds: ['transaction-1'],
          priority: 'P1',
          alertId: 'A-1',
          caseId: 'C-1',
        }),
        expect.objectContaining({
          alertStatus: 'OPEN',
          ruleId: 'TRANSACTION-R-1',
          ruleName: 'test rule name',
          ruleDescription: 'test rule description.',
          ruleAction: 'FLAG',
          numberOfTransactionsHit: 1,
          transactionIds: ['transaction-2'],
          priority: 'P1',
          alertId: 'A-2',
          caseId: 'C-1',
        }),
      ])
    })
  })

  describe('Env #12', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setupRules(TEST_TENANT_ID, {
      hitDirections: ['ORIGIN'],
      rulesCount: 2,
    })
    setupUsers(TEST_TENANT_ID)

    test('New transaction update should replace the transaction in an existing case', async () => {
      const { caseCreationService, dynamoDbTranasactionRepository } =
        await getServices(TEST_TENANT_ID)

      const transaction = getTestTransaction({
        originUserId: TEST_USER_1.userId,
        destinationUserId: TEST_USER_2.userId,
      })

      const results = await bulkVerifyTransactions(TEST_TENANT_ID, [
        transaction,
      ])
      const [result] = results

      const cases = await caseCreationService.handleTransaction(
        {
          ...transaction,
          ...{
            ...result,
            hitRules: [result.hitRules[0]],
          },
        },
        await getHitRuleInstances(TEST_TENANT_ID, result),
        await caseCreationService.getTransactionSubjects({
          ...transaction,
          ...result,
        })
      )

      const case1TxnId = cases[0].caseTransactionsIds?.at(0)
      let savedCase1Txn: TransactionWithRulesResult | null | undefined
      if (case1TxnId) {
        savedCase1Txn = await dynamoDbTranasactionRepository.getTransactionById(
          case1TxnId
        )
      }

      expect(cases.length).toEqual(1)
      expect(cases[0]?.caseTransactionsIds).toHaveLength(1)
      expect(savedCase1Txn?.hitRules[0]).toEqual(result.hitRules[0])

      const cases2 = await caseCreationService.handleTransaction(
        {
          ...transaction,
          ...result,
        },
        await getHitRuleInstances(TEST_TENANT_ID, result),
        await caseCreationService.getTransactionSubjects({
          ...transaction,
          ...result,
        })
      )

      const case2TxnId = cases2[0]?.caseTransactionsIds?.at(0)
      let savedCase2Txn: TransactionWithRulesResult | null | undefined
      if (case2TxnId) {
        savedCase2Txn = await dynamoDbTranasactionRepository.getTransactionById(
          case2TxnId
        )
      }

      expect(cases2.length).toEqual(1)
      expect(cases2[0].caseId).toBe(cases[0].caseId)
      expect(cases2[0]?.caseTransactionsIds).toHaveLength(1)
      expect(savedCase2Txn?.hitRules).toEqual(result.hitRules)
    })
  })
})

describe('Cases (User hit)', () => {
  const TEST_TENANT_ID = getTestTenantId()
  setupRules(TEST_TENANT_ID, { ruleType: 'USER' })
  setupRules(TEST_TENANT_ID, { ruleType: 'TRANSACTION' })
  setupUsers(TEST_TENANT_ID)

  test('Create a new case for a user rule hit', async () => {
    const { caseCreationService } = await getServices(TEST_TENANT_ID)
    const user = getTestBusiness()
    const results = await bulkVerifyUsers(TEST_TENANT_ID, [user])
    expect(results).toHaveLength(1)
    const [result] = results

    const internalUser: InternalBusinessUser = {
      type: 'BUSINESS',
      ...user,
      ...result,
    }
    const cases = await caseCreationService.handleUser(internalUser)
    expect(cases).toHaveLength(1)
    expect(cases[0].alerts).toHaveLength(1)
    expectUserCase(cases, {
      originUserId: user.userId,
    })
  })

  test('Merge a user rule alert into an existing case', async () => {
    const { caseCreationService } = await getServices(TEST_TENANT_ID)
    const transaction = getTestTransaction({
      transactionId: '111',
      originUserId: TEST_USER_1.userId,
      destinationUserId: undefined,
    })
    const results = await bulkVerifyTransactions(TEST_TENANT_ID, [transaction])
    const [result] = results
    await caseCreationService.handleTransaction(
      {
        ...transaction,
        ...result,
      },
      await getHitRuleInstances(TEST_TENANT_ID, result),
      await caseCreationService.getTransactionSubjects({
        ...transaction,
        ...result,
      })
    )

    const userResults = await bulkVerifyUsers(TEST_TENANT_ID, [TEST_USER_1])
    const internalUser = {
      type: 'CONSUMER',
      ...TEST_USER_1,
      ...userResults[0],
    } as InternalUser

    await caseCreationService.handleUser(internalUser)
    const cases = await caseCreationService.handleUser(internalUser)

    expect(cases).toHaveLength(1)
    expect(cases[0].alerts).toHaveLength(2)
    expect(cases[0].alerts?.[0].ruleId).toBe('TRANSACTION-R-0')
    expect(cases[0].alerts?.[1].ruleId).toBe('USER-R-0')
  })
})

describe('Env #1', () => {
  const TEST_TENANT_ID = getTestTenantId()
  setupRules(TEST_TENANT_ID, {})
  setupUsers(TEST_TENANT_ID)

  test('No prior cases', async () => {
    const { caseCreationService } = await getServices(TEST_TENANT_ID)

    const transaction = getTestTransaction({
      originUserId: TEST_USER_1.userId,
      destinationUserId: undefined,
    })

    const results = await bulkVerifyTransactions(TEST_TENANT_ID, [transaction])
    expect(results.length).not.toEqual(0)
    const [result] = results

    const cases = await caseCreationService.handleTransaction(
      {
        ...transaction,
        ...result,
      },
      await getHitRuleInstances(TEST_TENANT_ID, result),
      await caseCreationService.getTransactionSubjects({
        ...transaction,
        ...result,
      })
    )
    expect(cases.length).toEqual(1)
  })
})

describe('Env #2', () => {
  const TEST_TENANT_ID = getTestTenantId()
  setupRules(TEST_TENANT_ID, {})
  setupUsers(TEST_TENANT_ID)

  test('Check that cases are not created for missing users', async () => {
    const { caseCreationService } = await getServices(TEST_TENANT_ID)

    const transaction = getTestTransaction({
      originUserId: 'this_user_id_does_not_exists',
      destinationUserId: 'this_user_id_does_not_exists_2',
    })

    const results = await bulkVerifyTransactions(TEST_TENANT_ID, [transaction])
    expect(results.length).not.toEqual(0)
    const [result] = results

    const cases = await caseCreationService.handleTransaction(
      {
        ...transaction,
        ...result,
      },
      await getHitRuleInstances(TEST_TENANT_ID, result),
      await caseCreationService.getTransactionSubjects({
        ...transaction,
        ...result,
      })
    )
    expect(cases.length).toEqual(0)
  })
})

describe('Env #3', () => {
  const TEST_TENANT_ID = getTestTenantId()
  setupRules(TEST_TENANT_ID, {})
  setupUsers(TEST_TENANT_ID)

  async function createCase(): Promise<Case> {
    const { caseCreationService } = await getServices(TEST_TENANT_ID)

    const transaction = getTestTransaction({
      originUserId: TEST_USER_1.userId,
    })

    const results = await bulkVerifyTransactions(TEST_TENANT_ID, [transaction])
    expect(results.length).not.toEqual(0)
    const [result] = results

    const cases = await caseCreationService.handleTransaction(
      {
        ...transaction,
        ...result,
      },
      await getHitRuleInstances(TEST_TENANT_ID, result),
      await caseCreationService.getTransactionSubjects({
        ...transaction,
        ...result,
      })
    )
    expect(cases.length).toEqual(1)
    const caseItem = expectUserCase(cases, {
      originUserId: TEST_USER_1.userId,
    })
    return caseItem
  }

  test('Create case using existed alerts', async () => {
    const { caseCreationService } = await getServices(TEST_TENANT_ID)

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

describe('Test delayed publishing', () => {
  const CREATION_INTERVAL = {
    type: 'MONTHLY',
    day: 10,
  } as const

  const DAY_BEFORE_PUBLISH_DATE = '2023-06-09T12:00:00.000Z'
  const EXPECTED_PUBLISH_DATE = '2023-06-10T00:00:00.000Z'
  const DAY_AFTER_PUBLISH_DATE = '2023-06-11T12:00:00.000Z'
  const WEEK_AFTER_PUBLISH_DATE = '2023-06-17T12:00:00.000Z'

  beforeAll(async () => {
    MockDate.set(TODAY)
  })

  describe('Env #1', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpUsersHooks(TEST_TENANT_ID, [TEST_USER_1, TEST_USER_2])

    test('Alert should be created and availableAfterTimestamp should be assigned', async () => {
      await underRules(
        TEST_TENANT_ID,
        [
          {
            alertCreationInterval: CREATION_INTERVAL,
          },
        ],
        async () => {
          const alerts = await createAlerts(TEST_TENANT_ID)
          for (const alert of alerts) {
            expect(
              new Date(alert.availableAfterTimestamp as number).toISOString()
            ).toEqual(EXPECTED_PUBLISH_DATE)
          }
        }
      )
    })

    test('Alert is not available until published and then available after publishing', async () => {
      const { alertsService } = await getServices(TEST_TENANT_ID)

      await underRules(
        TEST_TENANT_ID,
        [
          {
            alertCreationInterval: CREATION_INTERVAL,
          },
        ],
        async () => {
          const [alert] = await createAlerts(TEST_TENANT_ID)
          const alertId = alert.alertId as string

          MockDate.set(DAY_BEFORE_PUBLISH_DATE)
          {
            expect(alertId).toBeDefined()
            await expect(alertsService.getAlert(alertId)).rejects.not.toBeNull()
          }

          MockDate.set(DAY_AFTER_PUBLISH_DATE)
          {
            const alert = await alertsService.getAlert(alertId)
            expect(alert).not.toBeNull()
          }
        }
      )
    })
  })

  describe('Env #2', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpUsersHooks(TEST_TENANT_ID, [TEST_USER_1, TEST_USER_2])

    test('Cases with no published alerts is not available via id', async () => {
      const { caseService } = await getServices(TEST_TENANT_ID)

      const { caseId } = await underRules(
        TEST_TENANT_ID,
        [
          {
            alertCreationInterval: CREATION_INTERVAL,
          },
        ],
        () => createCase(TEST_TENANT_ID)
      )

      MockDate.set(DAY_BEFORE_PUBLISH_DATE)
      {
        await expect(caseService.getCase(caseId as string)).rejects.toThrow(
          createError.NotFound
        )
      }

      MockDate.set(DAY_AFTER_PUBLISH_DATE)
      {
        const caseItem = await caseService.getCase(caseId as string)
        expect(caseItem).not.toBeNull()
      }
    })

    test('Cases with no published alerts is not listed until published and then listed after publishing', async () => {
      const { caseService } = await getServices(TEST_TENANT_ID)

      await underRules(
        TEST_TENANT_ID,
        [
          {
            alertCreationInterval: CREATION_INTERVAL,
          },
        ],
        async () => {
          await createAlerts(TEST_TENANT_ID)

          MockDate.set(DAY_BEFORE_PUBLISH_DATE)
          {
            const cases = await caseService.getCases({})
            expect(cases.total).toEqual(0)
          }

          MockDate.set(DAY_AFTER_PUBLISH_DATE)
          {
            const cases = await caseService.getCases({})
            expect(cases.total).toEqual(1)
          }
        }
      )
    })

    // todo: test different user ids with the same interval

    test('Create cases should become listed available when publish day passed', async () => {
      const { caseService } = await getServices(TEST_TENANT_ID)

      const createdCases = await underRules(
        TEST_TENANT_ID,
        [
          {
            alertCreationInterval: CREATION_INTERVAL,
          },
          {
            alertCreationInterval: {
              ...CREATION_INTERVAL,
              day: 12,
            },
          },
        ],
        () => createCases(TEST_TENANT_ID)
      )
      expect(createdCases).toHaveLength(2)

      MockDate.set(DAY_BEFORE_PUBLISH_DATE)
      {
        const cases = await caseService.getCases({})
        expect(cases.total).toEqual(0)
      }

      MockDate.set(DAY_AFTER_PUBLISH_DATE)
      {
        const cases = await caseService.getCases({})
        expect(cases.total).toEqual(1)
      }

      MockDate.set(WEEK_AFTER_PUBLISH_DATE)
      {
        const cases = await caseService.getCases({})
        expect(cases.total).toEqual(2)
      }
    })
  })

  describe('Env #4', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpUsersHooks(TEST_TENANT_ID, [TEST_USER_1, TEST_USER_2])

    test('Alerts with the same creation interval should land into the same case', async () => {
      const case1: Case = await underRules(
        TEST_TENANT_ID,
        [
          {
            ruleInstanceId: 'RI-1',
            alertCreationInterval: CREATION_INTERVAL,
          },
        ],
        () => createCase(TEST_TENANT_ID)
      )
      expect(
        new Date(case1.availableAfterTimestamp as number).toISOString()
      ).toEqual(EXPECTED_PUBLISH_DATE)

      const case2: Case = await underRules(
        TEST_TENANT_ID,
        [
          {
            ruleInstanceId: 'RI-2',
            alertCreationInterval: CREATION_INTERVAL,
          },
        ],
        () => createCase(TEST_TENANT_ID)
      )
      expect(
        new Date(case2.availableAfterTimestamp as number).toISOString()
      ).toEqual(EXPECTED_PUBLISH_DATE)

      expect(case2.caseId as string).toEqual(case2.caseId)
    })
  })

  describe('Env #5', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpUsersHooks(TEST_TENANT_ID, [TEST_USER_1, TEST_USER_2])

    test('Delayed hit and undelayed hit should create two cases', async () => {
      await underRules(
        TEST_TENANT_ID,
        [
          {
            ruleInstanceId: 'RI-1',
            alertCreationInterval: CREATION_INTERVAL,
          },
          {},
        ],
        async () => {
          const { caseCreationService } = await getServices(TEST_TENANT_ID)
          MockDate.set(TODAY)

          const transaction = getTestTransaction({
            originUserId: TEST_USER_1.userId,
          })

          const results = await bulkVerifyTransactions(TEST_TENANT_ID, [
            transaction,
          ])
          expect(results.length).not.toEqual(0)
          const [result] = results

          const cases = await caseCreationService.handleTransaction(
            {
              ...transaction,
              ...result,
            },
            await getHitRuleInstances(TEST_TENANT_ID, result),
            await caseCreationService.getTransactionSubjects({
              ...transaction,
              ...result,
            })
          )
          expect(cases.length).toEqual(2)
        }
      )
    })
  })
  describe('Env #6', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpUsersHooks(TEST_TENANT_ID, [TEST_USER_1, TEST_USER_2])

    test('Different publish intervals should create separate cases', async () => {
      await underRules(
        TEST_TENANT_ID,
        [
          {
            ruleInstanceId: 'RI-1',
            alertCreationInterval: CREATION_INTERVAL,
          },
          {
            ruleInstanceId: 'RI-2',
            alertCreationInterval: CREATION_INTERVAL,
          },
          {
            ruleInstanceId: 'RI-3',
            alertCreationInterval: {
              ...CREATION_INTERVAL,
              day: 11,
            },
          },
        ],
        async () => {
          const cases = await createCases(TEST_TENANT_ID)
          expect(cases.length).toEqual(2)
        }
      )
    })
  })
  describe('Env #6', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpUsersHooks(TEST_TENANT_ID, [TEST_USER_1, TEST_USER_2])

    test('If there is no specified date in the month, take the last one', async () => {
      const FEBRUARY_01 = '2023-02-01T12:00:00.000Z'
      const FEBRUARY_28 = '2023-02-28T00:00:00.000Z'
      const cases = await underRules(
        TEST_TENANT_ID,
        [
          {
            ruleInstanceId: 'RI-1',
            alertCreationInterval: {
              type: 'MONTHLY',
              day: 31,
            },
          },
        ],
        () => createCases(TEST_TENANT_ID, FEBRUARY_01)
      )
      const caseItem = expectUserCase(cases)
      expect(
        new Date(caseItem.availableAfterTimestamp as number).toISOString()
      ).toEqual(FEBRUARY_28)
    })
  })

  describe('Env #7', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpUsersHooks(TEST_TENANT_ID, [TEST_USER_1, TEST_USER_2])

    test('Alert is not available until published and then available after publishing', async () => {
      const { alertsService } = await getServices(TEST_TENANT_ID)

      await underRules(
        TEST_TENANT_ID,
        [
          {
            alertCreationInterval: CREATION_INTERVAL,
          },
        ],
        async () => {
          const [alert] = await createAlerts(TEST_TENANT_ID)
          const alertId = alert.alertId as string

          MockDate.set(DAY_BEFORE_PUBLISH_DATE)
          {
            expect(alertId).toBeDefined()
            await expect(alertsService.getAlert(alertId)).rejects.not.toBeNull()
          }

          MockDate.set(DAY_AFTER_PUBLISH_DATE)
          {
            const alert = await alertsService.getAlert(alertId)
            expect(alert).not.toBeNull()
          }
        }
      )
    })
  })

  describe('Env #8', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpUsersHooks(TEST_TENANT_ID, [TEST_USER_1, TEST_USER_2])

    test('Alert is not listed until published and then listed after publishing', async () => {
      const { alertsService } = await getServices(TEST_TENANT_ID)

      await underRules(
        TEST_TENANT_ID,
        [
          {
            alertCreationInterval: CREATION_INTERVAL,
          },
        ],
        async () => {
          const [alert] = await createAlerts(TEST_TENANT_ID)
          const alertId = alert.alertId as string

          MockDate.set(DAY_BEFORE_PUBLISH_DATE)
          {
            const alerts = await alertsService.getAlerts({})
            expect(alerts.total).toEqual(0)
          }

          MockDate.set(DAY_AFTER_PUBLISH_DATE)
          {
            const alerts = await alertsService.getAlerts({})
            expect(alerts.total).toEqual(1)
            expect(alerts.data[0]?.alert.alertId).toEqual(alertId)
          }
        }
      )
    })
  })

  describe('Env #9', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpUsersHooks(TEST_TENANT_ID, [TEST_USER_1, TEST_USER_2])

    test('New case should have creation time equal to availableAfterTimestamp', async () => {
      const caseItem = await underRules(
        TEST_TENANT_ID,
        [
          {
            alertCreationInterval: CREATION_INTERVAL,
          },
        ],
        () => createCase(TEST_TENANT_ID)
      )
      expect(
        new Date(caseItem.availableAfterTimestamp ?? 0).toISOString()
      ).toEqual(EXPECTED_PUBLISH_DATE)
      expect(caseItem.createdTimestamp).toEqual(
        caseItem.availableAfterTimestamp
      )
    })
  })

  describe('Env #10', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpUsersHooks(TEST_TENANT_ID, [TEST_USER_1, TEST_USER_2])

    test('New alerts should have creation time equal to availableAfterTimestamp', async () => {
      const alerts = await underRules(
        TEST_TENANT_ID,
        [
          {
            alertCreationInterval: CREATION_INTERVAL,
          },
        ],
        () => createAlerts(TEST_TENANT_ID)
      )
      for (const alert of alerts) {
        expect(
          new Date(alert.availableAfterTimestamp ?? 0).toISOString()
        ).toEqual(EXPECTED_PUBLISH_DATE)
        expect(alert.createdTimestamp).toEqual(alert.availableAfterTimestamp)
      }
    })
  })
})

describe('Test payment cases', () => {
  beforeAll(async () => {
    MockDate.set(TODAY)
  })

  describe('Env #1', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpUsersHooks(TEST_TENANT_ID, [TEST_USER_1, TEST_USER_2])

    test('Payment cases should be created', async () => {
      await underRules(
        TEST_TENANT_ID,
        [
          {
            alertCreatedFor: ['PAYMENT_DETAILS'],
          },
        ],
        async () => {
          const cases = await createCases(TEST_TENANT_ID)
          expect(cases).toHaveLength(1)
          const caseItem = cases[0]
          expect(caseItem.subjectType).toEqual('PAYMENT')
        }
      )
    })
  })

  describe('Env #2', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpUsersHooks(TEST_TENANT_ID, [TEST_USER_1, TEST_USER_2])

    test('Previous open case should be updated', async () => {
      const { caseCreationService } = await getServices(TEST_TENANT_ID)

      const paymentDetails = {
        method: 'CARD',
        cardFingerprint: uuidv4(),
        cardIssuedCountry: 'US',
        transactionReferenceField: 'DEPOSIT',
        '3dsDone': true,
      } as const

      await underRules(
        TEST_TENANT_ID,
        [
          {
            alertCreatedFor: ['PAYMENT_DETAILS'],
          },
        ],
        async () => {
          // Create case
          let firstCase: Case
          {
            const transaction = getTestTransaction({
              transactionId: '111',
              originUserId: undefined,
              originPaymentDetails: paymentDetails,
              destinationUserId: undefined,
              destinationPaymentDetails: undefined,
            })
            const results = await bulkVerifyTransactions(TEST_TENANT_ID, [
              transaction,
            ])
            expect(results).toHaveLength(1)
            const [result] = results
            const subjects = await caseCreationService.getTransactionSubjects({
              ...transaction,
              ...result,
            })
            const cases = await caseCreationService.handleTransaction(
              {
                ...transaction,
                ...result,
              },
              await getHitRuleInstances(TEST_TENANT_ID, result),
              subjects
            )
            expect(cases).toHaveLength(1)
            firstCase = cases[0]
          }

          // Add transaction, it should land into existed case
          {
            const transaction = getTestTransaction({
              transactionId: '222',
              originUserId: undefined,
              originPaymentDetails: paymentDetails,
              destinationUserId: undefined,
              destinationPaymentDetails: undefined,
            })
            const results = await bulkVerifyTransactions(TEST_TENANT_ID, [
              transaction,
            ])
            expect(results.length).not.toEqual(0)
            const [result] = results
            const cases = await caseCreationService.handleTransaction(
              {
                ...transaction,
                ...result,
              },
              await getHitRuleInstances(TEST_TENANT_ID, result),
              await caseCreationService.getTransactionSubjects({
                ...transaction,
                ...result,
              })
            )

            expect(cases).toHaveLength(1)
            const nextCase = cases[0]
            expect(nextCase.caseId).toEqual(firstCase.caseId)
            expect(nextCase.caseTransactionsIds).toHaveLength(2)
          }
        }
      )
    })
  })
})

describe('Test alert auto assignment', () => {
  beforeAll(async () => {
    MockDate.set(TODAY)
  })

  describe('alert assignment to email', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpUsersHooks(TEST_TENANT_ID, [TEST_USER_1, TEST_USER_2])
    test('Assign alert to a user', async () => {
      await underRules(
        TEST_TENANT_ID,
        [
          {
            alertAssignees: ['TESTERID'],
          },
        ],
        async () => {
          const alerts = await createAlerts(TEST_TENANT_ID)
          for (const alert of alerts) {
            expect(alert.assignments?.at(0)?.assigneeUserId).toEqual('TESTERID')
          }
        }
      )
    })
  })
})

/** Testing `Don't Add Transactions to alerts */

describe('Testing not adding transactions to alerts in selected status (Frozen Statuses)', () => {
  beforeAll(async () => {
    MockDate.set(TODAY)
  })

  describe('not adding transaction to ON_HOLD alerts ', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpUsersHooks(TEST_TENANT_ID, [TEST_USER_1, TEST_USER_2])
    test('testing not adding transactions', async () => {
      await underRules(
        TEST_TENANT_ID,
        [
          {
            frozenStatuses: ['ON_HOLD'],
          },
        ],
        async () => {
          const { caseCreationService, alertsRepository } = await getServices(
            TEST_TENANT_ID
          )
          MockDate.set(TODAY)

          const transaction1 = getTestTransaction({
            originUserId: TEST_USER_1.userId,
            destinationUserId: TEST_USER_2.userId,
          })

          const results = await bulkVerifyTransactions(TEST_TENANT_ID, [
            transaction1,
          ])
          const [result] = results

          const subjects = await caseCreationService.getTransactionSubjects({
            ...transaction1,
            ...result,
          })
          const cases = await caseCreationService.handleTransaction(
            {
              ...transaction1,
              ...result,
            },
            await getHitRuleInstances(TEST_TENANT_ID, result),
            subjects
          )
          const selectedAlert = cases[0].alerts?.[0]
          await alertsRepository.updateStatus(
            [selectedAlert?.alertId as string],
            [selectedAlert?.caseId as string],
            {
              userId: TEST_USER_1.userId,
              caseStatus: 'OPEN_ON_HOLD',
              timestamp: Date.now(),
            }
          )
          const transaction2 = getTestTransaction({
            originUserId: TEST_USER_1.userId,
            destinationUserId: TEST_USER_2.userId,
          })

          const results2 = await bulkVerifyTransactions(TEST_TENANT_ID, [
            transaction2,
          ])
          const [result2] = results2

          const subjects2 = await caseCreationService.getTransactionSubjects({
            ...transaction2,
            ...result2,
          })
          const cases2 = await caseCreationService.handleTransaction(
            {
              ...transaction2,
              ...result2,
            },
            await getHitRuleInstances(TEST_TENANT_ID, result2),
            subjects2
          )
          expect(cases2[0].alerts).toHaveLength(2) // 2 alerts because the first alert is ON_HOLD
          expect(cases2[0].alerts?.[0].transactionIds).toHaveLength(1) // 1 transaction because the first alert is ON_HOLD so not added
          expect(cases2[1].alerts).toHaveLength(1) // 1 alert as the new transaction is added to the case for the other user
          expect(cases2[1].alerts?.[0].transactionIds).toHaveLength(2) // 2 transaction in one alert in the case for the other user as that alert is not on hold
        }
      )
    })
  })
})

/*
  Helpers
 */

function setupUsers(
  tenantId: string,
  users: (User | InternalUser)[] = [TEST_USER_1, TEST_USER_2]
) {
  setUpUsersHooks(tenantId, users)
}

function setupRules(
  tenantId: string,
  parameters: {
    hitDirections?: RuleHitDirection[]
    rulesCount?: number
    ruleType?: RuleType
  } = {}
) {
  const ruleType = parameters.ruleType ?? 'TRANSACTION'
  for (let i = 0; i < (parameters.rulesCount ?? 1); i += 1) {
    setUpRulesHooks(tenantId, [
      {
        id: `${ruleType}-R-${i}`,
        type: ruleType,
        ruleImplementationName: 'tests/test-always-hit-rule',
        parameters: {
          hitDirections: parameters.hitDirections,
        },
      },
    ])
  }
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

async function underRules<R = void>(
  tenantId: string,
  rules: {
    ruleInstanceId?: string
    hitDirections?: RuleHitDirection[]
    rulesCount?: number
    ruleType?: RuleType
    alertCreationInterval?:
      | AlertCreationIntervalInstantly
      | AlertCreationIntervalWeekly
      | AlertCreationIntervalMonthly
    alertCreatedFor?: AlertCreatedForEnum[]
    alertAssignees?: string[]
    alertAssigneeRole?: string
    frozenStatuses?: DerivedStatus[]
  }[],
  cb: () => Promise<R>
): Promise<R> {
  const deleteRules = await Promise.all(
    rules.map(async (parameters, i) => {
      const ruleType = parameters.ruleType ?? 'TRANSACTION'
      return await createRule(
        tenantId,
        {
          ruleImplementationName: 'tests/test-always-hit-rule',
        },
        {
          id: parameters.ruleInstanceId ?? `${ruleType}-R-${i + 1}`,
          type: ruleType,
          parameters: {
            hitDirections: parameters.hitDirections,
          },
          alertConfig: {
            alertAssigneeRole: parameters.alertAssigneeRole,
            alertAssignees: parameters.alertAssignees,
            alertCreationInterval: parameters.alertCreationInterval,
            frozenStatuses: parameters.frozenStatuses,
            alertCreatedFor: parameters.alertCreatedFor ?? ['USER'],
          },
        }
      )
    })
  )
  const result = await cb()
  await Promise.all(deleteRules.map((deleteRule) => deleteRule()))
  return result
}

async function createCases(
  tenantId: string,
  date: string = TODAY
): Promise<Case[]> {
  const { caseCreationService } = await getServices(tenantId)
  MockDate.set(date)

  const transaction = getTestTransaction({
    originUserId: TEST_USER_1.userId,
    destinationUserId: undefined,
  })

  const results = await bulkVerifyTransactions(tenantId, [transaction])
  expect(results.length).not.toEqual(0)
  const [result] = results

  const subjects = await caseCreationService.getTransactionSubjects({
    ...transaction,
    ...result,
  })
  const cases = await caseCreationService.handleTransaction(
    {
      ...transaction,
      ...result,
    },
    await getHitRuleInstances(tenantId, result),
    subjects
  )
  return cases
}

async function createCase(tenantId: string): Promise<Case> {
  const cases = await createCases(tenantId)

  expect(cases.length).toEqual(1)
  const caseItem = expectUserCase(cases, {
    originUserId: TEST_USER_1.userId,
  })
  return caseItem
}

async function createAlerts(tenantId: string): Promise<Alert[]> {
  const caseItem = await createCase(tenantId)
  expect(caseItem.alerts).toBeDefined()
  return caseItem.alerts ?? []
}
