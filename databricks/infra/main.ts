import { Construct } from 'constructs'
import { App, TerraformStack, S3Backend, TerraformOutput } from 'cdktf'
import * as aws from './.gen/providers/aws'
import * as databricks from './.gen/providers/databricks'
import { sleep, provider } from '@cdktf/provider-time'
import { TerraformHclModule } from 'cdktf'
import { Fn } from 'cdktf'
import { TerraformProvider } from 'cdktf/lib/terraform-provider'
import { Config } from '@flagright/lib/config/config'
import { getTarponConfig } from '@flagright/lib/constants/config'
import { Stage, FlagrightRegion } from '@flagright/lib/constants/deploy'
import { getTenantInfoFromUsagePlans } from '@flagright/lib/tenants/usage-plans'
import { AWS_ACCOUNTS } from '@flagright/lib/constants'
import * as path from 'path'
import { createHash } from 'crypto'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import {
  resource as nullResource,
  provider as nullProvider,
} from '@cdktf/provider-null'

// Toggle this to remove tenants.
const preventTenantDestruction = false
// We use the checksum of the openAPI specifications to determine whether views need updating.
const schemaVersion = checksumFolder('../src/openapi')
const adminEmails = [
  'tim+databricks@flagright.com',
  'nadig@flagright.com',
  'chia@flagright.com',
]
const stage = process.env.STAGE as Stage
const region = process.env.REGION as FlagrightRegion
const env = `${stage}-${region}`
const config = getTarponConfig(stage, region)
const awsRegion = config.env.region || ''
const regionalAdminGroupName = `admins-${awsRegion}`
const stateBucket = `flagright-terraform-state-databricks-${env}`
const prefix = `flagright-databricks-${stage}-${region}`
const cidrBlock = '10.4.0.0/16'
const databricksClientId = 'cb9efcf2-ffd5-484a-badc-6317ba4aef91'
const databricksAccountId = 'e2fae071-88c7-4b3e-90cd-2f4c5ced45a7'
const awsAccountId = AWS_ACCOUNTS[stage]
const serverlessRegions = [
  'eu-central-1',
  'ap-southeast-2',
  'eu-west-1',
  'us-west-2',
  'us-east-1',
  'us-east-2',
]

const notebookHeader = `
%pip install sentry-sdk
%pip install --no-dependencies /Workspace/Shared/src-0.1.0-py3-none-any.whl

import sentry_sdk
import os
from src.jobs.jobs import Jobs
SENTRY_DSN = "https://2f1b7e0a135251afb6ab00dbeab9c423@o1295082.ingest.us.sentry.io/4506869105754112"

sentry_sdk.init(
    dsn=SENTRY_DSN,
    traces_sample_rate=1.0,
    environment=os.environ["STAGE"],
)`

function hashFile(filePath: string): string {
  const content = readFileSync(filePath)
  return createHash('sha256').update(content).digest('hex')
}

function checksumFolder(folderPath: string): string {
  const files = readdirSync(folderPath, { withFileTypes: true })
  let combinedHash = createHash('sha256')

  for (const file of files) {
    const fullPath = join(folderPath, file.name)
    if (file.isDirectory()) {
      const dirHash = checksumFolder(fullPath)
      combinedHash.update(dirHash)
    } else {
      const fileHash = hashFile(fullPath)
      combinedHash.update(fileHash)
    }
  }

  return combinedHash.digest('hex')
}

class DatabricksStack extends TerraformStack {
  config: Config
  mws: TerraformProvider
  tenantIds: string[]

  constructor(scope: Construct, name: string, tenantIds: string[]) {
    super(scope, name)
    this.config = config
    this.tenantIds = tenantIds

    new S3Backend(this, {
      bucket: stateBucket,
      key: env,
      region: awsRegion,
    })

    // Providers
    new aws.provider.AwsProvider(this, 'aws', {
      region: awsRegion,
    })

    new nullProvider.NullProvider(this, 'null', {})

    const databricksSecret =
      new aws.dataAwsSecretsmanagerSecret.DataAwsSecretsmanagerSecret(
        this,
        'databricks-secret',
        {
          name: 'databricksClientSecret',
        }
      )
    const databricksSecretVersion =
      new aws.dataAwsSecretsmanagerSecretVersion.DataAwsSecretsmanagerSecretVersion(
        this,
        'databricks-secret-version',
        {
          secretId: databricksSecret.id,
        }
      )

    this.mws = new databricks.provider.DatabricksProvider(this, 'databricks', {
      alias: 'mws',
      host: 'https://accounts.cloud.databricks.com',
      accountId: databricksAccountId,
      clientId: databricksClientId,
      clientSecret: databricksSecretVersion.secretString,
    })

    new provider.TimeProvider(this, 'time', {})

    // Conditionals
    const shouldCreateVpc = stage === 'dev'
    const shouldCreateMetastore = stage === 'prod'

    // Create or retrieve metastores, VPC, users.
    const { securityGroupIds, subnetIds, vpcId } = shouldCreateVpc
      ? this.createVpc()
      : this.fetchVpc()
    const metastoreId = shouldCreateMetastore
      ? this.createMetastore()
      : this.fetchMetastore()

    const storageConfigurationId = this.rootStorage()
    const { credentialsId, profileRoleName } = this.crossAccountRole()

    // Connect VPC to Databricks
    const mwsNetworks = new databricks.mwsNetworks.MwsNetworks(
      this,
      'mws-networks',
      {
        provider: this.mws,
        accountId: databricksAccountId,
        networkName: `${prefix}-network`,
        securityGroupIds,
        subnetIds,
        vpcId,
      }
    )

    // Create workspace
    const workspace = new databricks.mwsWorkspaces.MwsWorkspaces(
      this,
      'mws-workspaces',
      {
        provider: this.mws,
        accountId: databricksAccountId,
        awsRegion: awsRegion,
        workspaceName: env,
        credentialsId,
        storageConfigurationId,
        networkId: mwsNetworks.networkId,
        token: {
          comment: 'Terraform',
        },
      }
    )

    // Assign metastore to workspace
    new databricks.metastoreAssignment.MetastoreAssignment(
      this,
      'metastore-assignment',
      {
        provider: this.mws,
        workspaceId: workspace.workspaceId,
        metastoreId: metastoreId,
        defaultCatalogName: stage,
      }
    )

    // Configure workspace provide
    const workspaceProvider = new databricks.provider.DatabricksProvider(
      this,
      'databricks-workspace-provider',
      {
        alias: 'workspace',
        host: workspace.workspaceUrl,
        accountId: databricksAccountId,
        clientId: databricksClientId,
        clientSecret: databricksSecretVersion.secretString,
      }
    )

    // Configure workspace internals
    // Note; On first run, this should be commented out. On second run, it should be uncommented.
    // This is an unresolved dependency issue.
    this.workspace({
      profileRoleName,
      workspace,
      workspaceProvider,
    })
  }

  private workspace({
    profileRoleName,
    workspaceProvider,
  }: {
    workspaceProvider: databricks.provider.DatabricksProvider
    profileRoleName: string
    workspace: databricks.mwsWorkspaces.MwsWorkspaces
  }) {
    new databricks.workspaceConf.WorkspaceConf(this, 'workspace-conf', {
      provider: workspaceProvider,
      customConfig: {
        enableTokensConfig: 'true',
        maxTokenLifetimeDays: '0',
      },
    })

    const profile = new aws.iamInstanceProfile.IamInstanceProfile(
      this,
      'instance-profile',
      {
        name: `shared-ec2-role-${region}`,
        role: profileRoleName,
        tags: { Project: 'databricks' },
      }
    )
    const instanceProfile = new databricks.instanceProfile.InstanceProfile(
      this,
      'databricks-instance-profile',
      {
        provider: workspaceProvider,
        instanceProfileArn: profile.arn,
      }
    )

    new databricks.artifactAllowlist.ArtifactAllowlist(this, 'allow-list', {
      provider: workspaceProvider,
      artifactType: 'LIBRARY_MAVEN',
      artifactMatcher: [
        {
          matchType: 'PREFIX_MATCH',
          artifact: 'org.mongodb.spark:mongo-spark-connector_2.12',
        },
        {
          matchType: 'PREFIX_MATCH',
          artifact: 'com.typesafe.play:play-json_2.12',
        },
      ],
    })

    const workspaceGroup =
      new databricks.dataDatabricksGroup.DataDatabricksGroup(
        this,
        'workspace-group',
        {
          provider: workspaceProvider,
          displayName: 'admins',
        }
      )

    adminEmails.forEach((email) => {
      const user = new databricks.user.User(this, `workspace-user-${email}`, {
        provider: workspaceProvider,
        userName: email,
        force: true,
      })
      new databricks.groupMember.GroupMember(
        this,
        `workspace-group-member-${email}`,
        {
          provider: workspaceProvider,
          groupId: workspaceGroup.id,
          memberId: user.id,
        }
      )
    })

    const sparkUser = new aws.iamUser.IamUser(this, 'spark', {
      name: `spark-${region}`,
    })
    const accessKey = new aws.iamAccessKey.IamAccessKey(this, 'spark-key', {
      user: sparkUser.name,
    })

    new aws.iamUserPolicyAttachment.IamUserPolicyAttachment(
      this,
      'policy-attachment',
      {
        user: sparkUser.name,
        policyArn: 'arn:aws:iam::aws:policy/AmazonKinesisReadOnlyAccess',
      }
    )

    const databricksAccessToken = new databricks.token.Token(
      this,
      'access-token',
      {
        provider: workspaceProvider,
        comment: 'Terraform provisioned',
      }
    )

    const databricksScope = new databricks.secretScope.SecretScope(
      this,
      'databricks-secret-scope',
      {
        provider: workspaceProvider,
        name: 'databricks',
      }
    )

    new databricks.secret.Secret(this, 'databricks-username', {
      provider: workspaceProvider,
      key: 'token',
      stringValue: databricksAccessToken.tokenValue,
      scope: databricksScope.id,
    })

    const mongoSecret =
      new aws.dataAwsSecretsmanagerSecret.DataAwsSecretsmanagerSecret(
        this,
        'mongo-secret',
        {
          name: 'mongoAtlasCreds',
        }
      )
    const mongoSecretVersion =
      new aws.dataAwsSecretsmanagerSecretVersion.DataAwsSecretsmanagerSecretVersion(
        this,
        'mongo-secret-version',
        {
          secretId: mongoSecret.id,
        }
      )

    const mongoScope = new databricks.secretScope.SecretScope(
      this,
      'mongo-secret-scope',
      {
        provider: workspaceProvider,
        name: 'mongo',
      }
    )

    const mongoSecretValue = Fn.jsondecode(mongoSecretVersion.secretString)

    new databricks.secret.Secret(this, 'mongo-username', {
      provider: workspaceProvider,
      key: 'mongo-username',
      stringValue: Fn.lookup(mongoSecretValue, 'username'),
      scope: mongoScope.id,
    })

    new databricks.secret.Secret(this, 'mongo-password', {
      provider: workspaceProvider,
      key: 'mongo-password',
      stringValue: Fn.lookup(mongoSecretValue, 'password'),
      scope: mongoScope.id,
    })

    new databricks.secret.Secret(this, 'mongo-host', {
      provider: workspaceProvider,
      key: 'mongo-host',
      stringValue: Fn.lookup(mongoSecretValue, 'host'),
      scope: mongoScope.id,
    })

    const kinesisScope = new databricks.secretScope.SecretScope(
      this,
      'secret-scope',
      {
        provider: workspaceProvider,
        name: 'kinesis',
      }
    )

    new databricks.secret.Secret(this, 'aws-access-key', {
      provider: workspaceProvider,
      key: 'aws-access-key',
      stringValue: accessKey.id,
      scope: kinesisScope.id,
    })

    new databricks.secret.Secret(this, 'aws-secret-key', {
      provider: workspaceProvider,
      key: 'aws-secret-key',
      stringValue: accessKey.secret,
      scope: kinesisScope.id,
    })

    const clusterConfig = {
      label: 'default',
      dataSecurityMode: 'USER_ISOLATION',
      nodeTypeId: 'm5d.large',
      autoscale: {
        minWorkers: 1,
        maxWorkers: 4,
      },
      sparkEnvVars: {
        AWS_REGION: awsRegion,
        STAGE: stage,
      },
      awsAttributes: {
        instanceProfileArn: instanceProfile.id,
        zoneId: awsRegion,
      },
    }

    const clusterLibraries = [
      {
        maven: {
          coordinates: 'org.mongodb.spark:mongo-spark-connector_2.12:3.0.2',
        },
      },
      {
        maven: {
          coordinates: 'com.typesafe.play:play-json_2.12:2.10.4',
        },
      },
      {
        pypi: {
          package: 'pymongo',
        },
      },
    ]

    const cluster = new databricks.cluster.Cluster(this, 'cluster', {
      ...clusterConfig,
      provider: workspaceProvider,
      sparkVersion: '14.3.x-scala2.12',
      clusterName: 'Shared Autoscaling',
      library: clusterLibraries,
      autoterminationMinutes: 60,
      dependsOn: [instanceProfile],
      lifecycle: {
        ignoreChanges: ['aws_attributes'],
      },
    })

    const enableServerlessCompute = serverlessRegions.indexOf(awsRegion) > -1
    const sqlWarehouse = new databricks.sqlEndpoint.SqlEndpoint(
      this,
      'sql-endpoint',
      {
        provider: workspaceProvider,
        name: 'tarpon',
        clusterSize: '2X-Small',
        autoStopMins: enableServerlessCompute ? 5 : 0,
        enableServerlessCompute,
      }
    )

    const jobs = [
      {
        name: 'refresh',
        description: 'Rebuild derived tables from kinesis and mongo data.',
        continuous: false,
      },
      {
        name: 'backfill',
        description:
          'Reset everything by clearing all tables and backfilling from mongo.',
        continuous: false,
      },
      {
        name: 'stream',
        description: 'Stream live from kinesis and transform',
        continuous: true,
      },
    ]

    jobs.map((job) => {
      new databricks.notebook.Notebook(this, `${job.name}-file`, {
        provider: workspaceProvider,
        contentBase64: this.templateJobNotebook(job.name),
        language: 'PYTHON',
        path: `/Shared/${job.name}`,
      })
      new databricks.job.Job(this, `${job.name}-job`, {
        provider: workspaceProvider,
        name: job.name,
        description: job.description,
        parameter: [
          {
            name: 'force',
            default: 'false',
          },
        ],
        emailNotifications: {
          onFailure: ['tim@flagright.com'],
        },
        continuous: job.continuous
          ? {
              pauseStatus: 'UNPAUSED',
            }
          : undefined,
        task: [
          {
            taskKey: 'main',
            notebookTask: {
              notebookPath: `/Shared/${job.name}`,
            },
            existingClusterId: cluster.clusterId,
          },
        ],
      })
    })

    const catalog = new databricks.catalog.Catalog(this, 'main-catalog', {
      provider: workspaceProvider,
      name: stage,
    })

    new databricks.workspaceFile.WorkspaceFile(this, `whl`, {
      provider: workspaceProvider,
      path: `/Shared/src-0.1.0-py3-none-any.whl`,
      source: path.resolve(__dirname, '../dist/src-0.1.0-py3-none-any.whl'),
    })

    new databricks.dbfsFile.DbfsFile(this, `currency-rates-backfill`, {
      provider: workspaceProvider,
      path: `/data/currency_rates_backfill.json`,
      source: path.resolve(__dirname, '../data/currency_rates_backfill.json'),
    })

    new databricks.pipeline.Pipeline(this, `pipeline`, {
      provider: workspaceProvider,
      name: 'main',
      continuous: true,
      edition: 'PRO',
      development: stage === 'dev',
      channel: 'PREVIEW',
      catalog: catalog.name,
      cluster: [
        {
          ...clusterConfig,
          nodeTypeId: 'm5d.large',
          autoscale: {
            minWorkers: 1,
            maxWorkers: 1,
          },
        },
      ],
      library: [
        {
          notebook: {
            path: `/Shared/pipeline`,
          },
        },
      ],
      target: 'default',
      notification: [
        {
          emailRecipients: adminEmails,
          alerts: [
            'on-update-failure',
            'on-update-fatal-failure',
            'on-flow-failure',
          ],
        },
      ],
    })

    const entities = [
      { table: 'users', idColumn: 'userId' },
      { table: 'transactions', idColumn: 'transactionId' },
      { table: 'kyc_risk_values', idColumn: 'userId' },
      { table: 'action_risk_values', idColumn: 'transactionId' },
      { table: 'dynamic_risk_values', idColumn: 'userId' },
    ]

    new databricks.grant.Grant(this, `grants-admin`, {
      provider: workspaceProvider,
      catalog: catalog.id,
      privileges: ['ALL_PRIVILEGES'],
      principal: regionalAdminGroupName,
    })

    const defaultSchema = new databricks.schema.Schema(this, 'default-schema', {
      provider: workspaceProvider,
      catalogName: catalog.name,
      name: 'default',
    })

    new databricks.schema.Schema(this, 'main-schema', {
      provider: workspaceProvider,
      catalogName: catalog.name,
      name: 'main',
    })

    const tables = new databricks.dataDatabricksTables.DataDatabricksTables(
      this,
      `tables`,
      {
        provider: workspaceProvider,
        catalogName: catalog.name,
        schemaName: defaultSchema.name,
      }
    )

    const servicePrincipals = this.tenantIds.map((tenantId) => {
      return new databricks.servicePrincipal.ServicePrincipal(
        this,
        `service-principal-${tenantId}`,
        {
          provider: workspaceProvider,
          displayName: tenantId,
          active: true,
          databricksSqlAccess: true,
          lifecycle: {
            preventDestroy: preventTenantDestruction,
          },
        }
      )
    })

    const authPerms = new databricks.permissions.Permissions(
      this,
      'token-permission',
      {
        provider: workspaceProvider,
        authorization: 'tokens',
        accessControl: [
          {
            groupName: 'users',
            permissionLevel: 'CAN_USE',
          },
          ...servicePrincipals.map((sp) => ({
            servicePrincipalName: sp.applicationId,
            permissionLevel: 'CAN_USE',
          })),
        ],
      }
    )
    new databricks.permissions.Permissions(this, 'serverless-permission', {
      provider: workspaceProvider,
      sqlEndpointId: sqlWarehouse.id,
      accessControl: [
        {
          groupName: 'users',
          permissionLevel: 'CAN_USE',
        },
        ...servicePrincipals.map((sp) => ({
          servicePrincipalName: sp.applicationId,
          permissionLevel: 'CAN_USE',
        })),
      ],
    })

    new databricks.permissions.Permissions(this, 'job-compute-permission', {
      provider: workspaceProvider,
      clusterId: cluster.id,
      accessControl: [
        {
          groupName: 'users',
          permissionLevel: 'CAN_ATTACH_TO',
        },
        ...servicePrincipals.map((sp) => ({
          servicePrincipalName: sp.applicationId,
          permissionLevel: 'CAN_ATTACH_TO',
        })),
      ],
    })

    entities.forEach((entity) => {
      new databricks.sqlTable.SqlTable(this, `backfill-${entity.table}`, {
        provider: workspaceProvider,
        catalogName: catalog.name,
        warehouseId: sqlWarehouse.id,
        name: `${entity.table}_backfill`,
        schemaName: defaultSchema.name,
        tableType: 'MANAGED',
        dataSourceFormat: 'DELTA',
        column: [
          {
            type: 'string',
            name: 'tenant',
          },
          {
            type: 'string',
            name: entity.idColumn,
          },
        ],
        lifecycle: {
          ignoreChanges: ['column'],
        },
      })
    })
    const schemaVersionResource = new nullResource.Resource(
      this,
      'schema-version',
      {
        triggers: {
          alwaysRun: schemaVersion,
        },
      }
    )
    servicePrincipals.forEach((sp, i) => {
      const tenant = this.tenantIds[i]
      const tenantSchema = new databricks.schema.Schema(
        this,
        `schema-${tenant}`,
        {
          provider: workspaceProvider,
          catalogName: catalog.name,
          name: sp.displayName,
          lifecycle: {
            preventDestroy: preventTenantDestruction,
          },
        }
      )
      new databricks.grant.Grant(this, `sp-grant-${tenant}`, {
        provider: workspaceProvider,
        schema: tenantSchema.id,
        principal: sp.applicationId,
        privileges: ['USE_SCHEMA', 'SELECT'],
        lifecycle: {
          preventDestroy: preventTenantDestruction,
        },
      })
      new databricks.grant.Grant(this, `sp-grant-catalog-${tenant}`, {
        provider: workspaceProvider,
        catalog: catalog.id,
        principal: sp.applicationId,
        privileges: ['USE_CATALOG'],
        lifecycle: {
          preventDestroy: preventTenantDestruction,
        },
      })

      entities.forEach((entity) => {
        if (Fn.contains(tables.ids, `${stage}.default.${entity.table}`)) {
          const view = new databricks.sqlTable.SqlTable(
            this,
            `view-${entity.table}-${tenant}`,
            {
              provider: workspaceProvider,
              catalogName: catalog.name,
              name: entity.table,
              schemaName: tenantSchema.name,
              tableType: 'VIEW',
              warehouseId: sqlWarehouse.id,
              viewDefinition: Fn.format(
                `SELECT * from %s.default.%s WHERE tenant = '%s'`,
                [catalog.name, entity.table, sp.displayName]
              ),
              lifecycle: {
                preventDestroy: preventTenantDestruction,
              },
            }
          )

          // Necessary due to this bug report: https://github.com/hashicorp/terraform-cdk/issues/3532
          view.addOverride('lifecycle.replace_triggered_by', [
            schemaVersionResource.terraformResourceType +
              '.' +
              schemaVersionResource.friendlyUniqueId,
          ])
        }
      })

      const spToken = new databricks.oboToken.OboToken(
        this,
        `obo-token-${tenant}`,
        {
          provider: workspaceProvider,
          applicationId: sp.applicationId,
          lifecycle: {
            preventDestroy: preventTenantDestruction,
          },
          dependsOn: [authPerms],
        }
      )

      const tenantSecret = new aws.secretsmanagerSecret.SecretsmanagerSecret(
        this,
        `aws-secret-${tenant}`,
        {
          name: Fn.format('databricks/tenants/%s', [sp.displayName]),
          recoveryWindowInDays: 0,
          lifecycle: {
            preventDestroy: preventTenantDestruction,
          },
        }
      )

      // TODO: Not sure why things aren't working on sandbox. Will figure this out.
      const host = sqlWarehouse.odbcParams.get(0).hostname
      const path = sqlWarehouse.odbcParams.get(0).path

      new aws.secretsmanagerSecretVersion.SecretsmanagerSecretVersion(
        this,
        `aws-secret-version-${tenant}`,
        {
          secretId: tenantSecret.id,
          secretString: Fn.jsonencode({
            token: spToken.tokenValue,
            host,
            path,
          }),
          lifecycle: {
            preventDestroy: preventTenantDestruction,
          },
        }
      )
    })
  }

  private createUsers() {
    return adminEmails.map((email) => {
      return new databricks.user.User(this, `user-${email}`, {
        provider: this.mws,
        userName: email,
        force: true,
      }).id
    })
  }

  private fetchVpc() {
    const vpcs = new aws.dataAwsVpcs.DataAwsVpcs(this, 'vpc', {
      filter: [
        {
          name: 'tag:Name',
          values: ['vpc'],
        },
      ],
    })

    if (vpcs.ids.length !== 1) {
      throw new Error('Error retrieving VPC')
    }
    const vpcId = Fn.element(vpcs.ids, 0)
    if (!vpcId) {
      throw new Error('VPC ID not defined')
    }
    const subnets = new aws.dataAwsSubnets.DataAwsSubnets(this, 'subnets', {
      filter: [
        {
          name: 'vpc-id',
          values: [vpcId],
        },
        {
          name: 'tag:aws-cdk:subnet-type',
          values: ['Private'],
        },
        {
          name: 'tag:aws-cdk:subnet-name',
          values: ['PrivateSubnet1'],
        },
      ],
    })
    const securityGroups = new aws.dataAwsSecurityGroups.DataAwsSecurityGroups(
      this,
      'security-groups',
      {
        filter: [
          {
            name: 'vpc-id',
            values: [vpcId],
          },
          {
            name: 'group-name',
            values: ['atlas-lambda-sg'],
          },
        ],
      }
    )

    return {
      subnetIds: subnets.ids,
      vpcId,
      securityGroupIds: securityGroups.ids,
    }
  }

  private createVpc(): {
    securityGroupIds: string[]
    subnetIds: string[]
    vpcId: string
  } {
    const azs = new aws.dataAwsAvailabilityZones.DataAwsAvailabilityZones(
      this,
      'availability-zones',
      {}
    )

    const vpc = new TerraformHclModule(this, 'vpc', {
      source: 'terraform-aws-modules/vpc/aws',

      variables: {
        name: prefix,
        cidr: cidrBlock,
        azs: azs.names,

        enable_dns_hostnames: true,
        enable_nat_gateway: true,
        single_nat_gateway: true,
        create_igw: true,

        public_subnets: [Fn.cidrsubnet(cidrBlock, 3, 0)],
        private_subnets: [
          Fn.cidrsubnet(cidrBlock, 3, 1),
          Fn.cidrsubnet(cidrBlock, 3, 2),
        ],
        manage_default_security_group: true,
        default_security_group_name: `${prefix}-sg`,
        default_security_group_egress: [
          {
            cidr_blocks: '0.0.0.0/0',
          },
        ],
        default_security_group_ingress: [
          {
            description: 'Allow all internal TCP and UDP',
            self: true,
          },
        ],
      },
    })

    new TerraformHclModule(this, 'vpc-endpoints', {
      source: 'terraform-aws-modules/vpc/aws//modules/vpc-endpoints',

      variables: {
        vpc_id: vpc.get('vpc_id'),
        security_group_ids: [vpc.get('default_security_group_id')],
        endpoints: {
          s3: {
            service: 's3',
            service_type: 'Gateway',
            route_table_ids: Fn.flatten([
              vpc.get('private_route_table_ids'),
              vpc.get('public_route_table_ids'),
            ]),
            tags: {
              Name: `${prefix}-s3-vpc-endpoint`,
            },
          },
          sts: {
            service: 'sts',
            private_dns_enabled: true,
            subnet_ids: vpc.get('private_subnets'),
            tags: {
              Name: `${prefix}-sts-vpc-endpoint`,
            },
          },
          'kinesis-streams': {
            service: 'kinesis-streams',
            private_dns_enabled: true,
            subnet_ids: vpc.get('private_subnets'),
            tags: {
              Name: `${prefix}-kinesis-vpc-endpoint`,
            },
          },
        },
      },
    })

    return {
      securityGroupIds: [vpc.get('default_security_group_id')],
      subnetIds: vpc.get('private_subnets'),
      vpcId: vpc.get('vpc_id'),
    }
  }

  private rootStorage(): string {
    const rootStorageBucket = new aws.s3Bucket.S3Bucket(
      this,
      'root-storage-bucket',
      {
        bucket: `${prefix}-rootbucket`,
        forceDestroy: true,
        tags: {
          Name: `${prefix}-rootbucket`,
        },
      }
    )

    new aws.s3BucketServerSideEncryptionConfiguration.S3BucketServerSideEncryptionConfigurationA(
      this,
      'root-storage-bucket-encryption',
      {
        bucket: rootStorageBucket.bucket,
        rule: [
          {
            applyServerSideEncryptionByDefault: {
              sseAlgorithm: 'AES256',
            },
          },
        ],
      }
    )

    const publicAccessBlock =
      new aws.s3BucketPublicAccessBlock.S3BucketPublicAccessBlock(
        this,
        'root-storage-bucket-public-access',
        {
          bucket: rootStorageBucket.id,
          blockPublicAcls: true,
          blockPublicPolicy: true,
          ignorePublicAcls: true,
          restrictPublicBuckets: true,
          dependsOn: [rootStorageBucket],
        }
      )

    const databricksPolicy =
      new databricks.dataDatabricksAwsBucketPolicy.DataDatabricksAwsBucketPolicy(
        this,
        'databricks-policy',
        {
          bucket: rootStorageBucket.bucket,
        }
      )

    const bucketState =
      new aws.s3BucketOwnershipControls.S3BucketOwnershipControls(
        this,
        'root-bucket-state',
        {
          bucket: rootStorageBucket.id,
          rule: {
            objectOwnership: 'BucketOwnerPreferred',
          },
        }
      )

    new aws.s3BucketPolicy.S3BucketPolicy(this, 'root-bucket-policy', {
      bucket: rootStorageBucket.id,
      policy: databricksPolicy.json,
      dependsOn: [publicAccessBlock],
    })

    new aws.s3BucketAcl.S3BucketAcl(this, 'root-bucket-acl', {
      bucket: rootStorageBucket.id,
      acl: 'private',
      dependsOn: [bucketState],
    })

    new aws.s3BucketVersioning.S3BucketVersioningA(
      this,
      'root-bucket-versioning',
      {
        bucket: rootStorageBucket.id,
        versioningConfiguration: {
          status: 'Disabled',
        },
      }
    )

    new aws.s3BucketServerSideEncryptionConfiguration.S3BucketServerSideEncryptionConfigurationA(
      this,
      'metastore-storage-bucket',
      {
        bucket: rootStorageBucket.id,
        rule: [
          {
            applyServerSideEncryptionByDefault: {
              sseAlgorithm: 'AES256',
            },
          },
        ],
      }
    )

    const storageConfiguration =
      new databricks.mwsStorageConfigurations.MwsStorageConfigurations(
        this,
        'databricks-storage',
        {
          provider: this.mws,
          accountId: databricksAccountId,
          bucketName: rootStorageBucket.bucket,
          storageConfigurationName: `${prefix}-storage`,
        }
      )

    return storageConfiguration.storageConfigurationId
  }

  private crossAccountRole() {
    const doc = new aws.dataAwsIamPolicyDocument.DataAwsIamPolicyDocument(
      this,
      'assume-role-doc',
      {
        statement: [
          {
            effect: 'Allow',
            actions: ['sts:AssumeRole'],
            principals: [
              {
                identifiers: ['ec2.amazonaws.com'],
                type: 'Service',
              },
            ],
          },
        ],
      }
    )

    const profileRole = new aws.iamRole.IamRole(this, 'profile-role', {
      name: `shared-ec2-role-${region}`,
      description: "Role for Databrick's EC2 to access Kinesis etc.",
      assumeRolePolicy: doc.json,
      managedPolicyArns: [
        'arn:aws:iam::aws:policy/AmazonKinesisReadOnlyAccess',
        'arn:aws:iam::aws:policy/SecretsManagerReadWrite',
      ],
      tags: { Project: 'databricks' },
    })

    const assumeRolePolicy =
      new databricks.dataDatabricksAwsAssumeRolePolicy.DataDatabricksAwsAssumeRolePolicy(
        this,
        'assume-role-policy',
        {
          externalId: databricksAccountId,
        }
      )

    const crossAccountRole = new aws.iamRole.IamRole(this, 'iam-role', {
      name: `${prefix}-crossaccount`,
      assumeRolePolicy: assumeRolePolicy.json,
      tags: { Project: 'databricks' },
    })

    const crossAcountPolicy =
      new databricks.dataDatabricksAwsCrossaccountPolicy.DataDatabricksAwsCrossaccountPolicy(
        this,
        'cross-account',
        {
          passRoles: [profileRole.arn],
        }
      )

    const policy = new aws.iamRolePolicy.IamRolePolicy(
      this,
      `iam-role-policy-${region}`,
      {
        name: `${prefix}-policy`,
        role: crossAccountRole.id,
        policy: crossAcountPolicy.json,
      }
    )

    const wait = new sleep.Sleep(this, 'wait', {
      dependsOn: [crossAccountRole, policy],
      triggers: {
        crossAccount: crossAccountRole.arn,
        policy: policy.id,
      },
      createDuration: '10s',
    })

    const credentials = new databricks.mwsCredentials.MwsCredentials(
      this,
      'mws-credentials',
      {
        provider: this.mws,
        accountId: databricksAccountId,
        roleArn: crossAccountRole.arn,
        credentialsName: `${prefix}-mws-creds`,
        dependsOn: [wait],
      }
    )

    const passRoleDoc =
      new aws.dataAwsIamPolicyDocument.DataAwsIamPolicyDocument(
        this,
        'pass-role',
        {
          statement: [
            {
              effect: 'Allow',
              actions: ['iam:PassRole'],
              resources: [profileRole.arn],
            },
          ],
        }
      )

    const sharedPolicy = new aws.iamPolicy.IamPolicy(
      this,
      `pass-role-for-s3-access-${region}`,
      {
        name: `shared-pass-role-for-ec2-${region}`,
        path: '/',
        policy: passRoleDoc.json,
        tags: { Project: 'databricks' },
      }
    )

    new aws.iamRolePolicyAttachment.IamRolePolicyAttachment(
      this,
      `cross-account-attachment-${region}`,
      {
        policyArn: sharedPolicy.arn,
        role: crossAccountRole.name,
      }
    )

    return {
      credentialsId: credentials.credentialsId,
      profileRoleName: profileRole.name,
    }
  }
  private createMetastore(): string {
    const userIds = this.createUsers()
    const metaStorageBucket = new aws.s3Bucket.S3Bucket(
      this,
      'meta-storage-bucket',
      {
        bucket: `${prefix}-metastore`,
        forceDestroy: true,
        tags: {
          Name: `${prefix}-metastore`,
          Project: 'databricks',
        },
      }
    )

    const metastoreBucketState =
      new aws.s3BucketOwnershipControls.S3BucketOwnershipControls(
        this,
        'metastore-bucket-state',
        {
          bucket: metaStorageBucket.id,
          rule: {
            objectOwnership: 'BucketOwnerPreferred',
          },
        }
      )

    new aws.s3BucketAcl.S3BucketAcl(this, 'metastore-bucket-acl', {
      bucket: metaStorageBucket.id,
      acl: 'private',
      dependsOn: [metastoreBucketState],
    })

    new aws.s3BucketPublicAccessBlock.S3BucketPublicAccessBlock(
      this,
      'public-access-block',
      {
        bucket: metaStorageBucket.id,
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true,
        dependsOn: [metaStorageBucket],
      }
    )

    new aws.s3BucketVersioning.S3BucketVersioningA(
      this,
      'metastore-versioning',
      {
        bucket: metaStorageBucket.id,
        versioningConfiguration: {
          status: 'Disabled',
        },
      }
    )

    const passRoleForUc =
      new aws.dataAwsIamPolicyDocument.DataAwsIamPolicyDocument(
        this,
        'passrole-for-uc',
        {
          statement: [
            {
              effect: 'Allow',
              actions: ['sts:AssumeRole'],
              principals: [
                {
                  type: 'AWS',
                  identifiers: [
                    'arn:aws:iam::414351767826:role/unity-catalog-prod-UCMasterRole-14S5ZJVKOTYTL',
                    `arn:aws:iam::${awsAccountId}:role/${prefix}-uc-access`,
                  ],
                },
              ],
              condition: [
                {
                  test: 'StringEquals',
                  variable: 'sts:ExternalId',
                  values: [databricksAccountId],
                },
              ],
            },
            {
              sid: 'ExplicitSelfRoleAssumption',
              effect: 'Allow',
              actions: ['sts:AssumeRole'],
              principals: Object.values(AWS_ACCOUNTS).map((accountId) => ({
                type: 'AWS',
                identifiers: [`arn:aws:iam::${accountId}:root`],
              })),
              condition: [
                {
                  test: 'ArnLike',
                  variable: 'aws:PrincipalArn',
                  values: [
                    `arn:aws:iam::${awsAccountId}:role/${prefix}-uc-access`,
                  ],
                },
              ],
            },
          ],
        }
      )

    const unityMetastorePolicyDoc =
      new aws.dataAwsIamPolicyDocument.DataAwsIamPolicyDocument(
        this,
        'unity-metastore-policy',
        {
          statement: [
            {
              effect: 'Allow',
              actions: [
                's3:GetObject',
                's3:GetObjectVersion',
                's3:PutObject',
                's3:PutObjectAcl',
                's3:DeleteObject',
                's3:ListBucket',
                's3:GetBucketLocation',
                's3:GetLifecycleConfiguration',
                's3:PutLifecycleConfiguration',
              ],
              resources: [metaStorageBucket.arn, `${metaStorageBucket.arn}/*`],
            },
            {
              actions: ['sts:AssumeRole'],
              resources: [
                `arn:aws:iam::${awsAccountId}:role/${prefix}-uc-access`,
              ],
              effect: 'Allow',
            },
          ],
        }
      )

    const unityMetastorePolicy = new aws.iamPolicy.IamPolicy(
      this,
      'unity-metastore',
      {
        policy: unityMetastorePolicyDoc.json,
        tags: {
          Name: `${prefix}-unity-catalog IAM policy`, // Replace `localPrefix` with your local prefix variable or value
          Project: 'databricks',
        },
      }
    )

    const metastoreRole = new aws.iamRole.IamRole(this, 'metastore-iam-role', {
      name: `${prefix}-uc-access`,
      assumeRolePolicy: passRoleForUc.json,
      managedPolicyArns: [unityMetastorePolicy.arn],
      tags: {
        Name: `${prefix}-unity-catalog IAM role`,
        Project: 'databricks',
      },
    })

    const adminGroup = new databricks.group.Group(this, 'admin-group', {
      provider: this.mws,
      displayName: regionalAdminGroupName,
    })

    userIds.forEach((userId, i) => {
      new databricks.groupMember.GroupMember(this, `admin-group-member-${i}`, {
        provider: this.mws,
        groupId: adminGroup.id,
        memberId: userId,
      })
      new databricks.userRole.UserRole(this, `admin-${i}`, {
        provider: this.mws,
        userId: userId,
        role: 'account_admin',
      })
    })

    const sp =
      new databricks.dataDatabricksServicePrincipal.DataDatabricksServicePrincipal(
        this,
        'service-principal',
        {
          provider: this.mws,
          applicationId: 'cb9efcf2-ffd5-484a-badc-6317ba4aef91',
        }
      )

    new databricks.groupMember.GroupMember(this, `tf-group-member`, {
      provider: this.mws,
      groupId: adminGroup.id,
      memberId: sp.id,
    })
    const metastore = new databricks.metastore.Metastore(this, 'metastore', {
      provider: this.mws,
      name: `primary-${region}`,
      storageRoot: `s3://${metaStorageBucket.id}/metastore`,
      owner: regionalAdminGroupName,
      region: awsRegion,
      forceDestroy: true,
      dependsOn: [adminGroup],
    })

    const waitRoleCreation = new sleep.Sleep(this, 'wait-role-creation', {
      dependsOn: [metastoreRole, metastore],
      triggers: {
        metastoreRole: metastoreRole.arn,
        metastore: metastore.metastoreId,
      },
      createDuration: '30s',
    })

    new databricks.metastoreDataAccess.MetastoreDataAccess(
      this,
      'metastore-data-access',
      {
        provider: this.mws,
        metastoreId: metastore.id,
        name: metastoreRole.name,
        awsIamRole: {
          roleArn: metastoreRole.arn,
        },
        isDefault: true,
        dependsOn: [waitRoleCreation],
      }
    )
    return metastore.metastoreId
  }

  private fetchMetastore() {
    const metastores =
      new databricks.dataDatabricksMetastores.DataDatabricksMetastores(
        this,
        'meta',
        {
          provider: this.mws,
        }
      )
    return Fn.lookup(metastores.ids, `primary-${region}`)
  }

  private templateJobNotebook(job: string) {
    return btoa(`${notebookHeader}
Jobs(spark).${job}()`)
  }
}

getTenantInfoFromUsagePlans(awsRegion).then((tenants) => {
  if (tenants.length === 0) {
    throw new Error('no tenants found')
  }
  const app = new App()
  const tenantIds = tenants.map((t) => t.id.toLowerCase())

  // Add demo mode tenants.
  if (stage === 'sandbox') {
    tenantIds.push(...tenantIds.map((tid) => `${tid}-test`))
  }
  new DatabricksStack(app, `databricks-stack-${env}`, tenantIds)
  app.synth()
})

const enabledTenantIds = [
  'ydtx15ustg', // Banked eu-2
  'cypress-tenant',
  'f05d33ea95',
  'ft398yyjmd',
  '5CIHDWCU3K',
  'c4c4eca1f5',
].map((tenantId) => tenantId.toLowerCase())
