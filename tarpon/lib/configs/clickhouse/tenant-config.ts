import { ServiceIpAccess } from '@cdktf/providers/clickhouse/service'
import { FlagrightRegion, Stage } from '@flagright/lib/constants/deploy'

type ClickhouseTenantConfig = {
  ENVIROMENT:
    | { type: 'development' }
    | {
        type: 'production'
        minTotalMemoryGb: number
        maxTotalMemoryGb: number
      }
  idleScaling: boolean
  idleTimeoutMinutes: number
  ipAccess: ServiceIpAccess[]
}

export function getClickhouseTenantConfig(
  stage: Stage,
  _region: FlagrightRegion
): ClickhouseTenantConfig | undefined {
  switch (stage) {
    case 'dev': {
      const config: ClickhouseTenantConfig = {
        ENVIROMENT: { type: 'development' },
        idleScaling: true,
        idleTimeoutMinutes: 10,
        ipAccess: [
          { source: '0.0.0.0/0', description: 'Allow all IP addresses' },
        ],
      }

      return config
    }

    default: {
      return undefined
    }
  }
}
