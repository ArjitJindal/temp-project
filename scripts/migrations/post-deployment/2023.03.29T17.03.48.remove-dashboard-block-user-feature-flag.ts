import { removeFeatureFlags } from '../utils/tenant'

export const up = async () => {
  await removeFeatureFlags(['DASHBOARD_BLOCK_USER'])
}
export const down = async () => {
  // skip
}
