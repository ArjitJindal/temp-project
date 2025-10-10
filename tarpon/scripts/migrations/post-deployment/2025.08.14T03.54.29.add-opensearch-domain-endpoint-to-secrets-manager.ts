import { stageAndRegion } from '@flagright/lib/utils'
import { getTarponConfig } from '@flagright/lib/constants/config'
import {
  getDomainEndpoint,
  isOpensearchAvailableInRegion,
} from '@/utils/opensearch-utils'
import { createSecret } from '@/utils/secrets-manager'

export const up = async () => {
  const [stage, region] = stageAndRegion()
  const config = getTarponConfig(stage, region)
  if (isOpensearchAvailableInRegion() && config.env.region) {
    const domainEndpoint = await getDomainEndpoint(
      stage,
      region,
      config.env.region
    )
    await createSecret(`opensearch-${stage}-${region}-endpoint`, {
      endpoint: domainEndpoint,
    })
  }
}
export const down = async () => {
  // skip
}
