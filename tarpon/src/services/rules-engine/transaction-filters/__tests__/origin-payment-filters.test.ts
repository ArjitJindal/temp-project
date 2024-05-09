import { OriginPaymentFilterRuleFilter } from '../origin-payment-filter'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { filterVariantsTest } from '@/test-utils/filter-test-utils'

const dynamodb = getDynamoDbClient()
filterVariantsTest({ v8: true }, () => {
  test('Transaction origin payment method matches the filter', async () => {
    expect(
      await new OriginPaymentFilterRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            originPaymentDetails: { method: 'CARD' },
            destinationPaymentDetails: undefined,
          }),
        },
        { originPaymentFilters: { paymentMethods: ['CARD'] } },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test("Transaction origin payment method doesn't match the filter", async () => {
    expect(
      await new OriginPaymentFilterRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            originPaymentDetails: { method: 'ACH' },
            destinationPaymentDetails: undefined,
          }),
        },
        { originPaymentFilters: { paymentMethods: ['CARD'] } },
        dynamodb
      ).predicate()
    ).toBe(false)

    expect(
      await new OriginPaymentFilterRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            originPaymentDetails: undefined,
            destinationPaymentDetails: undefined,
          }),
        },
        { originPaymentFilters: { paymentMethods: ['CARD'] } },
        dynamodb
      ).predicate()
    ).toBe(false)
  })

  test('Transaction origin payment methods match the filter and no payment method is specified', async () => {
    expect(
      await new OriginPaymentFilterRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            originPaymentDetails: { method: 'CARD' },
            destinationPaymentDetails: { method: 'CARD' },
          }),
        },
        { originPaymentFilters: { paymentMethods: [] } },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('Transaction Payment Channel matches the filter', async () => {
    expect(
      await new OriginPaymentFilterRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            originPaymentDetails: { method: 'CARD', paymentChannel: 'ONLINE' },
            destinationPaymentDetails: undefined,
          }),
        },
        {
          originPaymentFilters: {
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
      await new OriginPaymentFilterRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            originPaymentDetails: { method: 'CARD', paymentChannel: 'ONLINE' },
            destinationPaymentDetails: undefined,
          }),
        },
        {
          originPaymentFilters: {
            paymentMethods: ['CARD'],
            cardPaymentChannels: ['IN_PERSON'],
          },
        },
        dynamodb
      ).predicate()
    ).toBe(false)
  })

  test('Transaction origin payment channels match the filter and no payment channel is specified', async () => {
    expect(
      await new OriginPaymentFilterRuleFilter(
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
          originPaymentFilters: {
            cardPaymentChannels: [],
            paymentMethods: ['CARD'],
          },
        },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('Transaction origin payment channels match the filter and no payment channel is specified', async () => {
    expect(
      await new OriginPaymentFilterRuleFilter(
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
          originPaymentFilters: {
            cardPaymentChannels: [],
            paymentMethods: ['CARD'],
          },
        },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('Transaction origin payment channels match the filter and no payment channel is specified', async () => {
    expect(
      await new OriginPaymentFilterRuleFilter(
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
          originPaymentFilters: {
            cardPaymentChannels: [],
            paymentMethods: ['CARD'],
          },
        },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('Payment Method Filter is Wallet', async () => {
    expect(
      await new OriginPaymentFilterRuleFilter(
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
          originPaymentFilters: {
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
      await new OriginPaymentFilterRuleFilter(
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
          originPaymentFilters: {
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
      await new OriginPaymentFilterRuleFilter(
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
          originPaymentFilters: {
            paymentMethods: ['WALLET'],
            cardPaymentChannels: [],
            walletType: 'APPLE_PAY',
          },
        },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('Card Issued Country Matches But walletType not but still returns true', async () => {
    expect(
      await new OriginPaymentFilterRuleFilter(
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
          originPaymentFilters: {
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
})
