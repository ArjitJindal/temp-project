import { v4 as uuidv4 } from 'uuid'
import { createUsersForTransactions } from './user-test-utils'
import dayjs from '@/utils/dayjs'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TransactionWithRulesResult } from '@/@types/openapi-internal/TransactionWithRulesResult'
import { TransactionEvent } from '@/@types/openapi-internal/TransactionEvent'
import { TransactionEventWithRulesResult } from '@/@types/openapi-public/TransactionEventWithRulesResult'

export function getTestTransactionEvent(
  transactionEvent: Partial<TransactionEventWithRulesResult> = {}
): TransactionEvent {
  return {
    transactionState: 'CREATED',
    timestamp: dayjs().valueOf(),
    transactionId: uuidv4(),
    eventId: uuidv4(),
    reason: 'Some reason',
    eventDescription: 'Some description',
    updatedTransactionAttributes: {},
    ...transactionEvent,
  }
}

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
  transaction: Transaction | TransactionWithRulesResult
): Promise<() => Promise<void>> {
  const transactionRepository = new DynamoDbTransactionRepository(
    testTenantId,
    getDynamoDbClient()
  )

  await transactionRepository.saveTransaction(transaction, {
    executedRules:
      (transaction as TransactionWithRulesResult).executedRules ?? [],
    hitRules: (transaction as TransactionWithRulesResult).hitRules ?? [],
  })
  return async () => {
    await transactionRepository.deleteTransaction(transaction)
  }
}

export function setUpTransactionsHooks(
  tenantId: string,
  transactions: Array<Transaction | TransactionWithRulesResult>
) {
  const cleanUps: Array<() => Promise<void>> = []

  beforeAll(async () => {
    cleanUps.push(
      ...(await Promise.all(
        await createUsersForTransactions(tenantId, transactions)
      ))
    )

    for (const transaction of transactions) {
      cleanUps.push(await createTransaction(tenantId, transaction))
    }
  })

  afterAll(async () => {
    await Promise.all(cleanUps.map((cleanUp) => cleanUp()))
  })
}

process.env.__ASYNC_RULES_IN_SYNC_TEST__ = 'false'

export function enableAsyncRulesInTest() {
  process.env.__ASYNC_RULES_IN_SYNC_TEST__ = 'true'
}

export function disableAsyncRulesInTest() {
  process.env.__ASYNC_RULES_IN_SYNC_TEST__ = 'false'
}

export function withAsyncRulesSync() {
  beforeAll(() => {
    enableAsyncRulesInTest()
  })

  afterAll(() => {
    disableAsyncRulesInTest()
  })
}
