import { ServiceIpAccess } from '@cdktf/providers/clickhouse/service'
import { CONFIG_MAP } from '@flagright/lib/constants/config'
import { Stage } from '@flagright/lib/constants/deploy'

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
  region: string
  ipAccess: ServiceIpAccess[]
}

export function getClickhouseTenantConfig(
  stage: Stage
): ClickhouseTenantConfig[] {
  switch (stage) {
    case 'dev': {
      return [
        {
          ENVIROMENT: { type: 'development' },
          idleScaling: true,
          idleTimeoutMinutes: 10,
          region: CONFIG_MAP[stage]['eu-1'].env.region as string,
          ipAccess: [
            { source: '0.0.0.0/0', description: 'Allow all IP addresses' },
          ],
        },
      ]
    }

    case 'sandbox': {
      const asia1Config: ClickhouseTenantConfig = {
        ENVIROMENT: {
          type: 'production',
          minTotalMemoryGb: 24,
          maxTotalMemoryGb: 24,
        },
        region: CONFIG_MAP[stage]['asia-1'].env.region as string,
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

      return [asia1Config]
    }

    default: {
      return []
    }
  }
}
