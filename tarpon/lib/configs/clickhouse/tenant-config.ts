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
  privateEndPointVpcEndpointId?: string
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
            source: '3.72.188.71',
            description: 'Codebuild IP',
          },
          {
            source: '18.157.106.33',
            description: 'Codebuild IP',
          },
          {
            source: '18.153.172.163',
            description: 'Codebuild IP',
          },
        ],
        privateEndPointVpcEndpointId: 'vpce-0ed74b4d1a90c3a4f',
      }

      return [asia1Config]
    }

    default: {
      return []
    }
  }
}
