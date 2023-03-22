import { removeFeatureFlags } from '../utils/tenant'

export const up = async () => {
  await removeFeatureFlags(['RULES_ENGINE_RULE_BASED_AGGREGATION'])
}
export const down = async () => {
  // skip
}
