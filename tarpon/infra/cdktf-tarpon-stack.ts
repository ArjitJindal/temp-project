import { Fn, TerraformStack } from 'cdktf'
import { Construct } from 'constructs'
import * as cdktf from 'cdktf'
import * as aws from '@cdktf/providers/aws'
import * as atlas from '@cdktf/providers/mongodbatlas'
import * as clickhouse from '@cdktf/providers/clickhouse'
import { Config } from '@flagright/lib/config/config'
import { getAuth0TenantConfigs } from '@lib/configs/auth0/tenant-config'
import { Stage } from '@flagright/lib/constants/deploy'
import { getClickhouseTenantConfig } from '@lib/configs/clickhouse/tenant-config'
import { createAuth0TenantResources } from './auth0/cdktf-auth0-resources'

const mongoTriggerDisabledTenants: Partial<Record<Stage, string[]>> = {
  dev: ['cypress', 'flagright-postman', 'flagright-test'],
}

const CLICKHOUSE_ORGANIZATION_ID = 'c9ccc4d7-3de9-479b-afd6-247a5ac0494e'

const enabledCollections = [
  'transactions',
  'users',
  'transaction-events',
  'user-events',
  'cases',
]

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
        name: {
          type: 'string',
          analyzer: 'lucene.standard',
        },
        aka: {
          type: 'document',
          fields: {
            name: {
              type: 'string',
            },
          },
        },
      }),
      mappingsDynamic: false,
      searchAnalyzer: 'lucene.standard',
    })

    if (
      config.application.MONGO_TRIGGERS_APP_ID &&
      config.application.MONGO_SERVICE_ID
    ) {
      new atlas.eventTrigger.EventTrigger(this, 'event-trigger', {
        name: 'event-trigger',
        projectId: project.projectId,
        appId: config.application.MONGO_TRIGGERS_APP_ID,
        configServiceId: config.application.MONGO_SERVICE_ID,
        type: 'DATABASE',
        configDatabase: 'tarpon',
        eventProcessors: {
          awsEventbridge: {
            configAccountId: config.env.account,
            configRegion: config.env.region,
          },
        },
        unordered: false,
        configOperationTypes: ['INSERT', 'UPDATE', 'DELETE', 'REPLACE'],
        configMatch: Fn.jsonencode({
          $and: [
            {
              $and:
                mongoTriggerDisabledTenants?.[config.stage]?.map((tenant) => ({
                  'ns.coll': {
                    $regex: `^(?!${tenant}).*`,
                  },
                })) ?? [],
            },
            {
              $or: enabledCollections.map((collection) => ({
                // ends with the collection name
                'ns.coll': {
                  $regex: `.*-${collection}$`,
                },
              })),
            },
          ],
        }),
        configProject: Fn.jsonencode({
          operationType: 1,
          ns: 1,
          _id: 1,
          documentKey: 1,
          clusterTime: 1,
        }),
      })
    }

    const region = config.region || 'eu-1'

    const clickhouseTenantConfigs = getClickhouseTenantConfig(
      config.stage,
      region
    )

    if (clickhouseTenantConfigs) {
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

      new clickhouse.service.Service(this, 'clickhouse-service', {
        provider: clickhouseProvider,
        cloudProvider: 'aws',
        ipAccess: clickhouseTenantConfigs.ipAccess,
        name: `Flagright ${config.stage} (${region})`,
        region: config.env.region as string,
        tier: clickhouseTenantConfigs.ENVIROMENT.type,
        password: Fn.lookup(
          Fn.jsondecode(clickhousePassword.secretString),
          'password'
        ),
        idleScaling: clickhouseTenantConfigs.idleScaling,
        idleTimeoutMinutes: clickhouseTenantConfigs.idleTimeoutMinutes,
        ...(clickhouseTenantConfigs.ENVIROMENT.type === 'production' && {
          minTotalMemoryGb: clickhouseTenantConfigs.ENVIROMENT.minTotalMemoryGb,
          maxTotalMemoryGb: clickhouseTenantConfigs.ENVIROMENT.maxTotalMemoryGb,
        }),
      })
    }
  }
}
