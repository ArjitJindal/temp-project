import { renameFeatureFlags } from '../utils/tenant'

export const up = async () => {
  await renameFeatureFlags({
    SALES_RISK_SCORING: 'RISK_SCORING_V8_FOR_V2',
  })
}
export const down = async () => {
  // skip
}
