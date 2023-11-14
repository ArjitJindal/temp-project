import { deleteUnusedRuleFilter } from '../utils/rule'

export const up = async () => {
  await deleteUnusedRuleFilter([
    'transactionTimeRange',
    'transactionTimeRangeHistorical',
  ])
}
export const down = async () => {
  // skip
}
