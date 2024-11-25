import { renameRuleParameter } from '../utils/rule'

export const up = async () => {
  await renameRuleParameter(
    ['sanctions-consumer-user'],
    [],
    'ongoingScreening',
    'ruleStages',
    (value) => {
      if (value) {
        return ['INITIAL', 'UPDATE', 'ONGOING']
      }
      return ['INITIAL', 'UPDATE']
    }
  )
}
export const down = async () => {
  // skip
}
