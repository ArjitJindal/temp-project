import { TransactionWalletTypeRuleFilter } from '../transaction-wallet-type'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'

const dynamoDb = getDynamoDbClient()

test('Transaction wallet type matches the filter', async () => {
  expect(
    await new TransactionWalletTypeRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: {
            method: 'WALLET',
            walletType: 'PAYTM',
          },
          destinationPaymentDetails: undefined,
        }),
      },
      { walletType: 'PAYTM' },
      dynamoDb
    ).predicate()
  ).toBe(true)
})

test('Transaction wallet type does not match the origin wallet type but matches the destination wallet type', async () => {
  expect(
    await new TransactionWalletTypeRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: {
            method: 'WALLET',
            walletType: 'PAYTM',
          },
          destinationPaymentDetails: {
            method: 'WALLET',
            walletType: 'PHONEPE',
          },
        }),
      },
      { walletType: 'PHONEPE' },
      dynamoDb
    ).predicate()
  ).toBe(true)
})

test('Transaction wallet type does not match the destination wallet type but matches the origin wallet type', async () => {
  expect(
    await new TransactionWalletTypeRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: {
            method: 'WALLET',
            walletType: 'PAYTM',
          },
          destinationPaymentDetails: {
            method: 'WALLET',
            walletType: 'PHONEPE',
          },
        }),
      },
      { walletType: 'PAYTM' },
      dynamoDb
    ).predicate()
  ).toBe(true)
})

test('Transaction wallet type does not match the origin wallet type and does not match the destination wallet type', async () => {
  expect(
    await new TransactionWalletTypeRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: {
            method: 'WALLET',
            walletType: 'PAYTM',
          },
          destinationPaymentDetails: {
            method: 'WALLET',
            walletType: 'PHONEPE',
          },
        }),
      },
      { walletType: 'GOOGLE_PAY' },
      dynamoDb
    ).predicate()
  ).toBe(false)
})

test('Transaction method is not wallet', async () => {
  expect(
    await new TransactionWalletTypeRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: {
            method: 'CARD',
          },
          destinationPaymentDetails: {
            method: 'CARD',
          },
        }),
      },
      { walletType: 'PAYTM' },
      dynamoDb
    ).predicate()
  ).toBe(false)
})

test('Transaction method is wallet but filter is not set', async () => {
  expect(
    await new TransactionWalletTypeRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: {
            method: 'WALLET',
            walletType: 'PAYTM',
          },
          destinationPaymentDetails: {
            method: 'WALLET',
            walletType: 'PHONEPE',
          },
        }),
      },
      { walletType: undefined },
      dynamoDb
    ).predicate()
  ).toBe(true)
})

test('Transaction origin method is wallet but destination method is not wallet', async () => {
  expect(
    await new TransactionWalletTypeRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originPaymentDetails: {
            method: 'WALLET',
            walletType: 'PAYTM',
          },
          destinationPaymentDetails: {
            method: 'CARD',
          },
        }),
      },
      { walletType: 'PAYTM' },
      dynamoDb
    ).predicate()
  ).toBe(true)
})
