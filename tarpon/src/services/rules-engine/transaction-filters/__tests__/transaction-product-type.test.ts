import { TransactionProductTypesRuleFilter } from '../transaction-product-types'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { filterVariantsTest } from '@/test-utils/filter-test-utils'

const dynamodb = getDynamoDbClient()

filterVariantsTest({ v8: true }, () => {
  test('Product type missing', async () => {
    expect(
      await new TransactionProductTypesRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            productType: undefined,
          }),
        },
        { productTypes: ['ELECTRONICS'] },
        dynamodb
      ).predicate()
    ).toBe(false)
  })

  test('Product type matches the filter', async () => {
    expect(
      await new TransactionProductTypesRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            productType: 'ELECTRONICS',
          }),
        },
        { productTypes: ['ELECTRONICS'] },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test("Product type doesn't match the filter", async () => {
    expect(
      await new TransactionProductTypesRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            productType: 'ELECTRONICS',
          }),
        },
        { productTypes: ['FURNITURE'] },
        dynamodb
      ).predicate()
    ).toBe(false)
  })
  test('Filter not specified, transaction product type exists', async () => {
    expect(
      await new TransactionProductTypesRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            productType: 'ELECTRONICS',
          }),
        },
        {},
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('Filter not specified, transaction product type missing', async () => {
    expect(
      await new TransactionProductTypesRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            productType: undefined,
          }),
        },
        {},
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('Transaction product type matches a substring of the filter', async () => {
    expect(
      await new TransactionProductTypesRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            productType: 'ELECTRONICS',
          }),
        },
        { productTypes: ['ELEC'] },
        dynamodb
      ).predicate()
    ).toBe(false)
  })

  test('Transaction product type matches a different case of the filter', async () => {
    expect(
      await new TransactionProductTypesRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            productType: 'Electronics',
          }),
        },
        { productTypes: ['ELECTRONICS'] },
        dynamodb
      ).predicate()
    ).toBe(false)
  })
})
