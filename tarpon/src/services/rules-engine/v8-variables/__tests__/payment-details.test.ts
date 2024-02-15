import {
  TRANSACTION_PAYMENT_DETAILS_IDENTIFIER_RECEIVER,
  TRANSACTION_PAYMENT_DETAILS_IDENTIFIER_SENDER,
} from '../payment-details'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'

import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'

const TEST_TENANT_ID = getTestTenantId()

const TEST_BANK_DETAILS = {
  method: 'GENERIC_BANK_ACCOUNT',
  accountNumber: '1234567890',
  accountType: 'checking',
  bankCode: '1234',
}

const TEST_CARD_DETAILS = {
  method: 'CARD',
  cardFingerprint: '1234567890',
  cardType: 'VIRTUAL',
  '3dsDone': true,
}

const dynamoDb = getDynamoDbClient()

test('Transaction non-user sender key', async () => {
  const value = await TRANSACTION_PAYMENT_DETAILS_IDENTIFIER_SENDER.load(
    getTestTransaction({
      originPaymentDetails: TEST_BANK_DETAILS as PaymentDetails,
    }),
    { tenantId: TEST_TENANT_ID, dynamoDb }
  )

  expect(value).toBe('accountNumber:1234567890#accountType:checking')

  const value2 = await TRANSACTION_PAYMENT_DETAILS_IDENTIFIER_SENDER.load(
    getTestTransaction({
      originPaymentDetails: TEST_CARD_DETAILS as PaymentDetails,
    }),

    { tenantId: TEST_TENANT_ID, dynamoDb }
  )
  expect(value2).toBe('cardFingerprint:1234567890')

  const value3 = await TRANSACTION_PAYMENT_DETAILS_IDENTIFIER_SENDER.load(
    getTestTransaction({
      originPaymentDetails: undefined,
    }),

    { tenantId: TEST_TENANT_ID, dynamoDb }
  )
  expect(value3).toBe('')
})
test('Transaction non-user receiver key', async () => {
  const value = await TRANSACTION_PAYMENT_DETAILS_IDENTIFIER_RECEIVER.load(
    getTestTransaction({
      destinationPaymentDetails: TEST_BANK_DETAILS as PaymentDetails,
    }),
    { tenantId: TEST_TENANT_ID, dynamoDb }
  )

  expect(value).toBe('accountNumber:1234567890#accountType:checking')

  const value2 = await TRANSACTION_PAYMENT_DETAILS_IDENTIFIER_RECEIVER.load(
    getTestTransaction({
      destinationPaymentDetails: TEST_CARD_DETAILS as PaymentDetails,
    }),
    { tenantId: TEST_TENANT_ID, dynamoDb }
  )
  expect(value2).toBe('cardFingerprint:1234567890')

  const value3 = await TRANSACTION_PAYMENT_DETAILS_IDENTIFIER_RECEIVER.load(
    getTestTransaction({
      destinationPaymentDetails: undefined,
    }),
    { tenantId: TEST_TENANT_ID, dynamoDb }
  )
  expect(value3).toBe('')
})
