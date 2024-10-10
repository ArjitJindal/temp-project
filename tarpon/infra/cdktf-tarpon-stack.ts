import { Fn, TerraformStack } from 'cdktf'
import { Construct } from 'constructs'
import * as cdktf from 'cdktf'
import * as aws from '@cdktf/providers/aws'
import * as atlas from '@cdktf/providers/mongodbatlas'
import * as clickhouse from '@cdktf/providers/clickhouse'
import { Config } from '@flagright/lib/config/config'
import { getAuth0TenantConfigs } from '@lib/configs/auth0/tenant-config'
import { getClickhouseTenantConfig } from '@lib/configs/clickhouse/tenant-config'
import { createAuth0TenantResources } from './auth0/cdktf-auth0-resources'

const CLICKHOUSE_ORGANIZATION_ID = 'c9ccc4d7-3de9-479b-afd6-247a5ac0494e'

export class CdktfTarponStack extends TerraformStack {
  constructor(scope: Construct, id: string, config: Config) {
    super(scope, id)

    const awsRegion = config.env.region as string
    const stateBucket = `flagright-terraform-state-${config.stage}`

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
    })
    new aws.s3BucketAcl.S3BucketAcl(this, 'tfstate-acl', {
      bucket: state.bucket,
      acl: 'private',
    })

    // Auth0 Resources
    const auth0TenantConfigs = getAuth0TenantConfigs(config.stage)
    auth0TenantConfigs.forEach((auth0TenantConfig) =>
      createAuth0TenantResources(this, config, auth0TenantConfig)
    )

    const mongoSecret =
      new aws.dataAwsSecretsmanagerSecretVersion.DataAwsSecretsmanagerSecretVersion(
        this,
        'atlas-secret',
        {
          secretId: `arn:aws:secretsmanager:${config.env.region}:${config.env.account}:secret:atlasManagementApi`,
        }
      )

    new atlas.provider.MongodbatlasProvider(this, 'atlas-provider', {
      publicKey: Fn.lookup(
        Fn.jsondecode(mongoSecret.secretString),
        'public_key'
      ),
      privateKey: Fn.lookup(
        Fn.jsondecode(mongoSecret.secretString),
        'private_key'
      ),
      baseUrl: 'https://cloud.mongodb.com/',
      realmBaseUrl: 'https://services.cloud.mongodb.com/',
    })

    const project = new atlas.dataMongodbatlasProject.DataMongodbatlasProject(
      this,
      'tarpon-project',
      {
        name: config.application.MONGO_ATLAS_PROJECT,
      }
    )

    new atlas.searchIndex.SearchIndex(this, 'sanctions-search-index', {
      name: 'sanctions_search_index',
      projectId: project.projectId,
      clusterName: config.application.MONGO_ATLAS_CLUSTER || '',
      analyzer: 'lucene.standard',
      collectionName: 'sanctions',
      database: 'tarpon',
      mappingsFields: JSON.stringify({
        aka: {
          type: 'string',
        },
        associates: {
          type: 'document',
          fields: {
            ranks: {
              type: 'string',
            },
            sanctionSearchTypes: {
              type: 'string',
            },
          },
        },
        documents: {
          type: 'document',
          fields: {
            id: {
              type: 'string',
            },
          },
        },
        name: {
          type: 'string',
        },
        nationality: {
          type: 'string',
        },
        occupations: {
          type: 'document',
          fields: {
            rank: {
              type: 'string',
            },
          },
        },
        sanctionSearchTypes: {
          type: 'string',
        },
        yearOfBirth: {
          type: 'string',
        },
      }),
      mappingsDynamic: false,
      searchAnalyzer: 'lucene.standard',
    })

    const clickhouseTenantConfigs = getClickhouseTenantConfig(config.stage)

    clickhouseTenantConfigs?.forEach((clickhouseTenantConfig) => {
      const clickhouseSecret =
        new aws.dataAwsSecretsmanagerSecretVersion.DataAwsSecretsmanagerSecretVersion(
          this,
          'clickhouse-secret',
          {
            secretId: `arn:aws:secretsmanager:${config.env.region}:${config.env.account}:secret:clickhouseApi`,
          }
        )

      const clickhousePassword =
        new aws.dataAwsSecretsmanagerSecretVersion.DataAwsSecretsmanagerSecretVersion(
          this,
          'clickhouse-password',
          {
            secretId: `arn:aws:secretsmanager:${config.env.region}:${config.env.account}:secret:clickhouse`,
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

      const clickhouseService = new clickhouse.service.Service(
        this,
        'clickhouse-service',
        {
          provider: clickhouseProvider,
          cloudProvider: 'aws',
          ipAccess: clickhouseTenantConfig.ipAccess,
          name: `Flagright ${config.stage} (${clickhouseTenantConfig.region})`,
          region: clickhouseTenantConfig.region,
          tier: clickhouseTenantConfig.ENVIROMENT.type,
          password: Fn.lookup(
            Fn.jsondecode(clickhousePassword.secretString),
            'password'
          ),
          idleScaling: clickhouseTenantConfig.idleScaling,
          idleTimeoutMinutes: clickhouseTenantConfig.idleTimeoutMinutes,
          ...(clickhouseTenantConfig.ENVIROMENT.type === 'production' && {
            minTotalMemoryGb:
              clickhouseTenantConfig.ENVIROMENT.minTotalMemoryGb,
            maxTotalMemoryGb:
              clickhouseTenantConfig.ENVIROMENT.maxTotalMemoryGb,
          }),
        }
      )

      if (clickhouseTenantConfig.privateEndPointVpcEndpointId) {
        const privateEndpoint =
          new clickhouse.privateEndpointRegistration.PrivateEndpointRegistration(
            this,
            'clickhouse-private-endpoint-registration',
            {
              cloudProvider: 'aws',
              privateEndpointId:
                clickhouseTenantConfig.privateEndPointVpcEndpointId,
              region: clickhouseTenantConfig.region,
              provider: clickhouseProvider,
            }
          )

        new clickhouse.servicePrivateEndpointsAttachment.ServicePrivateEndpointsAttachment(
          this,
          'clickhouse-service-private-endpoints-attachment',
          {
            serviceId: clickhouseService.id,
            privateEndpointIds: [privateEndpoint.privateEndpointId],
            provider: clickhouseProvider,
          }
        )
      }
    })
  }
}
