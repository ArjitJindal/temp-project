import { renameRuleParameter } from '../utils/rule'

export const up = async () => {
  await renameRuleParameter(
    ['sanctions-consumer-user'],
    [],
    'fuzziness',
    'fuzzinessRange',
    (value) => ({
      lowerBound: value,
      upperBound: value,
    })
  )
}
export const down = async () => {
  // skip
}
