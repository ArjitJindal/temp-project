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

const codeBuildIps = ['3.72.188.71', '18.157.106.33', '18.153.172.163']

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
          // Max out resources for PNB sanctions backfill query.
          // The query needs to perform levenshtein distance queries for 14M
          // records against ~200K sanctions entries (44K entries with approximately 5 names + AKAs),
          // which is a total of:
          // 14M x 200K = 2.8e+12 operations
          // Assuming a levenshtein distance calculation takes 1us, in a single
          // thread this will take 32 days.
          // By using the max resources on clickhouse of 180 CPUs, we can bring
          // this down around 4 hours:
          // 32 days / 180 ~= 4 hours
          // This should cost around $20, since cost per CPU per hour is ~$0.1149:
          // 180 x 4 hour x 0.1149 ~= $82
          //
          // The query that will be run in clickhouse is as follows:
          // https://console.clickhouse.cloud/services/f8f7cafb-f86e-4378-b95e-31cf8259e44d/console/query/749afd3a-dde9-4fc3-9e41-a42dbb6370f1
          //
          // We'll then use the result of this query to run sanctions only against the user IDs returned from here.
          maxTotalMemoryGb: 3 * 240, // Max node GB is 240GB
        },
        region: CONFIG_MAP[stage]['asia-1'].env.region as string,
        idleScaling: true,
        idleTimeoutMinutes: 10,
        ipAccess: codeBuildIps.map((ip) => ({
          source: ip,
          description: 'Codebuild IP',
        })),
        privateEndPointVpcEndpointId: 'vpce-0ed74b4d1a90c3a4f',
      }

      const eu1Config: ClickhouseTenantConfig = {
        ENVIROMENT: {
          type: 'production',
          minTotalMemoryGb: 24,
          maxTotalMemoryGb: 24,
        },
        region: CONFIG_MAP[stage]['eu-1'].env.region as string,
        idleScaling: true,
        idleTimeoutMinutes: 10,
        ipAccess: codeBuildIps.map((ip) => ({
          source: ip,
          description: 'Codebuild IP',
        })),
        privateEndPointVpcEndpointId: 'vpce-01bf2ecf25ad883c4',
      }

      return [asia1Config, eu1Config]
    }

    default: {
      return []
    }
  }
}
