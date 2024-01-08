import { TransactionRuleVariable } from './types'
import { createTransactionListRuleVariable } from './utils/variables'

export const TRANSACTION_ID: TransactionRuleVariable<string> =
  createTransactionListRuleVariable<string>({
    key: 'transactionId',
    label: 'transaction id',
    load: async (transaction) => transaction.transactionId,
  })
