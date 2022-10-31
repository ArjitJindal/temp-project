import { renameRuleParameter } from '../utils/rule'

export const up = async () => {
  await renameRuleParameter(
    ['card-holder-name-levensthein-distance'],
    'allowedDistance',
    'allowedDistancePercentage',
    (allowedDistance: number) => allowedDistance
  )
}
export const down = async () => {
  // skip
}
