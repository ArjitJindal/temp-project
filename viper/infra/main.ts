import { Construct } from 'constructs'
import { App, TerraformStack, S3Backend } from 'cdktf'
import * as aws from './.gen/providers/aws'
import * as databricks from './.gen/providers/databricks'
import * as mvn from './.gen/providers/maven'
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
import { provider as nullProvider } from '@cdktf/provider-null'
import { ALL_ENGINEERS } from '../../lib/constants/engineers'

// Toggle this to remove tenants.
const preventTenantDestruction = false
const stage = process.env.STAGE as Stage

const region = process.env.REGION as FlagrightRegion
const env = `${stage}-${region}`
const config = getTarponConfig(stage, region)
const awsRegion = config.env.region || ''
const regionalAdminGroupName = `${awsRegion}-admins`
const awsPrefix = `flagright-datalake-${stage}-${region}`
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

const jobs = [
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
    name: 'stream',
    description: 'Stream live from kinesis and transform',
    continuous: true,
    compute: 'G.025X',
    // Minimum workers allowed by AWS API is currently 2
    numWorkers: 2,
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

    // Create or retrieve metastores, VPC, users.
    const { securityGroupIds, subnetIds, vpcId } = config.viper.CREATE_VPC
      ? this.createVpc()
      : this.fetchVpc()

    const storageConfigurationId = this.rootStorage()
    const { credentialsId, profileRoleName } = this.crossAccountRole()

    this.awsWorkspace(
      config.viper.CREATE_VPC
        ? undefined
        : {
            availabilityZone: `${awsRegion}a`,
            vpcId: vpcId,
            subnetId: Fn.element(subnetIds, 0),
          }
    )
  }

  private awsWorkspace(vpc?: {
    availabilityZone: string
    vpcId: string
    subnetId: string
  }) {
    const datalakeBucket = new aws.s3Bucket.S3Bucket(
      this,
      'datalake-storage-bucket',
      {
        bucket: `${awsPrefix}-bucket`,
        forceDestroy: true,
        tags: {
          Name: `${awsPrefix}-bucket`,
        },
      }
    )

    const publicAccessBlock =
      new aws.s3BucketPublicAccessBlock.S3BucketPublicAccessBlock(
        this,
        'datalake-bucket-public-access',
        {
          bucket: datalakeBucket.id,
          blockPublicAcls: true,
          blockPublicPolicy: true,
          ignorePublicAcls: true,
          restrictPublicBuckets: true,
          dependsOn: [datalakeBucket],
        }
      )

    const bucketState =
      new aws.s3BucketOwnershipControls.S3BucketOwnershipControls(
        this,
        'datalake-bucket-state',
        {
          bucket: datalakeBucket.id,
          rule: {
            objectOwnership: 'BucketOwnerPreferred',
          },
        }
      )

    const bucketPolicy =
      new aws.dataAwsIamPolicyDocument.DataAwsIamPolicyDocument(
        this,
        'datalake-bucket-policy-doc',
        {
          statement: [
            {
              principals: [
                {
                  type: '*',
                  identifiers: ['*'],
                },
              ],
              effect: 'Allow',
              actions: ['s3:GetObject', 's3:ListBucket', 's3:PutObject'],
              resources: [datalakeBucket.arn, `${datalakeBucket.arn}/*`],
              condition: [
                {
                  test: 'StringEquals',
                  variable: 'aws:PrincipalAccount',
                  values: [awsAccountId],
                },
                {
                  test: 'ForAnyValue:StringEquals',
                  variable: 'aws:CalledVia',
                  values: ['athena.amazonaws.com'],
                },
              ],
            },
          ],
        }
      )

    new aws.s3BucketAcl.S3BucketAcl(this, 'datalake-bucket-acl', {
      bucket: datalakeBucket.id,
      acl: 'private',
      dependsOn: [bucketState],
    })

    new aws.s3BucketPolicy.S3BucketPolicy(this, 'datalake-bucket-policy', {
      bucket: datalakeBucket.id,
      policy: bucketPolicy.json,
      dependsOn: [bucketState, publicAccessBlock],
    })

    new aws.s3BucketVersioning.S3BucketVersioningA(
      this,
      'datalake-bucket-versioning',
      {
        bucket: datalakeBucket.id,
        versioningConfiguration: {
          status: 'Disabled',
        },
      }
    )

    const doc = new aws.dataAwsIamPolicyDocument.DataAwsIamPolicyDocument(
      this,
      'glue-assume-role-doc',
      {
        statement: [
          {
            effect: 'Allow',
            actions: ['sts:AssumeRole'],
            principals: [
              {
                identifiers: ['glue.amazonaws.com'],
                type: 'Service',
              },
            ],
          },
        ],
      }
    )

    const profileRole = new aws.iamRole.IamRole(this, 'glue-role', {
      name: `glue-role-${region}`,
      description: 'Role for Glue to access Kinesis etc.',
      assumeRolePolicy: doc.json,
      managedPolicyArns: [
        'arn:aws:iam::aws:policy/AmazonKinesisReadOnlyAccess',
        'arn:aws:iam::aws:policy/SecretsManagerReadWrite',
        'arn:aws:iam::aws:policy/AmazonS3FullAccess',
        'arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole',
      ],
      tags: { Project: 'viper' },
    })

    new aws.athenaWorkgroup.AthenaWorkgroup(this, 'athena-workgroup', {
      name: 'datalake',
      configuration: {
        enforceWorkgroupConfiguration: true,
        publishCloudwatchMetricsEnabled: true,
        resultConfiguration: {
          outputLocation: `s3://${datalakeBucket.bucket}/output/`,
        },
      },
    })

    const mongoJar = new mvn.dataMavenArtifact.DataMavenArtifact(
      this,
      'mongo-jar',
      {
        groupId: 'org.mongodb.spark',
        artifactId: 'mongo-spark-connector_2.12',
        version: '3.0.2',
      }
    )

    const mongoJarObject = new aws.s3Object.S3Object(this, 's3-object', {
      bucket: datalakeBucket.bucket,
      source: mongoJar.outputPath,
      key: 'mongo.jar',
    })

    new aws.s3Object.S3Object(this, `currency-rates-json`, {
      bucket: datalakeBucket.bucket,
      key: `/currency_rates_backfill.json`,
      source: path.resolve(__dirname, '../data/currency_rates_backfill.json'),
    })

    const pythonPackage = new aws.s3BucketObject.S3BucketObject(
      this,
      'python-package',
      {
        bucket: datalakeBucket.bucket,
        key: 'src-0.1.0-py3-none-any.whl',
        source: path.resolve(__dirname, '../dist/src-0.1.0-py3-none-any.whl'),
      }
    )

    const mongoSecret =
      new aws.dataAwsSecretsmanagerSecret.DataAwsSecretsmanagerSecret(
        this,
        'mongo-secret-aws',
        {
          name: 'mongoAtlasCreds',
        }
      )
    const mongoSecretVersion =
      new aws.dataAwsSecretsmanagerSecretVersion.DataAwsSecretsmanagerSecretVersion(
        this,
        'mongo-secret-version-aws',
        {
          secretId: mongoSecret.id,
        }
      )
    const mongoSecretValue = Fn.jsondecode(mongoSecretVersion.secretString)
    const connections: string[] = []

    if (vpc) {
      const sg = new aws.securityGroup.SecurityGroup(this, 'glue-sg', {
        name: 'glue-sg',
        vpcId: vpc.vpcId,
      })
      new aws.securityGroupRule.SecurityGroupRule(this, 'sg-ingress-rule', {
        type: 'ingress',
        securityGroupId: sg.id,
        fromPort: 0,
        toPort: 65535,
        protocol: 'tcp',
        selfAttribute: true,
      })
      new aws.securityGroupRule.SecurityGroupRule(this, 'sg-rule', {
        type: 'egress',
        securityGroupId: sg.id,
        fromPort: 0,
        toPort: 65535,
        cidrBlocks: ['0.0.0.0/0'],
        protocol: 'tcp',
      })
      const mongoConnection = new aws.glueConnection.GlueConnection(
        this,
        'mongo-connection',
        {
          connectionType: 'MONGODB',
          connectionProperties: {
            CONNECTION_URL: `mongodb+srv://${Fn.lookup(
              mongoSecretValue,
              'host'
            )}/tarpon`,
            USERNAME: Fn.lookup(mongoSecretValue, 'username'),
            PASSWORD: Fn.lookup(mongoSecretValue, 'password'),
          },
          name: 'mongo',
          physicalConnectionRequirements: {
            availabilityZone: vpc.availabilityZone,
            securityGroupIdList: [sg.id],
            subnetId: vpc.subnetId,
          },
        }
      )
      connections.push(mongoConnection.name)
    }

    const log4PropertiesFile = new aws.s3Object.S3Object(
      this,
      `spark-properties`,
      {
        bucket: datalakeBucket.bucket,
        key: `log4j2.properties`,
        content: `
log4j.rootCategory=ERROR,console
log4j.appender.console=org.apache.log4j.ConsoleAppender
log4j.appender.console.target=System.err
log4j.appender.console.layout=org.apache.log4j.PatternLayout
log4j.appender.console.layout.ConversionPattern=%d{yy/MM/dd HH:mm:ss} %p %c{1}: %m%n`,
      }
    )

    jobs.map((job) => {
      const script = new aws.s3Object.S3Object(this, `${job.name}-script`, {
        bucket: datalakeBucket.bucket,
        key: `${job.name}.script`,
        content: this.templateAwsJobNotebook(job.name),
      })
      const glueJob = new aws.glueJob.GlueJob(this, `${job.name}-glue-job`, {
        name: job.name,
        description: job.schedule,
        roleArn: profileRole.arn,
        connections,
        command: {
          name: 'gluestreaming',
          scriptLocation: `s3://${datalakeBucket.bucket}/${script.key}`,
          pythonVersion: '3',
        },
        workerType: job.compute,
        numberOfWorkers: job.numWorkers,
        defaultArguments: {
          '--force_backfill': 'false',
          '--tenants': `${this.tenantIds.join(',')}`,
          '--datalake_bucket': datalakeBucket.bucket,
          '--job-language': 'python-3',
          '--enable-spark-ui': 'true',
          '--enable-continuous-cloudwatch-log': 'true',
          '--enable-continuous-log-filter': 'true',
          '--spark-event-logs-path': `s3://${datalakeBucket.bucket}/spark-logs/`,
          '--job-bookmark-option': 'job-bookmark-disable',
          '--enable-glue-datacatalog': 'true',
          '--datalake-formats': 'delta',
          '--conf': `spark.sql.streaming.stateStore.stateSchemaCheck=false --conf spark.sql.extensions=io.delta.sql.DeltaSparkSessionExtension --conf spark.sql.warehouse.dir=s3://${datalakeBucket.bucket}/warehouse/ --conf spark.sql.catalog.spark_catalog=org.apache.spark.sql.delta.catalog.DeltaCatalog --conf spark.delta.logStore.class=org.apache.spark.sql.delta.storage.S3SingleDriverLogStore`,
          '--additional-python-modules': `s3://${datalakeBucket.bucket}/${pythonPackage.key},delta-spark`,
          '--extra-jars': `s3://${datalakeBucket.bucket}/${mongoJarObject.key}`,
          '--extra-files': `s3://${datalakeBucket.bucket}/${log4PropertiesFile.key}`,
        },
      })
      if (job.schedule) {
        new aws.glueTrigger.GlueTrigger(this, `${job.name}-trigger`, {
          name: `${job.name}-trigger`,
          schedule: job.schedule,
          type: 'SCHEDULED',
          actions: [
            {
              jobName: glueJob.name,
            },
          ],
        })
      }
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
