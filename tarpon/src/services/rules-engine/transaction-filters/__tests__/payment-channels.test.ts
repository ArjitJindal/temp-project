import { PaymentChannelsRuleFilter } from '../payment-channels'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { CardDetails } from '@/@types/openapi-public/CardDetails'

const dynamodb = getDynamoDbClient()

test('Transaction origin payment method matches the filter', async () => {
  expect(
    await new PaymentChannelsRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: {
            method: 'CARD',
            paymentChannel: 'test1',
          } as CardDetails,
          destinationPaymentDetails: undefined,
        }),
      },
      { paymentChannels: ['test1'] },
      dynamodb
    ).predicate()
  ).toBe(true)
})

test("Transaction origin payment method doesn't match the filter", async () => {
  expect(
    await new PaymentChannelsRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: {
            method: 'CARD',
            paymentChannel: 'test2',
          } as CardDetails,
          destinationPaymentDetails: undefined,
        }),
      },
      { paymentChannels: ['test1'] },
      dynamodb
    ).predicate()
  ).toBe(false)
  expect(
    await new PaymentChannelsRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: undefined,
          destinationPaymentDetails: undefined,
        }),
      },
      { paymentChannels: ['test1'] },
      dynamodb
    ).predicate()
  ).toBe(false)
})

test('Transaction destination payment method matches the filter', async () => {
  expect(
    await new PaymentChannelsRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: undefined,
          destinationPaymentDetails: {
            method: 'CARD',
            paymentChannel: 'test1',
          } as CardDetails,
        }),
      },
      { paymentChannels: ['test1'] },
      dynamodb
    ).predicate()
  ).toBe(false) // Destination payment method is not supported by this filter
})

test("Transaction destination payment method doesn't match the filter", async () => {
  expect(
    await new PaymentChannelsRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: undefined,
          destinationPaymentDetails: {
            method: 'CARD',
            paymentChannel: 'test2',
          } as CardDetails,
        }),
      },
      { paymentChannels: ['test1'] },
      dynamodb
    ).predicate()
  ).toBe(false)
})

test("Transaction origin and destination payment method don't match the filter", async () => {
  expect(
    await new PaymentChannelsRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: undefined,
          destinationPaymentDetails: undefined,
        }),
      },
      { paymentChannels: ['test1'] },
      dynamodb
    ).predicate()
  ).toBe(false)
})
