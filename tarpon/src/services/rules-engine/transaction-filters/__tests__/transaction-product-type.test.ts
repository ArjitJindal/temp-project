import { TransactionProductTypeRuleFilter } from '../transaction-product-type'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

const dynamodb = getDynamoDbClient()

test('Product type missing', async () => {
  expect(
    await new TransactionProductTypeRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          productType: undefined,
        }),
      },
      { productType: 'ELECTRONICS' },
      dynamodb
    ).predicate()
  ).toBe(false)
})

test('Product type matches the filter', async () => {
  expect(
    await new TransactionProductTypeRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          productType: 'ELECTRONICS',
        }),
      },
      { productType: 'ELECTRONICS' },
      dynamodb
    ).predicate()
  ).toBe(true)
})

test("Product type doesn't match the filter", async () => {
  expect(
    await new TransactionProductTypeRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          productType: 'ELECTRONICS',
        }),
      },
      { productType: 'FURNITURE' },
      dynamodb
    ).predicate()
  ).toBe(false)
})
test('Filter not specified, transaction product type exists', async () => {
  expect(
    await new TransactionProductTypeRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          productType: 'ELECTRONICS',
        }),
      },
      {},
      dynamodb
    ).predicate()
  ).toBe(false)
})

test('Filter not specified, transaction product type missing', async () => {
  expect(
    await new TransactionProductTypeRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          productType: undefined,
        }),
      },
      {},
      dynamodb
    ).predicate()
  ).toBe(false)
})

test('Transaction product type matches a substring of the filter', async () => {
  expect(
    await new TransactionProductTypeRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          productType: 'ELECTRONICS',
        }),
      },
      { productType: 'ELEC' },
      dynamodb
    ).predicate()
  ).toBe(false)
})

test('Transaction product type matches a different case of the filter', async () => {
  expect(
    await new TransactionProductTypeRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          productType: 'Electronics',
        }),
      },
      { productType: 'electronics' },
      dynamodb
    ).predicate()
  ).toBe(false)
})
