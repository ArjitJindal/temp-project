import { deleteUnusedRuleParameter } from '../utils/rule'

export const up = async () => {
  await deleteUnusedRuleParameter(
    ['payment-method-name-levensthein-distance'],
    [],
    ['checkDirection']
  )
}
export const down = async () => {
  // skip
}
