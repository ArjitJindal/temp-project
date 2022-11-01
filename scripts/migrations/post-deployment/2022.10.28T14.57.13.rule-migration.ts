import { deleteUnusedRuleParameter } from '../utils/rule'

export const up = async () => {
  await deleteUnusedRuleParameter(
    ['card-holder-name-levensthein-distance'],
    [],
    ['allowedDistance']
  )
}
export const down = async () => {
  // skip
}
