import { FlagrightRegion, Stage } from '@flagright/lib/constants/deploy'
import { CfnOutput, Stack, Environment, RemovalPolicy } from 'aws-cdk-lib'
import { Cluster, ContainerImage, LogDrivers } from 'aws-cdk-lib/aws-ecs'
import {
  Effect,
  ManagedPolicy,
  Policy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam'
import { SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs'
import { BlockPublicAccess, Bucket, HttpMethods } from 'aws-cdk-lib/aws-s3'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import {
  createDockerImage,
  createFargateTaskDefinition,
} from './cdk-utils/cdk-fargate-utils'

export type StackProps = {
  stage: Stage
  region?: Omit<FlagrightRegion, 'asia-2'>
  env: Environment
}
export class CdkLoadTestingStack extends Stack {
  config: StackProps
  constructor(ctx: Construct, id: string, config: StackProps) {
    super(ctx, id, { env: config.env })
    this.config = config
    const vpc = new Vpc(this, 'load-test-vpc', {
      natGateways: 1,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          name: 'public-subnet',
          subnetType: SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'private-subnet',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    })
    const securityGroup = new SecurityGroup(this, 'load-test-security-group', {
      vpc,
      allowAllOutbound: true,
    })
    const cluster = new Cluster(this, 'load-test-ecs-cluster', {
      vpc,
      enableFargateCapacityProviders: true,
    })
    cluster.addDefaultCapacityProviderStrategy([
      { capacityProvider: 'FARGATE_SPOT', weight: 1 },
    ])
    const bucket = new Bucket(
      this,
      `${config.stage}-jmeter-load-testing-bucket`,
      {
        bucketName: `${config.stage}-jmeter-load-testing-bucket`,
        cors: [
          {
            allowedMethods: [
              HttpMethods.GET,
              HttpMethods.PUT,
              HttpMethods.POST,
              HttpMethods.DELETE,
            ],
            allowedOrigins: ['*'],
            allowedHeaders: ['*'],
          },
        ],
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        removalPolicy: RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      }
    )
    const taskRole = new Role(this, 'load-task-role', {
      roleName: 'load-task-role',
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonECSTaskExecutionRolePolicy'
        ),
      ],
    })
    taskRole.attachInlinePolicy(
      new Policy(this, 'ecs-task-policy', {
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['s3:*'],
            resources: [
              `arn:aws:s3:::${config.stage}-jmeter-load-testing-bucket/*`,
            ],
          }),
        ],
      })
    )
    const logGroup = new LogGroup(this, 'load-test-logs', {
      logGroupName: '/ecs/load-testing',
      removalPolicy: RemovalPolicy.DESTROY,
      retention: RetentionDays.ONE_DAY,
    })

    const taskDefinition = createFargateTaskDefinition(
      this,
      'load-testing-fargate-task',
      { cpu: 4096, role: taskRole, memoryLimitMiB: 8192, architecture: 'arm64' }
    )
    const container = taskDefinition.addContainer('load-testing-container', {
      image: ContainerImage.fromDockerImageAsset(
        createDockerImage(this, 'jmeter-image', {
          path: 'load-testing',
          architecture: 'arm64',
        })
      ),
      logging: LogDrivers.awsLogs({ logGroup, streamPrefix: 'jmeter' }),
    })
    new CfnOutput(this, `${config.stage}-Load-Test-BucketName`, {
      value: bucket.bucketName,
    })
    new CfnOutput(this, `${config.stage}-Load-Test-EcsClusterArn`, {
      value: cluster.clusterArn,
    })
    new CfnOutput(this, `${config.stage}-Load-Test-TaskArn`, {
      value: taskDefinition.taskDefinitionArn,
    })
    new CfnOutput(this, `${config.stage}-Load-Test-SubnetId`, {
      value: vpc.privateSubnets[0].subnetId,
    })
    new CfnOutput(this, `${config.stage}-Load-Test-SecurityGroupId`, {
      value: securityGroup.securityGroupId,
    })
    new CfnOutput(this, `${config.stage}-Load-Test-FargateContainerName`, {
      value: container.containerName,
    })
  }
}
