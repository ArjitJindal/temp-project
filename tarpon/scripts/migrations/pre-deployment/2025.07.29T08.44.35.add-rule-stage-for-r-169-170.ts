import { addRuleParameter } from '../utils/rule'

export const up = async () => {
  await addRuleParameter(
    ['sanctions-counterparty', 'payment-details-screening'],
    'ruleStages',
    ['INITIAL', 'UPDATE']
  )
}
export const down = async () => {
  // skip
}
