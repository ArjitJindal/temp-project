import { deleteUnusedRuleParameter } from '../utils/rule'

export const up = async () => {
  await deleteUnusedRuleParameter(
    ['sanctions-consumer-user'],
    [],
    ['fuzziness']
  )
}
export const down = async () => {
  // skip
}
