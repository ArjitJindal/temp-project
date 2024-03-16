import { v4 as uuidv4 } from 'uuid'
import { createUsersForTransactions } from './user-test-utils'
import dayjs from '@/utils/dayjs'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'

export function getTestTransaction(
  transaction: Partial<Transaction | InternalTransaction> = {}
): Transaction {
  return {
    type: 'TRANSFER',
    transactionId: uuidv4(),
    transactionState: 'SUCCESSFUL',
    originUserId: '8650a2611d0771cba03310f74bf6',
    destinationUserId: '9350a2611e0771cba03310f74bf6',
    originAmountDetails: {
      country: 'DE',
      transactionAmount: 800,
      transactionCurrency: 'EUR',
    },
    destinationAmountDetails: {
      country: 'IN',
      transactionAmount: 68351.34,
      transactionCurrency: 'INR',
    },
    promotionCodeUsed: true,
    timestamp: dayjs().valueOf(),
    originPaymentDetails: {
      method: 'CARD',
      cardFingerprint: uuidv4(),
      cardIssuedCountry: 'US',
      transactionReferenceField: 'DEPOSIT',
      '3dsDone': true,
    },
    destinationPaymentDetails: {
      method: 'CARD',
      cardFingerprint: uuidv4(),
      cardIssuedCountry: 'IN',
      transactionReferenceField: 'DEPOSIT',
      '3dsDone': true,
    },
    ...transaction,
  }
}

export async function createTransaction(
  testTenantId: string,
  transaction: Transaction
): Promise<() => Promise<void>> {
  const transactionRepository = new DynamoDbTransactionRepository(
    testTenantId,
    getDynamoDbClient()
  )
  await transactionRepository.saveTransaction(transaction, {
    executedRules: [],
    hitRules: [],
  })

  return async () => {
    await transactionRepository.deleteTransaction(transaction)
  }
}

export function setUpTransactionsHooks(
  tenantId: string,
  transactions: Transaction[]
) {
  const cleanUps: Array<() => Promise<void>> = []

  beforeAll(async () => {
    cleanUps.push(
      ...(await Promise.all(
        await createUsersForTransactions(tenantId, transactions)
      ))
    )

    cleanUps.push(
      ...(await Promise.all(
        transactions.map(async (transaction) => {
          return createTransaction(tenantId, transaction)
        })
      ))
    )
  })

  afterAll(async () => {
    await Promise.all(cleanUps.map((cleanUp) => cleanUp()))
  })
}
