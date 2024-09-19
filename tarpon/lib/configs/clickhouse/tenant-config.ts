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
  region: FlagrightRegion
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

    case 'sandbox': {
      if (region === 'asia-1') {
        const config: ClickhouseTenantConfig = {
          ENVIROMENT: {
            type: 'production',
            minTotalMemoryGb: 24,
            maxTotalMemoryGb: 24,
          },
          idleScaling: true,
          idleTimeoutMinutes: 10,
          ipAccess: [
            {
              source: '13.251.166.15',
              description: 'Flagright Asia-1 Sandbox Elastic IP',
            },
            {
              source: '18.143.88.142',
              description: 'Flagright Asia-1 Sandbox Elastic IP',
            },
            {
              source: '46.137.237.47',
              description: 'Flagright Asia-1 Sandbox Elastic IP',
            },
          ],
        }

        return config
      }

      break
    }

    default: {
      return undefined
    }
  }
}
