import { renameRuleParameter } from '../utils/rule'
import { TransactionType } from '@/@types/openapi-public/TransactionType'

async function main() {
  await renameRuleParameter(
    undefined,
    'transactionType',
    'transactionTypes',
    (transactionType: TransactionType) => [transactionType]
  )
  await renameRuleParameter(
    undefined,
    'targetTransactionType',
    'transactionTypes',
    (transactionType: TransactionType) => [transactionType]
  )
}

main()
