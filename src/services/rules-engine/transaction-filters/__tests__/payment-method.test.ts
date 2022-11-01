import PaymentMethodRuleFilter from '../payment-method'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

const dynamodb = getDynamoDbClient()

test('Transaction origin payment method matches the filter', async () => {
  expect(
    await new PaymentMethodRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: { method: 'CARD' },
          destinationPaymentDetails: undefined,
        }),
      },
      { paymentMethod: 'CARD' },
      dynamodb
    ).predicate()
  ).toBe(true)
})

test("Transaction origin payment method doesn't match the filter", async () => {
  expect(
    await new PaymentMethodRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: { method: 'ACH' },
          destinationPaymentDetails: undefined,
        }),
      },
      { paymentMethod: 'CARD' },
      dynamodb
    ).predicate()
  ).toBe(false)
  expect(
    await new PaymentMethodRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: undefined,
          destinationPaymentDetails: undefined,
        }),
      },
      { paymentMethod: 'CARD' },
      dynamodb
    ).predicate()
  ).toBe(false)
})

test('Transaction destination payment method matches the filter', async () => {
  expect(
    await new PaymentMethodRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: undefined,
          destinationPaymentDetails: { method: 'CARD' },
        }),
      },
      { paymentMethod: 'CARD' },
      dynamodb
    ).predicate()
  ).toBe(true)
})

test("Transaction destination payment method doesn't match the filter", async () => {
  expect(
    await new PaymentMethodRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: undefined,
          destinationPaymentDetails: { method: 'ACH' },
        }),
      },
      { paymentMethod: 'CARD' },
      dynamodb
    ).predicate()
  ).toBe(false)
  expect(
    await new PaymentMethodRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: undefined,
          destinationPaymentDetails: undefined,
        }),
      },
      { paymentMethod: 'CARD' },
      dynamodb
    ).predicate()
  ).toBe(false)
})
