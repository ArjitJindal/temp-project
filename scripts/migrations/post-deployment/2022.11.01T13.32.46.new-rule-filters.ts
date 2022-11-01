import { deleteUnusedRuleParameter } from '../utils/rule'

export const up = async () => {
  await deleteUnusedRuleParameter(
    undefined,
    [],
    ['userType', 'paymentMethod', 'ageRange']
  )
  await deleteUnusedRuleParameter(
    undefined,
    ['consecutive-transactions-same-type'],
    ['transactionTypes']
  )
  await deleteUnusedRuleParameter(
    undefined,
    ['high-unsuccessfull-state-rate'],
    ['transactionState']
  )
}
export const down = async () => {
  // Put your migration code for rolling back here. If not applicable, skip it.
}
