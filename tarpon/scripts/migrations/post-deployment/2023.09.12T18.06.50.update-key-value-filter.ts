import { renameRuleFilter } from '../utils/rule'

export const up = async () => {
  await renameRuleFilter(
    'userTags',
    'userTags',
    (ruleFilter: { [key: string]: string }): { [key: string]: string[] } => {
      const result: { [key: string]: string[] } = {}
      Object.entries(ruleFilter).forEach(([key, value]) => {
        result[key] = [value]
      })
      return result
    }
  )
  await renameRuleFilter(
    'transactionTags',
    'transactionTags',
    (ruleFilter: { [key: string]: string }): { [key: string]: string[] } => {
      const result: { [key: string]: string[] } = {}
      Object.entries(ruleFilter).forEach(([key, value]) => {
        result[key] = [value]
      })
      return result
    }
  )
}
export const down = async () => {
  // skip
}
