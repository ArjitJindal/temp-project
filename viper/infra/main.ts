import { Construct } from 'constructs'
import { App, TerraformStack, S3Backend } from 'cdktf'
import * as aws from './.gen/providers/aws'
import * as databricks from './.gen/providers/databricks'
import * as mvn from './.gen/providers/maven'
import { provider } from '@cdktf/provider-time'
import { TerraformHclModule } from 'cdktf'
import { Fn } from 'cdktf'
import { TerraformProvider } from 'cdktf/lib/terraform-provider'
import { Config } from '@flagright/lib/config/config'
import { getTarponConfig } from '@flagright/lib/constants/config'
import { Stage, FlagrightRegion } from '@flagright/lib/constants/deploy'
import { getTenantInfoFromUsagePlans } from '@flagright/lib/tenants/usage-plans'
import { AWS_ACCOUNTS } from '@flagright/lib/constants'
import * as path from 'path'
import { provider as nullProvider } from '@cdktf/provider-null'
import { IamRole } from '@cdktf/provider-aws/lib/iam-role'
import { IamRolePolicy } from '@cdktf/provider-aws/lib/iam-role-policy'
import * as fs from 'fs'
import * as crypto from 'crypto'

// Toggle this to remove tenants.
const stage = process.env.STAGE as Stage

const region = process.env.REGION as FlagrightRegion
const env = `${stage}-${region}`
const config = getTarponConfig(stage, region)
const awsRegion = config.env.region || ''
const stateBucket = `flagright-terraform-state-databricks-${env}`
const prefix = `flagright-databricks-${stage}-${region}`
const awsPrefix = `flagright-datalake-${stage}-${region}`
const cidrBlock = '10.4.0.0/16'
const databricksClientId = 'cb9efcf2-ffd5-484a-badc-6317ba4aef91'
const databricksAccountId = 'e2fae071-88c7-4b3e-90cd-2f4c5ced45a7'
const awsAccountId = AWS_ACCOUNTS[stage]

const jobs = [
  {
    name: 'stream',
    description: 'Stream data from kinesis.',
    continuous: false,
    schedule: 'CRON(0 0 0 * * ?)',
    compute: 'G.1X',
    numWorkers: 2,
  },
  {
    name: 'refresh',
    description: 'Rebuild derived tables from kinesis and mongo data.',
    continuous: false,
    compute: 'G.2X',
    numWorkers: 4,
  },
  {
    name: 'backfill',
    description:
      'Reset everything by clearing all tables and backfilling from mongo.',
    continuous: false,
    compute: 'G.2X',
    numWorkers: 4,
  },
  {
    name: 'optimize',
    description: 'Optimize all tables nightly',
    schedule: 'CRON(0 0 0 * * ?)',
    compute: 'G.025X',
    // Minimum workers allowed by AWS API is currently 2
    numWorkers: 2,
  },
]

const notebookHeader = `
%pip install --no-dependencies /Workspace/Shared/src-0.1.0-py3-none-any.whl
from src.jobs.jobs import Jobs
`

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
      defaultTags: [
        {
          tags: {
            deployment: 'viper',
            owner: 'terraform',
          },
        },
      ],
      skipRegionValidation: true,
    })

    new mvn.provider.MavenProvider(this, 'mvn', {})

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

    if (!config.viper) {
      return
    }

    this.awsWorkspace()
  }

  private awsWorkspace() {
    new aws.athenaWorkgroup.AthenaWorkgroup(this, 'athena-workgroup', {
      name: 'datalake',
      configuration: {
        enforceWorkgroupConfiguration: true,
        publishCloudwatchMetricsEnabled: true,
        resultConfiguration: {
          outputLocation: `s3://${awsPrefix}-bucket/output/`,
        },
      },
      forceDestroy: true,
    })
  }

  private fetchVpc(): {
    securityGroupIds: string[]
    privateSubnetIds: string[]
    subnetIds: string[]
    vpcId: string
  } {
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
      privateSubnetIds: subnets.ids,
      vpcId,
      securityGroupIds: securityGroups.ids,
    }
  }

  private createVpc(): {
    securityGroupIds: string[]
    privateSubnetIds: string[]
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
        },
      },
    })

    return {
      securityGroupIds: [vpc.get('default_security_group_id')],
      subnetIds: vpc.get('public_subnets'),
      privateSubnetIds: vpc.get('private_subnets'),
      vpcId: vpc.get('vpc_id'),
    }
  }

  private templateAwsJobNotebook(job: string) {
    return `
import os
from src.jobs.jobs import Jobs
from pyspark.context import SparkContext
from awsglue.context import GlueContext
import logging
logger = logging.getLogger()
logger.setLevel(logging.WARN)

sc = SparkContext.getOrCreate()
sc.setLogLevel("WARN")
glueContext = GlueContext(sc)
spark = glueContext.spark_session

Jobs(spark).${job}()`
  }

  private templateAwsEmrJobNotebook(job: string) {
    return `
import os
from src.jobs.jobs import Jobs
from pyspark.sql import SparkSession
from pyspark.context import SparkContext

spark = SparkSession.builder.appName("ExamplePySparkJob").enableHiveSupport().getOrCreate()

import logging
logger = logging.getLogger()
logger.setLevel(logging.WARN)

sc = SparkContext.getOrCreate()
sc.setLogLevel("WARN")

Jobs(spark).${job}()
spark.stop()
`
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
