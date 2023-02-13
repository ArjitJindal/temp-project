import { renameRuleFilter, renameRuleParameter } from '../utils/rule'
import { TransactionState } from '@/@types/openapi-public/TransactionState'

export const up = async () => {
  await renameRuleParameter(
    ['high-unsuccessfull-state-rate'],
    [],
    'transactionState',
    'transactionStates',
    (transactionState: TransactionState) => [transactionState]
  )
  await renameRuleFilter(
    'transactionState',
    'transactionStates',
    (transactionState: TransactionState) => [transactionState]
  )
}
export const down = async () => {
  // skip
}
