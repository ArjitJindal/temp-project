import { renameRuleParameter } from '../utils/rule'

export const up = async () => {
  await renameRuleParameter(
    ['bank-name-change'],
    [],
    'oldBanksThreshold',
    'oldNamesThreshold',
    (oldBanksThreshold: number) => oldBanksThreshold
  )
}
export const down = async () => {
  // skip
}
