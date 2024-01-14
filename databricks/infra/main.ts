import { Construct } from 'constructs'
import { App, TerraformStack, S3Backend, TerraformOutput } from 'cdktf'
import * as aws from './.gen/providers/aws'
import * as databricks from './.gen/providers/databricks'
import { sleep, provider } from '@cdktf/provider-time'
import { TerraformHclModule } from 'cdktf'
import { Fn } from 'cdktf'
import { ITerraformDependable } from 'cdktf/lib/terraform-dependable'
import { TerraformProvider } from 'cdktf/lib/terraform-provider'
import { Config } from '@flagright/lib/config/config'
import { getTarponConfig } from '@flagright/lib/constants/config'
import { Stage, FlagrightRegion } from '@flagright/lib/constants/deploy'
import { AWS_ACCOUNTS } from '@flagright/lib/constants'
import * as fs from 'fs'
import * as path from 'path'

const adminEmails = ['tim+pw@flagright.com']
const stage = process.env.STAGE as Stage
const region = process.env.REGION as FlagrightRegion
const env = `${stage}-${region}`
const config = getTarponConfig(stage, region)
const awsRegion = config.env.region
const regionalAdminGroupName = `admins-${awsRegion}`
const stateBucket = `flagright-terraform-state-databricks-${env}`
const kinesisStreamName = 'tarponDynamoChangeCaptureStream'
const prefix = `flagright-databricks-${env}`
const cidrBlock = '10.4.0.0/16'
const databricksClientId = 'cb9efcf2-ffd5-484a-badc-6317ba4aef91'
const databricksAccountId = 'e2fae071-88c7-4b3e-90cd-2f4c5ced45a7'
const awsAccountId = AWS_ACCOUNTS[stage]

class DatabricksStack extends TerraformStack {
  config: Config
  mws: TerraformProvider

  constructor(scope: Construct, name: string) {
    super(scope, name)
    this.config = config

    new S3Backend(this, {
      bucket: stateBucket,
      key: env,
      region: awsRegion,
    })

    // Providers
    new aws.provider.AwsProvider(this, 'aws', {
      region: awsRegion,
    })

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
    const shouldCreateUsers = stage === 'prod'

    // Create or retrieve metastores, VPC, users.
    const { securityGroupIds, subnetIds, vpcId } = shouldCreateVpc
      ? this.createVpc()
      : this.fetchVpc()
    const userIds = shouldCreateUsers ? this.createUsers() : this.fetchUsers()
    const metastoreId = shouldCreateMetastore
      ? this.createMetastore(userIds)
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
    const metastoreAssignment =
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
      metastoreId,
      metastoreAssignment,
      profileRoleName,
      workspaceProvider,
    })
  }

  private workspace({
    metastoreId,
    profileRoleName,
    metastoreAssignment,
    workspaceProvider,
  }: {
    workspaceProvider: databricks.provider.DatabricksProvider
    metastoreId: string
    profileRoleName: string
    metastoreAssignment: ITerraformDependable
  }) {
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
      ],
    })

    const mainCatalog = new databricks.catalog.Catalog(this, 'main-catalog', {
      provider: workspaceProvider,
      metastoreId: metastoreId,
      name: Fn.replace(env, '-', '_'),
      comment: 'This catalog is managed by terraform',
      properties: {
        purpose: 'testing',
      },
      dependsOn: [metastoreAssignment],
      forceDestroy: true,
    })

    new databricks.schema.Schema(this, 'main-schema', {
      provider: workspaceProvider,
      name: 'main',
      catalogName: mainCatalog.name,
      dependsOn: [mainCatalog],
    })

    new databricks.grants.Grants(this, 'main-grants-env', {
      provider: workspaceProvider,
      catalog: mainCatalog.name,
      grant: [
        {
          principal: regionalAdminGroupName,
          privileges: ['ALL_PRIVILEGES'],
        },
      ],
      dependsOn: [metastoreAssignment],
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

    adminEmails.forEach((email, index) => {
      const user = new databricks.user.User(this, `workspace-user-${index}`, {
        provider: workspaceProvider,
        userName: email,
        force: true,
      })
      new databricks.groupMember.GroupMember(
        this,
        `workspace-group-member-${index}`,
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

    const mongoSecret =
      new aws.dataAwsSecretsmanagerSecret.DataAwsSecretsmanagerSecret(
        this,
        'mongo-secret',
        {
          arn: this.config.application.ATLAS_CREDENTIALS_SECRET_ARN,
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
      dataSecurityMode: 'NONE',
      accessMode: 'NO_ISOLATION',
      sparkEnvVars: {
        KINESIS_REGION: awsRegion,
        KINESIS_STREAM: kinesisStreamName,
      },
      autoterminationMinutes: 15,
      awsAttributes: {
        instanceProfileArn: instanceProfile.id,
        zoneId: awsRegion,
      },
    }

    new databricks.cluster.Cluster(this, 'cluster', {
      ...clusterConfig,
      provider: workspaceProvider,
      sparkVersion: '13.3.x-scala2.12',
      clusterName: 'Shared Autoscaling',
      nodeTypeId: 'm5d.large',
      autoscale: {
        minWorkers: 1,
        maxWorkers: 4,
      },
      library: [
        {
          maven: {
            coordinates: 'org.mongodb.spark:mongo-spark-connector_2.12:3.0.2',
          },
        },
        {
          pypi: {
            package: 'pymongo',
          },
        },
      ],
      dependsOn: [instanceProfile],
    })

    const sqlWarehouse = new databricks.sqlEndpoint.SqlEndpoint(
      this,
      'sql-endpoint',
      {
        provider: workspaceProvider,
        name: 'tarpon',
        clusterSize: '2X-Small',
        autoStopMins: 5,
        enableServerlessCompute: true,
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

    const databricksAccessTokenSecret =
      new aws.secretsmanagerSecret.SecretsmanagerSecret(
        this,
        'databricks-access-secret',
        {
          name: 'databricks-access',
        }
      )

    new aws.secretsmanagerSecretVersion.SecretsmanagerSecretVersion(
      this,
      'databricks-access-secret-version',
      {
        secretId: databricksAccessTokenSecret.id,
        secretString: Fn.jsonencode({
          serverHostname: sqlWarehouse.odbcParams.hostname,
          httpPath: sqlWarehouse.odbcParams.path,
          token: databricksAccessToken.tokenValue,
        }),
      }
    )

    // TODO give databricks access to github instead.
    const directoryPath = path.resolve(__dirname, '..', 'src')
    fs.readdirSync(directoryPath, { recursive: true, withFileTypes: true })
      .filter((file) => file.isFile())
      .map((file) => path.join(file.path.replace(directoryPath, ''), file.name))
      .forEach((file, index) => {
        new databricks.workspaceFile.WorkspaceFile(
          this,
          `workspace-file-${index}`,
          {
            provider: workspaceProvider,
            source: path.join(directoryPath, file),
            path: path.join('/Shared/main/src', file),
          }
        )
      })

    // TODO create and upload a python WHL instead.
    const genDirectoryPath = path.resolve(
      __dirname,
      '..',
      'openapi',
      'gen',
      'openapi_client',
      'models'
    )
    fs.readdirSync(genDirectoryPath, { withFileTypes: true })
      .filter((file) => file.name !== '__init__.py')
      .map((file) =>
        path.join(file.path.replace(genDirectoryPath, ''), file.name)
      )
      .forEach((file, index) => {
        new databricks.workspaceFile.WorkspaceFile(
          this,
          `gen-workspace-file-${index}`,
          {
            provider: workspaceProvider,
            source: path.join(genDirectoryPath, file),
            path: path.join('/Shared/main/src/openapi_client/models', file),
          }
        )
      })

    new databricks.pipeline.Pipeline(this, `pipeline`, {
      provider: workspaceProvider,
      name: 'main',
      continuous: true,
      development: stage === 'dev',
      cluster: [
        {
          ...clusterConfig,
          nodeTypeId: 'm5d.large',
          numWorkers: 0,
          customTags: {
            ResourceClass: 'SingleNode',
          },
          sparkConf: {
            'spark.databricks.cluster.profile': 'singleNode',
          },
        },
      ],
      library: [
        {
          file: {
            path: `/Shared/main/src/dlt_pipeline/pipeline.py`,
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
  }

  private createUsers() {
    return adminEmails.map((email, index) => {
      return new databricks.user.User(this, `user-${index}`, {
        provider: this.mws,
        userName: email,
        force: true,
      }).id
    })
  }
  private fetchUsers() {
    return adminEmails.map((email, index) => {
      return new databricks.dataDatabricksUser.DataDatabricksUser(
        this,
        `user-${index}`,
        {
          provider: this.mws,
          userName: email,
        }
      ).id
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
  private createMetastore(userIds: string[]): string {
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

    const unityMetastorePolicy = new aws.iamPolicy.IamPolicy(
      this,
      'unity-metastore',
      {
        policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Action: [
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
              Resource: [metaStorageBucket.arn, `${metaStorageBucket.arn}/*`],
              Effect: 'Allow',
            },
          ],
        }),
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

    userIds.forEach((userId, index) => {
      new databricks.groupMember.GroupMember(
        this,
        `admin-group-member-${index}`,
        {
          provider: this.mws,
          groupId: adminGroup.id,
          memberId: userId,
        }
      )
      new databricks.userRole.UserRole(this, `admin-${index}`, {
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
}

const app = new App()
new DatabricksStack(app, `databricks-stack-${env}`)

app.synth()
