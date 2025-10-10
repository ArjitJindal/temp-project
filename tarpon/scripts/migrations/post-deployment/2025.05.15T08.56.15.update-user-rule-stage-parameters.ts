import { deleteUnusedRuleParameter } from '../utils/rule'

export const up = async () => {
  await deleteUnusedRuleParameter(
    [
      'generic-sanction-screening-user',
      'sanctions-bank-name',
      'sanctions-business-user',
    ],
    [],
    ['ongoingScreening']
  )
}

export const down = async () => {
  // skip
}
