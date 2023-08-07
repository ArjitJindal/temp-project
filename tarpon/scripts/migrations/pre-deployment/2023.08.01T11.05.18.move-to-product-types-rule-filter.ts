import { renameRuleFilter } from '../utils/rule'

export const up = async () => {
  await renameRuleFilter(
    'productType',
    'productTypes',
    (productType: string) => [productType]
  )
}
export const down = async () => {
  // skip
}
