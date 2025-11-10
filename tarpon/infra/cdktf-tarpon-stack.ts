import { Fn, TerraformStack } from 'cdktf'
import { Construct } from 'constructs'
import * as cdktf from 'cdktf'
import * as aws from '@cdktf/providers/aws'
import * as clickhouse from '@cdktf/providers/clickhouse'
import { ClickhouseInstanceConfig, Config } from '@flagright/lib/config/config'
import { getAuth0TenantConfigs } from '@lib/configs/auth0/tenant-config'
import { CONFIG_MAP } from '../../lib/constants/config'
import { createAuth0TenantResources } from './auth0/cdktf-auth0-resources'

const CLICKHOUSE_ORGANIZATION_ID = 'c9ccc4d7-3de9-479b-afd6-247a5ac0494e'

const codebuildIps = ['3.72.188.71', '18.157.106.33', '18.153.172.163'].map(
  (ip) => ({
    source: ip,
    description: 'Codebuild IP',
  })
)

const prodVpnIp = [
  {
    source: '217.180.56.115',
    description: 'Flagright VPN IP',
  },
]

const sandboxVpnIp = [
  {
    source: '185.128.24.83',
    description: 'Sandbox VPN IP',
  },
]

const allIps: { source: string; description: string }[] = [...codebuildIps]

export class CdktfTarponStack extends TerraformStack {
  constructor(scope: Construct, id: string, config: Config) {
    super(scope, id)

    const regionOrDefault = config.region || 'eu-1'
    const awsRegion = config.env.region as string
    const stateBucket = `flagright-terraform-state-bucket-${config.stage}-${regionOrDefault}`

    // AWS
    new cdktf.S3Backend(this, {
      bucket: stateBucket,
      key: config.stage,
      region: awsRegion,
    })
    new aws.provider.AwsProvider(this, awsRegion, {
      region: awsRegion,
      defaultTags: [
        {
          tags: { deployment: 'tarpon' },
        },
      ],
    })

    const state = new aws.s3Bucket.S3Bucket(this, 'tfstate', {
      bucket: stateBucket,
      forceDestroy: false,
    })
    // Define a bucket policy to enforce private access
    new aws.s3BucketPolicy.S3BucketPolicy(this, 'BucketPolicy', {
      bucket: state.bucket,
      policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'DenyPublicAccess',
            Effect: 'Deny',
            Principal: '*',
            Action: 's3:*',
            Resource: [`${state.arn}`, `${state.arn}/*`],
            Condition: {
              Bool: { 'aws:SecureTransport': 'false' }, // Enforce HTTPS
            },
          },
        ],
      }),
    })

    // Auth0 Resources only deployed on eu-1
    if (regionOrDefault === 'eu-1') {
      const auth0TenantConfigs = getAuth0TenantConfigs(config.stage)
      auth0TenantConfigs.forEach((auth0TenantConfig) =>
        createAuth0TenantResources(this, config, auth0TenantConfig)
      )
    }

    if (!config.clickhouse) {
      return
    }
    const clickhouseSecret =
      new aws.dataAwsSecretsmanagerSecretVersion.DataAwsSecretsmanagerSecretVersion(
        this,
        'clickhouse-secret',
        {
          secretId: `arn:aws:secretsmanager:${config.env.region}:${config.env.account}:secret:clickhouseApi`,
        }
      )

    const clickhouseProvider = new clickhouse.provider.ClickhouseProvider(
      this,
      'clickhouse-provider',
      {
        organizationId: CLICKHOUSE_ORGANIZATION_ID,
        tokenKey: Fn.lookup(
          Fn.jsondecode(clickhouseSecret.secretString),
          'keyId'
        ),
        tokenSecret: Fn.lookup(
          Fn.jsondecode(clickhouseSecret.secretString),
          'keySecret'
        ),
      }
    )

    const getClickhouseName = (name: string, region: string) => {
      return name + '-' + region
    }

    const clickhouseAwsRegion = CONFIG_MAP[config.stage][regionOrDefault].env
      .region as string
    if (config.stage === 'sandbox') {
      allIps.push(...sandboxVpnIp)
    } else if (config.stage === 'prod') {
      allIps.push(...prodVpnIp)
    }

    const sharedClickhouseConfig = config.clickhouse
    const defaultSecretArn = `arn:aws:secretsmanager:${config.env.region}:${config.env.account}:secret:clickhouse`

    const customInstances = sharedClickhouseConfig.instances ?? []
    const hasCustomInstances = customInstances.length > 0

    const instances: ClickhouseInstanceConfig[] = hasCustomInstances
      ? customInstances
      : [
          {
            id: 'default',
            ipAccess: sharedClickhouseConfig.ipAccess,
            minTotalMemoryGb: sharedClickhouseConfig.minTotalMemoryGb,
            maxTotalMemoryGb: sharedClickhouseConfig.maxTotalMemoryGb,
            numReplicas: sharedClickhouseConfig.numReplicas,
            tier: config.stage === 'dev' ? 'development' : 'production',
            idleScaling: true,
            idleTimeoutMinutes: 30,
          },
        ]

    const today = new Date()
    const yyyy = today.getUTCFullYear()
    const mm = String(today.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(today.getUTCDate()).padStart(2, '0')
    const formattedDate = `${yyyy}${mm}${dd}`
    const baseDisplayName = `Flagright ${config.stage} (${clickhouseAwsRegion}) ${formattedDate}`

    instances.forEach((instance) => {
      const passwordSecret =
        new aws.dataAwsSecretsmanagerSecretVersion.DataAwsSecretsmanagerSecretVersion(
          this,
          getClickhouseName(
            hasCustomInstances
              ? `clickhouse-password-${instance.id}`
              : 'clickhouse-password',
            regionOrDefault
          ),
          {
            secretId: instance.passwordSecretId || defaultSecretArn,
          }
        )

      const clickhouseService = new clickhouse.service.Service(
        this,
        getClickhouseName(
          hasCustomInstances
            ? `${instance.id}-clickhouse-service`
            : 'clickhouse-service',
          regionOrDefault
        ),
        {
          provider: clickhouseProvider,
          cloudProvider: 'aws',
          ipAccess:
            instance.ipAccess || sharedClickhouseConfig.ipAccess || allIps,
          name:
            instance.name ||
            (hasCustomInstances
              ? `${baseDisplayName} - ${instance.id}`
              : baseDisplayName),
          region: clickhouseAwsRegion,
          tier:
            instance.tier ||
            (config.stage === 'dev' ? 'development' : 'production'),
          password: Fn.lookup(
            Fn.jsondecode(passwordSecret.secretString),
            instance.passwordSecretKey || 'password'
          ),
          idleScaling: instance.idleScaling ?? true,
          idleTimeoutMinutes: instance.idleTimeoutMinutes ?? 30,
          ...(config.stage !== 'dev' && {
            minTotalMemoryGb:
              instance.minTotalMemoryGb ??
              sharedClickhouseConfig.minTotalMemoryGb ??
              24,
            maxTotalMemoryGb:
              instance.maxTotalMemoryGb ??
              sharedClickhouseConfig.maxTotalMemoryGb ??
              24,
            numReplicas:
              instance.numReplicas ?? sharedClickhouseConfig.numReplicas ?? 3,
          }),
        }
      )

      if (!config.resource.LAMBDA_VPC_ENABLED) {
        return
      }
      const serviceNameOverride = instance.privateLinkServiceName
      const serviceName =
        serviceNameOverride === undefined
          ? sharedClickhouseConfig.awsPrivateLinkEndpointName
          : serviceNameOverride

      const endpoint = new aws.dataAwsVpcEndpoint.DataAwsVpcEndpoint(
        this,
        getClickhouseName(
          hasCustomInstances
            ? `${instance.id}-clickhouse-vpc-endpoint`
            : 'clickhouse-vpc-endpoint',
          regionOrDefault
        ),
        {
          tags: {
            Name:
              instance.vpcEndpointNameTag ||
              sharedClickhouseConfig.vpcEndpointNameTag ||
              (hasCustomInstances
                ? `ClickhouseEndpoint-${instance.id}`
                : 'ClickhouseEndpoint'),
          },
          ...(serviceName && { serviceName }),
        }
      )
      const privateEndpoint =
        new clickhouse.privateEndpointRegistration.PrivateEndpointRegistration(
          this,
          getClickhouseName(
            hasCustomInstances
              ? `${instance.id}-clickhouse-private-endpoint-registration`
              : 'clickhouse-private-endpoint-registration',
            regionOrDefault
          ),
          {
            cloudProvider: 'aws',
            privateEndpointId: endpoint.id,
            region: clickhouseAwsRegion,
            provider: clickhouseProvider,
          }
        )

      new clickhouse.servicePrivateEndpointsAttachment.ServicePrivateEndpointsAttachment(
        this,
        getClickhouseName(
          hasCustomInstances
            ? `${instance.id}-clickhouse-service-private-endpoints-attachment`
            : 'clickhouse-service-private-endpoints-attachment',
          regionOrDefault
        ),
        {
          serviceId: clickhouseService.id,
          privateEndpointIds: [privateEndpoint.privateEndpointId],
          provider: clickhouseProvider,
        }
      )
    })
  }
}
