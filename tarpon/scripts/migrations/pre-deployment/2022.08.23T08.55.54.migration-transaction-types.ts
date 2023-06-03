import { MigrationFn } from 'umzug'
import { renameRuleParameter } from '../utils/rule'
import { TransactionType } from '@/@types/openapi-public/TransactionType'

export const up: MigrationFn = async () => {
  await renameRuleParameter(
    undefined,
    [],
    'transactionType',
    'transactionTypes',
    (transactionType: TransactionType) => [transactionType]
  )
  await renameRuleParameter(
    undefined,
    [],
    'targetTransactionType',
    'transactionTypes',
    (transactionType: TransactionType) => [transactionType]
  )
}
export const down: MigrationFn = async () => {
  // skip
}
