import { PaymentFilterRuleFilter } from '../payment-filters'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

const dynamodb = getDynamoDbClient()

test('Transaction origin payment method matches the filter', async () => {
  expect(
    await new PaymentFilterRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: { method: 'CARD' },
          destinationPaymentDetails: undefined,
        }),
      },
      { paymentFilters: { paymentMethods: ['CARD'] } },
      dynamodb
    ).predicate()
  ).toBe(true)
})

test("Transaction origin payment method doesn't match the filter", async () => {
  expect(
    await new PaymentFilterRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: { method: 'ACH' },
          destinationPaymentDetails: undefined,
        }),
      },
      { paymentFilters: { paymentMethods: ['CARD'] } },
      dynamodb
    ).predicate()
  ).toBe(false)
  expect(
    await new PaymentFilterRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: undefined,
          destinationPaymentDetails: undefined,
        }),
      },
      { paymentFilters: { paymentMethods: ['CARD'] } },
      dynamodb
    ).predicate()
  ).toBe(false)
})

test('Transaction destination payment method matches the filter', async () => {
  expect(
    await new PaymentFilterRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: undefined,
          destinationPaymentDetails: { method: 'CARD' },
        }),
      },
      { paymentFilters: { paymentMethods: ['CARD'] } },
      dynamodb
    ).predicate()
  ).toBe(true)
})

test("Transaction destination payment method doesn't match the filter", async () => {
  expect(
    await new PaymentFilterRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: undefined,
          destinationPaymentDetails: { method: 'ACH' },
        }),
      },
      { paymentFilters: { paymentMethods: ['CARD'] } },
      dynamodb
    ).predicate()
  ).toBe(false)
  expect(
    await new PaymentFilterRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: undefined,
          destinationPaymentDetails: undefined,
        }),
      },
      { paymentFilters: { paymentMethods: ['CARD'] } },
      dynamodb
    ).predicate()
  ).toBe(false)
})

test('Transaction origin and destination payment methods match the filter and no payment method is specified', async () => {
  expect(
    await new PaymentFilterRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: { method: 'CARD' },
          destinationPaymentDetails: { method: 'CARD' },
        }),
      },
      { paymentFilters: { paymentMethods: [] } },
      dynamodb
    ).predicate()
  ).toBe(true)
})

test('Transaction Payment Channel matches the filter', async () => {
  expect(
    await new PaymentFilterRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: { method: 'CARD', paymentChannel: 'ONLINE' },
          destinationPaymentDetails: undefined,
        }),
      },
      {
        paymentFilters: {
          paymentMethods: ['CARD'],
          cardPaymentChannels: ['ONLINE'],
        },
      },
      dynamodb
    ).predicate()
  ).toBe(true)
})

test("Transaction Payment Channel doesn't match the filter", async () => {
  expect(
    await new PaymentFilterRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: { method: 'CARD', paymentChannel: 'ONLINE' },
          destinationPaymentDetails: undefined,
        }),
      },
      {
        paymentFilters: {
          paymentMethods: ['CARD'],
          cardPaymentChannels: ['IN_PERSON'],
        },
      },
      dynamodb
    ).predicate()
  ).toBe(false)
})

test('Transaction origin and destination payment channels match the filter and no payment channel is specified', async () => {
  expect(
    await new PaymentFilterRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: { method: 'CARD', paymentChannel: 'ONLINE' },
          destinationPaymentDetails: {
            method: 'CARD',
            paymentChannel: 'ONLINE',
          },
        }),
      },
      {
        paymentFilters: {
          cardPaymentChannels: [],
          paymentMethods: ['CARD'],
        },
      },
      dynamodb
    ).predicate()
  ).toBe(true)
})

test('Transaction origin and destination payment channels match the filter and no payment channel is specified', async () => {
  expect(
    await new PaymentFilterRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: { method: 'CARD', paymentChannel: 'ONLINE' },
          destinationPaymentDetails: {
            method: 'CARD',
            paymentChannel: 'ONLINE',
          },
        }),
      },
      {
        paymentFilters: {
          cardPaymentChannels: [],
          paymentMethods: ['CARD'],
        },
      },
      dynamodb
    ).predicate()
  ).toBe(true)
})

test('Transaction origin and destination payment channels match the filter and no payment channel is specified', async () => {
  expect(
    await new PaymentFilterRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: { method: 'CARD', paymentChannel: 'ONLINE' },
          destinationPaymentDetails: {
            method: 'CARD',
            paymentChannel: 'ONLINE',
          },
        }),
      },
      { paymentFilters: { cardPaymentChannels: [], paymentMethods: ['CARD'] } },
      dynamodb
    ).predicate()
  ).toBe(true)
})

test('Payment Method Filter is Wallet', async () => {
  expect(
    await new PaymentFilterRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: {
            method: 'CARD',
            paymentChannel: 'ONLINE',
          },
          destinationPaymentDetails: undefined,
        }),
      },
      {
        paymentFilters: {
          paymentMethods: ['WALLET'],
          cardPaymentChannels: [],
        },
      },
      dynamodb
    ).predicate()
  ).toBe(false)
})

test('Payment Method Filter is Wallet and Payment Channel is Online', async () => {
  expect(
    await new PaymentFilterRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: {
            method: 'CARD',
            paymentChannel: 'ONLINE',
          },
          destinationPaymentDetails: undefined,
        }),
      },
      {
        paymentFilters: {
          paymentMethods: ['WALLET'],
          cardPaymentChannels: ['ONLINE'],
        },
      },
      dynamodb
    ).predicate()
  ).toBe(false)
})

test('Payment Method Filter is Wallet and Wallet Provider is Apple Pay', async () => {
  expect(
    await new PaymentFilterRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: {
            method: 'WALLET',
            walletType: 'APPLE_PAY',
          },
          destinationPaymentDetails: undefined,
        }),
      },
      {
        paymentFilters: {
          paymentMethods: ['WALLET'],
          cardPaymentChannels: [],
          walletType: 'APPLE_PAY',
        },
      },
      dynamodb
    ).predicate()
  ).toBe(true)
})

test('Card Issued Country Matches But walltype is not but still returns true', async () => {
  expect(
    await new PaymentFilterRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: {
            method: 'CARD',
            cardIssuedCountry: 'US',
          },
          destinationPaymentDetails: {
            method: 'WALLET',
            walletType: 'APPLE_PAY',
          },
        }),
      },
      {
        paymentFilters: {
          paymentMethods: ['WALLET', 'CARD'],
          cardPaymentChannels: [],
          walletType: 'GOOGLE_PAY',
          cardIssuedCountries: ['US'],
        },
      },
      dynamodb
    ).predicate()
  ).toBe(true)
})
