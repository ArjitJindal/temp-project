import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { ListRepository } from '@/lambdas/console-api-list-importer/repositories/list-repository'
import {
  setUpRulesHooks,
  testRuleDescriptionFormatting,
} from '@/test-utils/rule-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { getTransactionRuleByRuleId } from '@/services/rules-engine/transaction-rules/library'

dynamoDbSetupHook()

const TEST_TENANT_ID = getTestTenantId()
const dynamoDb = getDynamoDbClient()
const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)

const BLACK_LIST_TYPE = 'BLACKLIST'
const TEST_LIST_ID = 'test-1'

describe('R-132 User ID', () => {
  beforeAll(async () => {
    await listRepo.createList(
      BLACK_LIST_TYPE,
      'USER_ID',
      {
        items: [
          {
            key: 'A',
          },
        ],
        metadata: {
          status: true,
        },
      },
      TEST_LIST_ID
    )
  })

  const test1 = getTestTransaction({
    originUserId: 'A',
  })

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'blacklist-transaction-related-value',
      defaultParameters: {
        blackListId: TEST_LIST_ID,
      },
      defaultAction: 'BLOCK',
    },
  ])

  testRuleDescriptionFormatting(
    'first',
    TEST_TENANT_ID,
    [test1],
    {
      descriptionTemplate:
        getTransactionRuleByRuleId('R-132').descriptionTemplate,
    },
    ['A is blacklisted in Blacklist ID test-1 for User ID field.']
  )
})

describe('R-132 Swift Code', () => {
  beforeAll(async () => {
    await listRepo.createList(
      BLACK_LIST_TYPE,
      'BANK_SWIFT_CODE',
      {
        items: [
          {
            key: 'BCD',
          },
        ],
        metadata: {
          status: true,
        },
      },
      TEST_LIST_ID
    )
  })

  const test1 = getTestTransaction({
    originPaymentDetails: {
      method: 'SWIFT',
      swiftCode: 'BCD',
    },
  })

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'blacklist-transaction-related-value',
      defaultParameters: {
        blackListId: TEST_LIST_ID,
      },
      defaultAction: 'BLOCK',
    },
  ])

  testRuleDescriptionFormatting(
    'first',
    TEST_TENANT_ID,
    [test1],
    {
      descriptionTemplate:
        getTransactionRuleByRuleId('R-132').descriptionTemplate,
    }, //`A is blacklisted in Blacklist ID (uuid regex) for User ID field.

    ['BCD is blacklisted in Blacklist ID test-1 for Bank Swift Code field.']
  )
})
