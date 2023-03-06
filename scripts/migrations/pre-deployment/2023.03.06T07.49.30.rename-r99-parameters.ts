import { renameRuleParameter } from '../utils/rule'

export const up = async () => {
  await renameRuleParameter(
    ['user-transaction-limits'],
    [],
    'threshold',
    'transactionsCountThreshold',
    (threshold: number, allParameters: any) => {
      if (threshold == undefined) {
        return undefined
      }
      return {
        threshold,
        timeWindow: allParameters?.['timeWindow'],
      }
    }
  )
}
export const down = async () => {
  // skip
}
