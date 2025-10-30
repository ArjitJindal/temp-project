import { URL } from 'url'
import * as cdk from 'aws-cdk-lib'
import { CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib'
import {
  AttributeType,
  BillingMode,
  ITable,
  Table,
} from 'aws-cdk-lib/aws-dynamodb'
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  HttpMethods,
  EventType,
} from 'aws-cdk-lib/aws-s3'
import { LambdaFunction as LambdaFunctionTarget } from 'aws-cdk-lib/aws-events-targets'
import { CfnMalwareProtectionPlan } from 'aws-cdk-lib/aws-guardduty'
import * as iam from 'aws-cdk-lib/aws-iam'
import {
  ArnPrincipal,
  CompositePrincipal,
  Effect,
  ManagedPolicy,
  Policy,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import {
  ApiKey,
  DomainName,
  Period,
  UsagePlan,
} from 'aws-cdk-lib/aws-apigateway'
import {
  DeduplicationScope,
  FifoThroughputLimit,
  Queue,
} from 'aws-cdk-lib/aws-sqs'
import { Subscription, SubscriptionProtocol, Topic } from 'aws-cdk-lib/aws-sns'
import {
  Alias,
  Code,
  FunctionProps,
  LayerVersion,
  Runtime,
  StartingPosition,
} from 'aws-cdk-lib/aws-lambda'
import { Rule, Schedule } from 'aws-cdk-lib/aws-events'
import { Construct, IConstruct } from 'constructs'
import { IStream, Stream, StreamMode } from 'aws-cdk-lib/aws-kinesis'
import {
  KinesisEventSource,
  KinesisEventSourceProps,
  S3EventSource,
  SqsEventSource,
} from 'aws-cdk-lib/aws-lambda-event-sources'
import { CfnDeliveryStream } from 'aws-cdk-lib/aws-kinesisfirehose'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import { SqsSubscription } from 'aws-cdk-lib/aws-sns-subscriptions'
import {
  EbsDeviceVolumeType,
  GatewayVpcEndpoint,
  GatewayVpcEndpointAwsService,
  InterfaceVpcEndpoint,
  InterfaceVpcEndpointAwsService,
  InterfaceVpcEndpointService,
  IpAddresses,
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
  Vpc,
} from 'aws-cdk-lib/aws-ec2'
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager'
import { CnameRecord, HostedZone } from 'aws-cdk-lib/aws-route53'
import {
  DYNAMODB_TABLE_NAMES,
  getDeadLetterQueueName,
  getNameForGlobalResource,
  getResourceNameForTarpon,
  getSuffix,
  SQSQueues,
  StackConstants,
} from '@lib/constants'
import {
  DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS,
  DEFAULT_LAMBDA_TIMEOUT_SECONDS,
} from '@lib/lambdas'
import { Config } from '@flagright/lib/config/config'
import { Metric } from 'aws-cdk-lib/aws-cloudwatch'
import {
  getQaApiKeyId,
  getQaIntegrationTestApiKeyId,
  isQaEnv,
} from '@flagright/lib/qa'
import {
  Chain,
  Choice,
  Condition,
  IntegrationPattern,
  JitterType,
  JsonPath,
  StateMachine,
  Succeed,
} from 'aws-cdk-lib/aws-stepfunctions'
import {
  EcsFargateLaunchTarget,
  EcsRunTask,
  LambdaInvoke,
} from 'aws-cdk-lib/aws-stepfunctions-tasks'
import {
  BATCH_JOB_ID_ENV_VAR,
  BATCH_JOB_PAYLOAD_RESULT_KEY,
  BATCH_JOB_RUN_TYPE_RESULT_KEY,
  BATCH_JOB_TENANT_ID_ENV_VAR,
  FARGATE_BATCH_JOB_RUN_TYPE,
  LAMBDA_BATCH_JOB_RUN_TYPE,
} from '@lib/cdk/constants'
import {
  Cluster,
  ContainerImage,
  FargatePlatformVersion,
} from 'aws-cdk-lib/aws-ecs'
import {
  DeployStage,
  FlagrightRegion,
  getSecretsManagerReplicaRegions,
} from '@flagright/lib/constants/deploy'
import { siloDataTenants } from '@flagright/lib/constants/silo-data-tenants'
import { Domain, EngineVersion } from 'aws-cdk-lib/aws-opensearchservice'
import { CdkTarponAlarmsStack } from './cdk-tarpon-nested-stacks/cdk-tarpon-alarms-stack'
import { CdkTarponConsoleLambdaStack } from './cdk-tarpon-nested-stacks/cdk-tarpon-console-api-stack'
import { createApiGateway } from './cdk-utils/cdk-apigateway-utils'
import {
  createAPIGatewayThrottlingAlarm,
  createFinCENSTFPConnectionAlarm,
} from './cdk-utils/cdk-cw-alarms-utils'
import { createFunction } from './cdk-utils/cdk-lambda-utils'
import { createCanary } from './cdk-utils/cdk-synthetics-utils'
import {
  addFargateContainer,
  createDockerImage,
  createFargateTaskDefinition,
} from './cdk-utils/cdk-fargate-utils'
import { CdkBudgetStack } from './cdk-tarpon-nested-stacks/cdk-budgets-stack'
import { CdkTarponPythonStack } from './cdk-tarpon-nested-stacks/cdk-tarpon-python-stack'
import { createTransactionFunctionPerformanceDashboard } from './dashboards/public-api-transaction-function'
import { createVpcLogGroup } from './cdk-utils/cdk-log-group-utils'
import { envIs, envIsNot } from '@/utils/env'

const DEFAULT_SQS_VISIBILITY_TIMEOUT = Duration.seconds(
  DEFAULT_LAMBDA_TIMEOUT_SECONDS * 6
)
const CONSUMER_SQS_VISIBILITY_TIMEOUT = Duration.seconds(
  DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS * 2
)

// SQS max receive count cannot go above 1000
const MAX_SQS_RECEIVE_COUNT = 1000
const isDevUserStack = isQaEnv()
const enableFargateBatchJob = false
const FEATURE = 'feature'

const FEATURES = {
  MONGO_DB_CONSUMER: 'mongo-db-consumer',
  DYNAMO_DB_CONSUMER: 'dynamo-db-consumer',
}

// TODO make this equal to !isQaEnv before merge
const deployKinesisConsumer = !isQaEnv()

export class CdkTarponStack extends cdk.Stack {
  config: Config
  zendutyCloudWatchTopic: Topic
  functionProps: Partial<FunctionProps>
  sqsInterfaceVpcEndpoint?: InterfaceVpcEndpoint | null

  private addTagsToResource(
    resource: IConstruct,
    tags: Record<string, string>
  ) {
    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(resource).add(key, value)
    })
  }

  constructor(scope: Construct, id: string, config: Config) {
    super(scope, id, {
      env: config.env,
    })
    this.config = config

    /**
     * SQS & SNS
     */

    const ZendutyCloudWatchTopic = new Topic(
      this,
      StackConstants.ZENDUTY_CLOUD_WATCH_TOPIC_NAME,
      {
        displayName: StackConstants.ZENDUTY_CLOUD_WATCH_TOPIC_NAME,
        topicName: StackConstants.ZENDUTY_CLOUD_WATCH_TOPIC_NAME,
      }
    )
    this.zendutyCloudWatchTopic = ZendutyCloudWatchTopic

    new Subscription(this, StackConstants.ZENDUTY_SUBSCRIPTION_NAME, {
      topic: this.zendutyCloudWatchTopic,
      endpoint: config.application.ZENDUTY_WEBHOOK_URL
        ? config.application.ZENDUTY_WEBHOOK_URL
        : '',
      protocol: SubscriptionProtocol.HTTPS,
    })

    const actionProcessingQueue = this.createQueue(
      SQSQueues.ACTION_PROCESSING_QUEUE_NAME.name,
      {
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
        retentionPeriod: Duration.days(7),
      }
    )
    const slackAlertQueue = this.createQueue(
      SQSQueues.SLACK_ALERT_QUEUE_NAME.name,
      {
        visibilityTimeout: DEFAULT_SQS_VISIBILITY_TIMEOUT,
      }
    )
    const webhookDeliveryQueue = this.createQueue(
      SQSQueues.WEBHOOK_DELIVERY_QUEUE_NAME.name,
      {
        visibilityTimeout: DEFAULT_SQS_VISIBILITY_TIMEOUT,
        maxReceiveCount:
          Duration.days(5).toSeconds() /
          DEFAULT_SQS_VISIBILITY_TIMEOUT.toSeconds(),
        retentionPeriod: Duration.days(7),
      }
    )
    const transactionAggregationQueue = this.createQueue(
      SQSQueues.TRANSACTION_AGGREGATION_QUEUE_NAME.name,
      {
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
        fifo: true,
        retentionPeriod: Duration.days(7),
      }
    )

    const auditLogTopic = new Topic(this, StackConstants.AUDIT_LOG_TOPIC_NAME, {
      displayName: StackConstants.AUDIT_LOG_TOPIC_NAME,
      topicName: StackConstants.AUDIT_LOG_TOPIC_NAME,
    })
    const auditLogQueue = this.createQueue(
      SQSQueues.AUDIT_LOG_QUEUE_NAME.name,
      {
        maxReceiveCount: MAX_SQS_RECEIVE_COUNT,
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
        retentionPeriod: Duration.days(7),
      }
    )

    const notificationQueue = this.createQueue(
      SQSQueues.NOTIFICATIONS_QUEUE_NAME.name,
      {
        maxReceiveCount: 10,
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
        retentionPeriod: Duration.days(7),
      }
    )

    auditLogTopic.addSubscription(new SqsSubscription(auditLogQueue))
    auditLogTopic.addSubscription(new SqsSubscription(notificationQueue))

    const asyncRuleQueue = this.createQueue(
      SQSQueues.ASYNC_RULE_QUEUE_NAME.name,
      {
        fifo: true,
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
        retentionPeriod: Duration.days(7),
        maxReceiveCount: MAX_SQS_RECEIVE_COUNT,
      }
    )

    const secondaryAsyncRuleQueue = this.createQueue(
      SQSQueues.SecondaryAsyncRuleQueue.name,
      {
        fifo: true,
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
        retentionPeriod: Duration.days(7),
        maxReceiveCount: MAX_SQS_RECEIVE_COUNT,
      }
    )

    const batchAsyncRuleQueue = this.createQueue(
      SQSQueues.BATCH_ASYNC_RULE_QUEUE_NAME.name,
      {
        fifo: true,
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
        retentionPeriod: Duration.days(7),
        maxReceiveCount: MAX_SQS_RECEIVE_COUNT,
      }
    )

    const mongoUpdateConsumerQueue = this.createQueue(
      SQSQueues.MONGO_UPDATE_CONSUMER_QUEUE_NAME.name,
      {
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
        retentionPeriod: Duration.days(7),
        fifo: true,
        maxReceiveCount: MAX_SQS_RECEIVE_COUNT,
      }
    )

    const mongoDbConsumerQueue = this.createQueue(
      SQSQueues.MONGO_DB_CONSUMER_QUEUE_NAME.name,
      {
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
        retentionPeriod: Duration.days(7),
      }
    )

    this.addTagsToResource(mongoDbConsumerQueue, {
      [FEATURE]: FEATURES.MONGO_DB_CONSUMER,
    })

    const dynamoDbConsumerQueue = this.createQueue(
      SQSQueues.DYNAMO_DB_CONSUMER_QUEUE_NAME.name,
      {
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
        retentionPeriod: Duration.days(7),
      }
    )

    this.addTagsToResource(dynamoDbConsumerQueue, {
      [FEATURE]: FEATURES.DYNAMO_DB_CONSUMER,
    })

    const batchJobQueue = this.createQueue(
      SQSQueues.BATCH_JOB_QUEUE_NAME.name,
      {
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
        retentionPeriod: Duration.days(7),
      }
    )

    const requestLoggerQueue = this.createQueue(
      SQSQueues.REQUEST_LOGGER_QUEUE_NAME.name,
      {
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
        maxReceiveCount: MAX_SQS_RECEIVE_COUNT,
      }
    )

    const tarponEventQueue = this.createQueue(
      SQSQueues.TARPON_QUEUE_NAME.name,
      {
        fifo: true,
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
        maxReceiveCount: MAX_SQS_RECEIVE_COUNT,
      }
    )

    const downstreamTarponEventQueue = this.createQueue(
      SQSQueues.DOWNSTREAM_TARPON_QUEUE_NAME.name,
      {
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
        maxReceiveCount: MAX_SQS_RECEIVE_COUNT,
      }
    )

    const secondaryTarponEventQueue = this.createQueue(
      SQSQueues.SECONDARY_TARPON_QUEUE_NAME.name,
      {
        fifo: true,
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
        maxReceiveCount: MAX_SQS_RECEIVE_COUNT,
      }
    )

    const batchRerunUsersQueue = this.createQueue(
      SQSQueues.BATCH_RERUN_USERS_QUEUE_NAME.name,
      {
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
        retentionPeriod: Duration.days(14),
      }
    )

    const downstreamSecondaryTarponEventQueue = this.createQueue(
      SQSQueues.DOWNSTREAM_SECONDARY_TARPON_QUEUE_NAME.name,
      {
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
        maxReceiveCount: MAX_SQS_RECEIVE_COUNT,
        retentionPeriod: Duration.days(14),
      }
    )

    /*
     * Kinesis Data Streams
     */
    const tarponStream = this.createKinesisStream(
      StackConstants.TARPON_STREAM_ID,
      StackConstants.TARPON_STREAM_NAME,
      Duration.days(7)
    )

    /**
     * DynamoDB
     */
    this.createDynamodbTable(
      DYNAMODB_TABLE_NAMES.TARPON,
      tarponStream,
      true,
      true
    )
    this.createDynamodbTable(
      DYNAMODB_TABLE_NAMES.TARPON_RULE,
      undefined,
      undefined,
      true
    )
    this.createDynamodbTable(
      DYNAMODB_TABLE_NAMES.HAMMERHEAD,
      tarponStream,
      undefined,
      true
    )
    this.createDynamodbTable(
      DYNAMODB_TABLE_NAMES.TRANSIENT,
      undefined,
      true,
      true
    )
    // Currently only creating for eu-2
    if (config.region === 'eu-2' && envIs('prod')) {
      this.createDynamodbTable(
        DYNAMODB_TABLE_NAMES.AGGREGATION,
        undefined,
        true,
        true
      )
    }

    const siloTables: ITable[] = []

    for (const tenantId of siloDataTenants?.[config.stage]?.[
      config.region ?? 'eu-1'
    ] || []) {
      const siloTarponTable = this.createDynamodbTable(
        StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
        tarponStream,
        true,
        true
      )

      const siloHammerheadTable = this.createDynamodbTable(
        StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(tenantId),
        tarponStream,
        undefined,
        true
      )

      siloTables.push(siloTarponTable, siloHammerheadTable)
    }

    /*
     * MongoDB Atlas DB
     * VPC configuration: https://www.mongodb.com/docs/atlas/security-vpc-peering/
     */

    const { vpc, vpcCidr, securityGroup, clickhouseSecurityGroup } =
      this.createMongoAtlasVpc()

    /**
     * S3 Buckets
     * NOTE: Bucket name needs to be unique across accounts. We append account ID to the
     * logical bucket name.
     */

    let s3TmpBucket

    const s3BucketCors = [
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
    ]
    const importBucketName = getNameForGlobalResource(
      StackConstants.S3_IMPORT_BUCKET_PREFIX,
      config
    )
    const documentBucketName = getNameForGlobalResource(
      StackConstants.S3_DOCUMENT_BUCKET_PREFIX,
      config
    )
    const tmpBucketName = getNameForGlobalResource(
      StackConstants.S3_TMP_BUCKET_PREFIX,
      config
    )
    const s3demoModeBucketName = getNameForGlobalResource(
      StackConstants.S3_DEMO_MODE_BUCKET_NAME,
      config
    )
    const sharedAssetsBucketName = getNameForGlobalResource(
      StackConstants.S3_SHARED_ASSETS_PREFIX,
      config
    )
    const serverAccessLogBucketName = getNameForGlobalResource(
      StackConstants.S3_SERVER_ACCESS_LOGS_BUCKET_NAME,
      config
    )
    if (!isDevUserStack) {
      const serverAccessLogBucket = new Bucket(
        this,
        serverAccessLogBucketName,
        {
          bucketName: serverAccessLogBucketName,
          cors: s3BucketCors,
          blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
          removalPolicy:
            config.stage === 'dev'
              ? RemovalPolicy.DESTROY
              : RemovalPolicy.RETAIN,
          autoDeleteObjects: config.stage === 'dev',
          encryption: BucketEncryption.S3_MANAGED,
        }
      )

      new Bucket(this, importBucketName, {
        bucketName: importBucketName,
        cors: s3BucketCors,
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        removalPolicy:
          config.stage === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
        autoDeleteObjects: config.stage === 'dev',
        encryption: BucketEncryption.S3_MANAGED,
        serverAccessLogsBucket: serverAccessLogBucket,
        serverAccessLogsPrefix: `tarpon/${importBucketName}`,
      })

      new Bucket(this, documentBucketName, {
        bucketName: documentBucketName,
        cors: s3BucketCors,
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        removalPolicy:
          config.stage === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
        autoDeleteObjects: config.stage === 'dev',
        encryption: BucketEncryption.S3_MANAGED,
        serverAccessLogsBucket: serverAccessLogBucket,
        serverAccessLogsPrefix: `tarpon/${documentBucketName}`,
      })

      s3TmpBucket = new Bucket(this, tmpBucketName, {
        bucketName: tmpBucketName,
        cors: s3BucketCors,
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        removalPolicy:
          config.stage === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
        autoDeleteObjects: config.stage === 'dev',
        encryption: BucketEncryption.S3_MANAGED,
        lifecycleRules: [
          {
            abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
            expiration: cdk.Duration.days(1),
          },
        ],
        serverAccessLogsBucket: serverAccessLogBucket,
        serverAccessLogsPrefix: `tarpon/${tmpBucketName}`,
      })

      new Bucket(this, s3demoModeBucketName, {
        bucketName: s3demoModeBucketName,
        cors: s3BucketCors,
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        removalPolicy:
          config.stage === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
        encryption: BucketEncryption.S3_MANAGED,
        serverAccessLogsBucket: serverAccessLogBucket,
        serverAccessLogsPrefix: `tarpon/${s3demoModeBucketName}`,
      })

      new Bucket(this, sharedAssetsBucketName, {
        bucketName: sharedAssetsBucketName,
        cors: s3BucketCors,
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        removalPolicy:
          config.stage === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
        encryption: BucketEncryption.S3_MANAGED,
        serverAccessLogsBucket: serverAccessLogBucket,
        serverAccessLogsPrefix: `tarpon/${sharedAssetsBucketName}`,
      })

      this.createMalwareProtectionPlanForS3Bucket(s3TmpBucket)
    } else {
      Bucket.fromBucketName(this, importBucketName, importBucketName)
      Bucket.fromBucketName(this, documentBucketName, documentBucketName)
      s3TmpBucket = Bucket.fromBucketName(this, tmpBucketName, tmpBucketName)
      Bucket.fromBucketName(this, s3demoModeBucketName, s3demoModeBucketName)
      Bucket.fromBucketName(
        this,
        sharedAssetsBucketName,
        sharedAssetsBucketName
      )
    }

    /**
     * Lambda Functions
     */

    this.functionProps = {
      securityGroups: this.config.resource.LAMBDA_VPC_ENABLED
        ? [securityGroup, clickhouseSecurityGroup]
        : undefined,
      vpc: this.config.resource.LAMBDA_VPC_ENABLED ? vpc : undefined,
      environment: {
        DOCUMENT_BUCKET: documentBucketName,
        IMPORT_BUCKET: importBucketName,
        TMP_BUCKET: tmpBucketName,
        SHARED_ASSETS_BUCKET: sharedAssetsBucketName,
        WEBHOOK_DELIVERY_QUEUE_URL: webhookDeliveryQueue.queueUrl,
        TRANSACTION_AGGREGATION_QUEUE_URL: transactionAggregationQueue.queueUrl,
        SLACK_ALERT_QUEUE_URL: slackAlertQueue.queueUrl,
        REQUEST_LOGGER_QUEUE_URL: requestLoggerQueue.queueUrl,
        AUDITLOG_TOPIC_ARN: auditLogTopic?.topicArn,
        BATCH_JOB_QUEUE_URL: batchJobQueue?.queueUrl,
        TARPON_QUEUE_URL: tarponEventQueue.queueUrl,
        SECONDARY_TARPON_QUEUE_URL: secondaryTarponEventQueue.queueUrl,
        DOWNSTREAM_TARPON_QUEUE_URL: downstreamTarponEventQueue.queueUrl,
        DOWNSTREAM_SECONDARY_TARPON_QUEUE_URL:
          downstreamSecondaryTarponEventQueue.queueUrl,
        ASYNC_RULE_QUEUE_URL: asyncRuleQueue.queueUrl,
        BATCH_ASYNC_RULE_QUEUE_URL: batchAsyncRuleQueue.queueUrl,
        SECONDARY_ASYNC_RULE_QUEUE_URL: secondaryAsyncRuleQueue.queueUrl,
        MONGO_DB_CONSUMER_QUEUE_URL: mongoDbConsumerQueue.queueUrl,
        DYNAMO_DB_CONSUMER_QUEUE_URL: dynamoDbConsumerQueue.queueUrl,
        MONGO_UPDATE_CONSUMER_QUEUE_URL: mongoUpdateConsumerQueue.queueUrl,
        ACTION_PROCESSING_QUEUE_URL: actionProcessingQueue.queueUrl,
        BATCH_RERUN_USERS_QUEUE_URL: batchRerunUsersQueue.queueUrl,
      },
    }

    let lambdaRoleName = `flagrightLambdaExecutionRole${getSuffix()}`
    let lambdaRoleWithLogsListingName = `flagrightLambdaExecutionRoleWithLogsListing${getSuffix()}`
    let ecsRoleName = `flagrightEcsTaskExecutionRole${getSuffix()}`

    // On production the role name was set without a suffix, it's dangerous for us
    // to change without downtime.
    if (
      (this.config.stage === 'prod' && config.region !== 'asia-2') ||
      (this.config.stage === 'sandbox' && config.region !== 'eu-1')
    ) {
      lambdaRoleName += `-${config.region}`
      ecsRoleName += `-${config.region}`
      lambdaRoleWithLogsListingName += `-${config.region}`
    }

    const managedPolicies = [
      ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSLambdaVPCAccessExecutionRole'
      ),
      ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSLambdaBasicExecutionRole'
      ),
      ManagedPolicy.fromAwsManagedPolicyName(
        'CloudWatchLambdaInsightsExecutionRolePolicy'
      ),
    ]

    const lambdaExecutionRole = new Role(this, `lambda-role`, {
      roleName: lambdaRoleName,
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies,
    })

    const lambdaExecutionRoleWithLogsListing = new Role(
      this,
      `lambda-role-with-logs-listing`,
      {
        roleName: lambdaRoleWithLogsListingName,
        assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies,
      }
    )

    const ecsTaskExecutionRole = new Role(this, `ecs-role`, {
      roleName: ecsRoleName,
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonECSTaskExecutionRolePolicy'
        ),
      ],
    })

    const policy = new Policy(this, id, {
      policyName: `${lambdaExecutionRole.roleName}-MongoDbPolicy`,
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['secretsmanager:*'],
          resources: ['*'],
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['dynamodb:*'],
          resources: ['*'],
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['athena:*'],
          resources: ['*'],
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['glue:*'],
          resources: ['*'],
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['sqs:*'],
          resources: [
            auditLogQueue.queueArn,
            batchJobQueue.queueArn,
            webhookDeliveryQueue.queueArn,
            slackAlertQueue.queueArn,
            transactionAggregationQueue.queueArn,
            requestLoggerQueue.queueArn,
            notificationQueue.queueArn,
            tarponEventQueue.queueArn,
            secondaryTarponEventQueue.queueArn,
            downstreamTarponEventQueue.queueArn,
            downstreamSecondaryTarponEventQueue.queueArn,
            asyncRuleQueue.queueArn,
            secondaryAsyncRuleQueue.queueArn,
            batchAsyncRuleQueue.queueArn,
            mongoDbConsumerQueue.queueArn,
            mongoUpdateConsumerQueue.queueArn,
            actionProcessingQueue.queueArn,
            dynamoDbConsumerQueue.queueArn,
            batchRerunUsersQueue.queueArn,
          ],
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['sns:Publish'],
          resources: [auditLogTopic.topicArn],
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            's3:GetBucket*',
            's3:GetObject*',
            's3:List*',
            's3:PutObject',
            's3:PutObjectAcl',
            's3:DeleteObject',
            's3:DeleteObjectVersion',
          ],
          resources: ['*'],
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['apigateway:GET', 'apigateway:PATCH'],
          resources: ['*'],
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['states:StartExecution'],
          resources: ['*'],
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['ecs:*'],
          resources: ['*'],
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['states:*'],
          resources: ['*'],
        }),

        // TODO remove after initial deployment
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['sts:AssumeRole'],
          resources: ['*'],
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['lambda:InvokeFunction'],
          resources: ['*'],
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            'es:ESHttpGet',
            'es:ESHttpPost',
            'es:ESHttpPut',
            'es:ESHttpDelete',
            'es:ESHttpHead',
            'es:ESHttpPatch',
            'es:DescribeDomains',
            'es:DescribeElasticsearchDomains',
          ],
          resources: ['*'],
        }),
      ],
    })
    const logListingPolicy = new Policy(this, `${id}-${this.config.stage}`, {
      policyName: `${lambdaExecutionRoleWithLogsListing.roleName}-LogListingPolicy`,
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['logs:DescribeLogGroups', 'logs:DeleteLogGroup'],
          resources: ['*'],
        }),
      ],
    })

    // Give role access to all secrets
    lambdaExecutionRole.attachInlinePolicy(policy)
    lambdaExecutionRoleWithLogsListing.attachInlinePolicy(policy)
    lambdaExecutionRoleWithLogsListing.attachInlinePolicy(logListingPolicy)
    ecsTaskExecutionRole.attachInlinePolicy(policy)
    this.createOpensearchService(vpc, lambdaExecutionRole, ecsTaskExecutionRole)

    this.createDynamoDbVpcEndpoint(vpc)
    this.createS3VpcEndpoint(vpc)
    this.sqsInterfaceVpcEndpoint = this.createSqsInterfaceVpcEndpoint(
      vpc,
      vpcCidr
    )

    Metric.grantPutMetricData(lambdaExecutionRole)
    Metric.grantPutMetricData(lambdaExecutionRoleWithLogsListing)
    Metric.grantPutMetricData(ecsTaskExecutionRole)

    const heavyLibLayer = new LayerVersion(this, 'heavy-libs', {
      code: Code.fromAsset('dist/layers/heavy-libs'),
      compatibleRuntimes: [Runtime.NODEJS_20_X],
      layerVersionName: 'heavy-libs-layer',
    })

    /* API Key Authorizer */
    const { alias: apiKeyAuthorizerAlias, func: apiKeyAuthorizerFunction } =
      createFunction(
        this,
        lambdaExecutionRole,
        {
          name: StackConstants.API_KEY_AUTHORIZER_FUNCTION_NAME,
          provisionedConcurrency:
            config.resource.API_KEY_AUTHORIZER_LAMBDA.PROVISIONED_CONCURRENCY,
        },
        heavyLibLayer
      )

    /* Transaction and Transaction Event */
    const transactionFunctionProps = {
      provisionedConcurrency:
        config.resource.TRANSACTION_LAMBDA.MAX_PROVISIONED_CONCURRENCY,
      memorySize: config.resource.TRANSACTION_LAMBDA.MEMORY_SIZE,
    }

    const { alias: transactionAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.PUBLIC_API_TRANSACTION_FUNCTION_NAME,
        ...transactionFunctionProps,
      },
      heavyLibLayer
    )
    const { alias: transactionEventAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.PUBLIC_API_TRANSACTION_EVENT_FUNCTION_NAME,
        ...transactionFunctionProps,
      },
      heavyLibLayer
    )

    // Configure AutoScaling for Tx Function
    const txAutoScaling = {
      minCapacity:
        config.resource.TRANSACTION_LAMBDA.MIN_PROVISIONED_CONCURRENCY,
      maxCapacity:
        config.resource.TRANSACTION_LAMBDA.MAX_PROVISIONED_CONCURRENCY,
    }

    transactionAlias.addAutoScaling(txAutoScaling).scaleOnUtilization({
      utilizationTarget: config.region === 'eu-2' ? 0.2 : 0.5,
    })
    transactionEventAlias.addAutoScaling(txAutoScaling).scaleOnUtilization({
      utilizationTarget: config.region === 'eu-2' ? 0.2 : 0.5,
    })

    /*  User Event */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.PUBLIC_API_USER_EVENT_FUNCTION_NAME,
        provisionedConcurrency:
          config.resource.USER_LAMBDA.PROVISIONED_CONCURRENCY,
        memorySize: config.resource.USER_LAMBDA.MEMORY_SIZE,
      },
      heavyLibLayer
    )

    /* Rule Template (Public) */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.PUBLIC_MANAGEMENT_API_RULE_FUNCTION_NAME,
      },
      heavyLibLayer
    )

    /* Lists Function (Public) */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.PUBLIC_MANAGEMENT_API_LISTS_FUNCTION_NAME,
      },
      heavyLibLayer
    )

    /* Rule Instance (Public) */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.PUBLIC_MANAGEMENT_API_RULE_INSTANCE_FUNCTION_NAME,
      },
      heavyLibLayer
    )

    /* Case (Public) */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.PUBLIC_MANAGEMENT_API_CASE_FUNCTION_NAME,
      },
      heavyLibLayer
    )

    /* Alert (Public) */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.PUBLIC_MANAGEMENT_API_ALERT_FUNCTION_NAME,
      },
      heavyLibLayer
    )

    /* Upload file (Public) */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.PUBLIC_MANAGEMENT_API_FILE_UPLOAD_FUNCTION_NAME,
      },
      heavyLibLayer
    )

    /* User (Public) */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.PUBLIC_MANAGEMENT_API_USER_FUNCTION_NAME,
      },
      heavyLibLayer
    )

    /* User */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.PUBLIC_API_USER_FUNCTION_NAME,
        provisionedConcurrency:
          config.resource.USER_LAMBDA.PROVISIONED_CONCURRENCY,
        memorySize: config.resource.USER_LAMBDA.MEMORY_SIZE,
      },
      heavyLibLayer
    )

    /* Slack App */
    const { alias: slackAlertAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.SLACK_ALERT_FUNCTION_NAME,
      },
      heavyLibLayer
    )

    slackAlertAlias.addEventSource(
      // We set batch size to 1 then in case of error, we don't resend the already-sent alerts
      new SqsEventSource(slackAlertQueue, { batchSize: 1 })
    )

    /* Webhook */
    const { alias: webhookDelivererAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.WEBHOOK_DELIVERER_FUNCTION_NAME,
      },
      heavyLibLayer
    )

    webhookDelivererAlias.addEventSource(
      new SqsEventSource(webhookDeliveryQueue, { batchSize: 1 })
    )

    /* Async Rule */
    const { alias: asyncRuleAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.ASYNC_RULE_RUNNER_FUNCTION_NAME,
        memorySize: config.resource.ASYNC_RULES_LAMBDA?.MEMORY_SIZE,
      },
      heavyLibLayer
    )

    const { alias: secondaryAsyncRule } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.SECONDARY_ASYNC_RULE_RUNNER_FUNCTION_NAME,
        memorySize: config.resource.ASYNC_RULES_LAMBDA?.MEMORY_SIZE,
      },
      heavyLibLayer
    )

    // non-batch async rule
    asyncRuleAlias.addEventSource(
      new SqsEventSource(asyncRuleQueue, { maxConcurrency: 200, batchSize: 10 })
    )

    // batch async rule
    asyncRuleAlias.addEventSource(
      new SqsEventSource(batchAsyncRuleQueue, {
        maxConcurrency: 100,
        batchSize: 10,
      })
    )
    secondaryAsyncRule.addEventSource(
      new SqsEventSource(secondaryAsyncRuleQueue, {
        maxConcurrency: 5,
        batchSize: 1,
      })
    )

    /* Mongo Update */
    const { alias: mongoUpdateConsumerAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.MONGO_UPDATE_CONSUMER_FUNCTION_NAME,
      },
      heavyLibLayer
    )

    mongoUpdateConsumerAlias.addEventSource(
      new SqsEventSource(mongoUpdateConsumerQueue, {
        batchSize: 10,
        maxConcurrency: 100,
      })
    )

    /* Transaction Aggregation */
    const { alias: transactionAggregatorAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.TRANSACTION_AGGREGATION_FUNCTION_NAME,
        memorySize:
          this.config.resource.TRANSACTION_AGGREGATION_LAMBDA?.MEMORY_SIZE,
      },
      heavyLibLayer
    )

    transactionAggregatorAlias.addEventSource(
      new SqsEventSource(transactionAggregationQueue, {
        batchSize: 1,
        maxConcurrency:
          this.config.resource.TRANSACTION_AGGREGATION_MAX_CONCURRENCY,
      })
    )

    /* Request Logger */
    const { alias: requestLoggerAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.REQUEST_LOGGER_FUNCTION_NAME,
        memorySize:
          this.config.resource.REQUEST_LOGGER_LAMBDA?.MEMORY_SIZE ?? 512,
      },
      heavyLibLayer
    )

    requestLoggerAlias.addEventSource(
      new SqsEventSource(requestLoggerQueue, {
        batchSize: this.config.resource.REQUEST_LOGGER_LAMBDA?.BATCH_SIZE ?? 50,
        maxConcurrency:
          this.config.resource.REQUEST_LOGGER_LAMBDA?.PROVISIONED_CONCURRENCY ??
          5,
        maxBatchingWindow: Duration.minutes(5),
      })
    )

    /* Batch Rerun Users */
    const { alias: batchRerunUsersConsumerAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.BATCH_RERUN_USERS_CONSUMER_FUNCTION_NAME,
        memorySize: config.resource.LAMBDA_DEFAULT?.MEMORY_SIZE,
      },
      heavyLibLayer
    )

    batchRerunUsersConsumerAlias.addEventSource(
      new SqsEventSource(batchRerunUsersQueue, {
        batchSize: 100,
        maxConcurrency: 100,
        maxBatchingWindow: Duration.minutes(5),
      })
    )

    /* Audit Log */
    const { alias: auditLogConsumerAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.AUDIT_LOG_CONSUMER_FUNCTION_NAME,
      },
      heavyLibLayer
    )
    auditLogConsumerAlias.addEventSource(new SqsEventSource(auditLogQueue))

    /* Notification */
    const { alias: notificationsConsumerAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.NOTIFICATIONS_CONSUMER_FUNCTION_NAME,
      },
      heavyLibLayer
    )

    notificationsConsumerAlias.addEventSource(
      new SqsEventSource(notificationQueue, {
        maxConcurrency: 5,
      })
    )

    /* Action Processing */

    const { alias: actionProcessingFunction } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.ACTION_PROCESSING_FUNCTION_NAME,
      },
      heavyLibLayer
    )

    actionProcessingFunction.addEventSource(
      new SqsEventSource(actionProcessingQueue, {
        reportBatchItemFailures: true,
        batchSize: 20,
        maxBatchingWindow: Duration.seconds(2),
      })
    )

    /* Batch Job */
    const { alias: jobDecisionAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.BATCH_JOB_DECISION_FUNCTION_NAME,
      },
      heavyLibLayer
    )
    // batch job runner lambda has permission to describe and delete log groups - qa cleanup job required this
    const { alias: jobRunnerAlias, func: batchJobRunnerHandler } =
      createFunction(
        this,
        lambdaExecutionRoleWithLogsListing,
        {
          name: StackConstants.BATCH_JOB_RUNNER_FUNCTION_NAME,
          memorySize:
            config.resource.BATCH_JOB_LAMBDA?.MEMORY_SIZE ??
            config.resource.LAMBDA_DEFAULT.MEMORY_SIZE,
        },
        heavyLibLayer
      )
    const batchJobRunnerLogGroupName = batchJobRunnerHandler.logGroup
    createFinCENSTFPConnectionAlarm(
      this,
      this.zendutyCloudWatchTopic,
      batchJobRunnerLogGroupName,
      StackConstants.CONSOLE_API_FINCEN_SFTP_CONNECTION_ERROR_ALARM_NAME +
        'Alarm',
      StackConstants.CONSOLE_API_FINCEN_SFTP_CONNECTION_ERROR_ALARM_NAME +
        'Metric'
    )
    let ecsBatchJobTask: Chain | null = null
    if (!isQaEnv() || enableFargateBatchJob) {
      const fargateBatchJobTaskDefinition = createFargateTaskDefinition(
        this,
        StackConstants.FARGATE_BATCH_JOB_TASK_DEFINITION_NAME,
        {
          role: ecsTaskExecutionRole,
          cpu: config.resource.FARGATE_BATCH_JOB_CONTAINER.CPU,
          memoryLimitMiB:
            config.resource.FARGATE_BATCH_JOB_CONTAINER.MEMORY_LIMIT,
          architecture:
            config.resource.FARGATE_BATCH_JOB_CONTAINER.ARCHITECTURE ??
            'x86_64',
        }
      )

      const image = createDockerImage(
        this,
        StackConstants.FARGATE_BATCH_JOB_CONTAINER_NAME,
        {
          path:
            process.env.INFRA_CI === 'true' ? 'src/fargate' : 'dist/fargate',
          architecture:
            config.resource.FARGATE_BATCH_JOB_CONTAINER.ARCHITECTURE ??
            'x86_64',
        }
      )

      const fargateBatchJobContainer = addFargateContainer(
        this,
        StackConstants.FARGATE_BATCH_JOB_CONTAINER_NAME,
        fargateBatchJobTaskDefinition,
        {
          memoryLimitMiB:
            config.resource.FARGATE_BATCH_JOB_CONTAINER.MEMORY_LIMIT,
          image: ContainerImage.fromDockerImageAsset(image),
          architecture:
            config.resource.FARGATE_BATCH_JOB_CONTAINER.ARCHITECTURE ??
            'x86_64',
        }
      )
      const batchJobCluster = new Cluster(
        this,
        StackConstants.FARGATE_BATCH_JOB_CLUSTER_NAME,
        { vpc }
      )
      const ecsSecurityGroups = this.config.resource.LAMBDA_VPC_ENABLED
        ? [securityGroup, clickhouseSecurityGroup].filter(
            (sg): sg is SecurityGroup => Boolean(sg)
          )
        : undefined
      const ecsSubnetSelection = this.config.resource.LAMBDA_VPC_ENABLED
        ? { subnetType: SubnetType.PRIVATE_WITH_EGRESS }
        : undefined
      ecsBatchJobTask = new EcsRunTask(
        this,
        getResourceNameForTarpon('BatchJobFargateRunner'),
        {
          cluster: batchJobCluster,
          taskDefinition: fargateBatchJobTaskDefinition,
          launchTarget: new EcsFargateLaunchTarget({
            platformVersion: FargatePlatformVersion.LATEST,
          }),
          assignPublicIp: false,
          securityGroups:
            ecsSecurityGroups && ecsSecurityGroups.length > 0
              ? ecsSecurityGroups
              : undefined,
          subnets: ecsSubnetSelection,
          inputPath: `$.Payload.${BATCH_JOB_PAYLOAD_RESULT_KEY}`,
          integrationPattern: IntegrationPattern.RUN_JOB,
          containerOverrides: [
            {
              containerDefinition: fargateBatchJobContainer,
              environment: [
                {
                  name: BATCH_JOB_ID_ENV_VAR,
                  value: JsonPath.stringAt('$.jobId'),
                },
                {
                  name: BATCH_JOB_TENANT_ID_ENV_VAR,
                  value: JsonPath.stringAt('$.tenantId'),
                },
              ],
              command: ['node', 'index.js'],
            },
          ],
        }
      )
        .addRetry({
          interval: Duration.seconds(30),
          maxDelay: Duration.hours(3),
          maxAttempts: 3,
          jitterStrategy: JitterType.FULL,
        })
        .next(
          new Succeed(
            this,
            getResourceNameForTarpon('BatchJobRunSucceedFargate')
          )
        )
    }

    const batchJobStateMachine = new StateMachine(
      this,
      StackConstants.BATCH_JOB_STATE_MACHINE_NAME,
      {
        definition: new LambdaInvoke(
          this,
          getResourceNameForTarpon('BatchJobDecisionLambda'),
          {
            lambdaFunction: jobDecisionAlias,
          }
        ).next(
          new Choice(this, getResourceNameForTarpon('BatchJobRunTypeChoice'))
            .when(
              Condition.stringEquals(
                `$.Payload.${BATCH_JOB_RUN_TYPE_RESULT_KEY}`,
                LAMBDA_BATCH_JOB_RUN_TYPE
              ),
              new LambdaInvoke(
                this,
                getResourceNameForTarpon('BatchJobLambdaRunner'),
                {
                  lambdaFunction: jobRunnerAlias,
                  inputPath: `$.Payload.${BATCH_JOB_PAYLOAD_RESULT_KEY}`,
                }
              )
                .addRetry({
                  interval: Duration.seconds(30),
                  maxDelay: Duration.hours(1),
                  maxAttempts: 3,
                  jitterStrategy: JitterType.FULL,
                })
                .next(
                  new Succeed(
                    this,
                    getResourceNameForTarpon('BatchJobRunSucceedLambda')
                  )
                )
            )
            .when(
              Condition.stringEquals(
                `$.Payload.${BATCH_JOB_RUN_TYPE_RESULT_KEY}`,
                FARGATE_BATCH_JOB_RUN_TYPE
              ),
              ecsBatchJobTask ??
                new Succeed(
                  this,
                  getResourceNameForTarpon('DummyBatchJobRunSucceedFargate')
                )
            )
        ),
      }
    )

    const { alias: jobTriggerConsumerAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.BATCH_JOB_TRIGGER_CONSUMER_FUNCTION_NAME,
      },
      heavyLibLayer,
      {
        environment: {
          BATCH_JOB_STATE_MACHINE_ARN: batchJobStateMachine.stateMachineArn,
        },
      }
    )
    jobTriggerConsumerAlias.addEventSource(
      new SqsEventSource(batchJobQueue, { maxConcurrency: 100 })
    )

    /* Cron jobs */
    if (!isDevUserStack) {
      // Monthly
      const { func: cronJobMonthlyHandler } = createFunction(
        this,
        lambdaExecutionRole,
        {
          name: StackConstants.CRON_JOB_MONTHLY,
        },
        heavyLibLayer
      )
      const monthlyRule = new Rule(
        this,
        getResourceNameForTarpon('MonthlyRule'),
        { schedule: Schedule.cron({ minute: '0', hour: '0', day: '1' }) }
      )
      monthlyRule.addTarget(new LambdaFunctionTarget(cronJobMonthlyHandler))

      // Daily
      const { func: cronJobDailyHandler } = createFunction(
        this,
        lambdaExecutionRole,
        {
          name: StackConstants.CRON_JOB_DAILY,

          memorySize: config.resource.CRON_JOB_LAMBDA?.MEMORY_SIZE,
        },
        heavyLibLayer
      )
      if (envIs('dev')) {
        // For cleaning up QA stacks
        cronJobDailyHandler.role?.attachInlinePolicy(
          new Policy(
            this,
            getResourceNameForTarpon('CronJobDailyFunctionPolicy'),
            {
              policyName: getResourceNameForTarpon(
                'CronJobDailyFunctionPolicy'
              ),
              statements: [
                new PolicyStatement({
                  effect: Effect.ALLOW,
                  actions: ['cloudformation:*'],
                  resources: ['*'],
                }),
              ],
            }
          )
        )
      }

      let triggerHour: string = '20'
      let triggerMinute: string = '0'

      if (envIs('prod') && config.region) {
        const triggerTime: Record<FlagrightRegion, Record<string, string>> = {
          'eu-1': { hour: '22', minute: '15' }, // 10:15 PM UTC
          'eu-2': { hour: '00', minute: '15' }, // 12:00 AM UTC
          'asia-2': { hour: '18', minute: '45' }, // 06:45 PM UTC
          'au-1': { hour: '14', minute: '15' }, // 10:15 PM UTC
          'us-1': { hour: '07', minute: '15' }, // 07:15 AM UTC
          'me-1': { hour: '20', minute: '15' }, // 8:15 PM UTC
          'asia-1': { hour: '16', minute: '15' }, // 11:15 PM UTC
          'asia-3': { hour: '16', minute: '30' }, // 11:30 PM UTC // Its same for asia-1 and asia-3 hence 15 minutes difference
        }

        triggerHour = triggerTime[config.region].hour
        triggerMinute = triggerTime[config.region].minute
      } else if (envIs('sandbox')) {
        triggerHour = '21'
        triggerMinute = '45'
      } else if (envIs('dev')) {
        triggerHour = '22'
        triggerMinute = '0'
      }

      const apiMetricsRule = new Rule(
        this,
        getResourceNameForTarpon('ApiMetricsRule'),
        {
          schedule: Schedule.cron({ minute: triggerMinute, hour: triggerHour }),
        }
      )
      apiMetricsRule.addTarget(new LambdaFunctionTarget(cronJobDailyHandler))

      // Every ten minutes
      const { func: cronJobTenMinuteHandler } = createFunction(
        this,
        lambdaExecutionRole,
        {
          name: StackConstants.CRON_JOB_TEN_MINUTE,

          memorySize: config.resource.CRON_JOB_LAMBDA?.MEMORY_SIZE,
        },
        heavyLibLayer
      )
      const everyTenMinuteRule = new Rule(
        this,
        getResourceNameForTarpon('EveryTenMinuteRule'),
        {
          schedule: Schedule.cron({ minute: '*/10' }),
        }
      )
      everyTenMinuteRule.addTarget(
        new LambdaFunctionTarget(cronJobTenMinuteHandler)
      )

      // Cron job hourly

      if (!isQaEnv()) {
        const { func: cronJobHourlyHandler } = createFunction(
          this,
          lambdaExecutionRole,
          { name: StackConstants.CRON_JOB_HOURLY },
          heavyLibLayer
        )

        let minute = '0'

        if (envIs('prod') && config.region) {
          const triggerTime: Record<FlagrightRegion, string> = {
            'eu-1': '0',
            'eu-2': '5',
            'asia-2': '10',
            'au-1': '15',
            'us-1': '20',
            'me-1': '25',
            'asia-1': '30',
            'asia-3': '35',
          }

          minute = triggerTime[config.region]
        } else if (envIs('sandbox')) {
          if (config.region === 'eu-1') {
            minute = '40'
          } else {
            minute = '45'
          }
        } else if (envIs('dev')) {
          minute = '50'
        }

        // Run cron job every hour on a particular minute
        const hourlyRule = new Rule(
          this,
          getResourceNameForTarpon('HourlyRule'),
          { schedule: Schedule.cron({ minute }) }
        )
        hourlyRule.addTarget(new LambdaFunctionTarget(cronJobHourlyHandler))
      }
    }

    /* Tarpon Kinesis Change capture consumer */
    if (deployKinesisConsumer) {
      // MongoDB mirror handler
      const { alias: tarponChangeCaptureKinesisConsumerAlias } = createFunction(
        this,
        lambdaExecutionRole,
        {
          name: StackConstants.TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
          memorySize:
            this.config.resource.TARPON_CHANGE_CAPTURE_LAMBDA?.MEMORY_SIZE,
        },
        heavyLibLayer
      )
      this.createKinesisEventSource(
        tarponChangeCaptureKinesisConsumerAlias,
        tarponStream,
        { startingPosition: StartingPosition.TRIM_HORIZON, batchSize: 200 }
      )

      const { alias: tarponQueueConsumerAlias } = createFunction(
        this,
        lambdaExecutionRole,
        {
          name: StackConstants.TARPON_QUEUE_CONSUMER_FUNCTION_NAME,
          memorySize:
            this.config.resource.TARPON_CHANGE_CAPTURE_LAMBDA?.MEMORY_SIZE ??
            1024,
        },
        heavyLibLayer
      )

      tarponQueueConsumerAlias.addEventSource(
        new SqsEventSource(tarponEventQueue, {
          maxConcurrency:
            this.config.resource.TARPON_CHANGE_CAPTURE_LAMBDA
              ?.PROVISIONED_CONCURRENCY ?? 100,
          batchSize: 10,
        })
      )

      tarponQueueConsumerAlias.addEventSource(
        new SqsEventSource(downstreamTarponEventQueue, {
          maxConcurrency:
            this.config.resource.TARPON_CHANGE_CAPTURE_LAMBDA
              ?.PROVISIONED_CONCURRENCY ?? 100,
          batchSize: 50,
          maxBatchingWindow: Duration.seconds(30),
        })
      )

      const { alias: secondaryTarponQueueConsumerAlias } = createFunction(
        this,
        lambdaExecutionRole,
        {
          name: StackConstants.SECONDARY_TARPON_QUEUE_CONSUMER_FUNCTION_NAME,
          memorySize:
            this.config.resource.TARPON_CHANGE_CAPTURE_LAMBDA?.MEMORY_SIZE ??
            1024,
        },
        heavyLibLayer
      )

      secondaryTarponQueueConsumerAlias.addEventSource(
        new SqsEventSource(secondaryTarponEventQueue, {
          maxConcurrency:
            this.config.resource.TARPON_CHANGE_CAPTURE_LAMBDA
              ?.PROVISIONED_CONCURRENCY ?? 100,
          batchSize: 10,
        })
      )

      secondaryTarponQueueConsumerAlias.addEventSource(
        new SqsEventSource(downstreamSecondaryTarponEventQueue, {
          maxConcurrency:
            this.config.resource.TARPON_CHANGE_CAPTURE_LAMBDA
              ?.PROVISIONED_CONCURRENCY ?? 100,
          batchSize: 100,
          maxBatchingWindow: Duration.seconds(30),
        })
      )
    }

    /**
     * API Gateway
     * Open Issue: CDK+OpenAPI proper integration - https://github.com/aws/aws-cdk/issues/1461
     */

    let domainName: DomainName | undefined
    if (this.config.stage === 'dev') {
      if (config.application.DEV_CERTIFICATE_ARN === undefined) {
        throw Error('DEV_CERTIFICATE_ARN is not defined in the config file')
      }
      const apiCert = Certificate.fromCertificateArn(
        this,
        `api-certificate`,
        config.application.DEV_CERTIFICATE_ARN
      )
      domainName = new DomainName(this, getApiDomain(config), {
        certificate: apiCert,
        domainName: getApiDomain(config),
      })

      const hostedZone = HostedZone.fromLookup(this, `zone`, {
        domainName: getBaseDomain(config),
        privateZone: false,
      })
      new CnameRecord(this, `${getApiDomain(config)}-cname`, {
        zone: hostedZone,
        recordName: getSubdomain(),
        domainName: domainName.domainNameAliasDomainName,
      })

      if (!isDevUserStack) {
        new CnameRecord(this, `${getApiDomain(config)}-devuser-cname`, {
          zone: hostedZone,
          recordName: 'login.console.' + getBaseDomain(config),
          domainName: config.application.AUTH0_CUSTOM_CNAME || '',
        })
      }
    }

    // Public API
    const { api: publicApi, logGroup: publicApiLogGroup } = createApiGateway(
      this,
      StackConstants.TARPON_API_NAME
    )

    if (domainName) {
      domainName.addBasePathMapping(publicApi, {
        basePath: '',
      })
    }

    createAPIGatewayThrottlingAlarm(
      this,
      this.zendutyCloudWatchTopic,
      publicApiLogGroup,
      StackConstants.TARPON_API_GATEWAY_THROTTLING_ALARM_NAME,
      publicApi.restApiName
    )

    // Public Console API
    const { api: publicConsoleApi, logGroup: publicConsoleApiLogGroup } =
      createApiGateway(this, StackConstants.TARPON_MANAGEMENT_API_NAME)

    if (domainName) {
      domainName.addBasePathMapping(publicConsoleApi, {
        basePath: 'management',
      })
    }

    createAPIGatewayThrottlingAlarm(
      this,
      this.zendutyCloudWatchTopic,
      publicConsoleApiLogGroup,
      StackConstants.TARPON_MANAGEMENT_API_GATEWAY_THROTTLING_ALARM_NAME,
      publicConsoleApi.restApiName
    )

    if (isDevUserStack) {
      const apiKey = ApiKey.fromApiKeyId(this, `api-key`, getQaApiKeyId())
      const postManTenantApiKey = ApiKey.fromApiKeyId(
        this,
        'postman-tenant-api-key',
        getQaIntegrationTestApiKeyId()
      )
      const qaSubdomain = process.env.QA_SUBDOMAIN as string
      const usagePlan = new UsagePlan(this, `usage-plan`, {
        name: `dev-${qaSubdomain}`,
        quota: {
          period: Period.MONTH,
          limit: 10_000,
        },
        apiStages: [
          {
            api: publicConsoleApi,
            stage: publicConsoleApi.deploymentStage,
          },
          {
            api: publicApi,
            stage: publicApi.deploymentStage,
          },
        ],
      })
      usagePlan.addApiKey(apiKey)
      usagePlan.addApiKey(postManTenantApiKey)
    }

    /**
     * IAM roles
     */
    const apiKeyAuthorizerBaseRoleName = getNameForGlobalResource(
      StackConstants.API_KEY_AUTHORIZER_BASE_ROLE_NAME,
      config
    )
    const apiKeyAuthorizerBaseRole = new Role(
      this,
      apiKeyAuthorizerBaseRoleName,
      {
        roleName: apiKeyAuthorizerBaseRoleName,
        assumedBy: new CompositePrincipal(
          new ArnPrincipal(apiKeyAuthorizerAlias.role?.roleArn as string),

          // TODO remove once deploy is finished
          new ArnPrincipal('*')
        ),
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName('PowerUserAccess'),
        ],
      }
    )

    apiKeyAuthorizerAlias.role?.attachInlinePolicy(
      new Policy(this, getResourceNameForTarpon('ApiKeyAuthorizerPolicy'), {
        policyName: getResourceNameForTarpon('ApiKeyAuthorizerPolicy'),
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['sts:AssumeRole'],
            resources: [apiKeyAuthorizerBaseRole.roleArn],
          }),
        ],
      })
    )
    apiKeyAuthorizerFunction.addEnvironment(
      'AUTHORIZER_BASE_ROLE_ARN',
      apiKeyAuthorizerBaseRole.roleArn
    )

    // Nested stacks
    if (!isDevUserStack) {
      new CdkTarponAlarmsStack(this, `${config.stage}-tarpon-alarms`, {
        config,
        batchJobStateMachineArn: batchJobStateMachine.stateMachineArn,
        zendutyCloudWatchTopic: this.zendutyCloudWatchTopic,
      })

      if (this.config.region !== 'me-1' && this.config.region !== 'asia-3') {
        new CdkBudgetStack(this, `${config.stage}-tarpon-budget`, {
          config,
        })
      }
    }

    const consoleApiStack = new CdkTarponConsoleLambdaStack(
      this,
      `${config.stage}-tarpon-console-api`,
      {
        config,
        lambdaExecutionRole,
        functionProps: this.functionProps,
        domainName,
        zendutyCloudWatchTopic: this.zendutyCloudWatchTopic,
        heavyLibLayer,
      }
    )

    new CdkTarponPythonStack(this, `${config.stage}-tarpon-python`, {
      config,
      lambdaExecutionRole,
      functionProps: this.functionProps,
      zendutyCloudWatchTopic: this.zendutyCloudWatchTopic,
    })

    /**
     * Canaries
     */

    if (!isDevUserStack && ['dev', 'sandbox'].includes(this.config.stage)) {
      const canary = createCanary(
        this,
        StackConstants.PUBLIC_API_CANARY_TESTS_NAME,
        10
      )
      canary.node.addDependency(consoleApiStack)

      canary.role?.attachInlinePolicy(
        new Policy(this, getResourceNameForTarpon('CanaryPolicy'), {
          policyName: getResourceNameForTarpon('CanaryPolicy'),
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['apigateway:*'],
              resources: ['*'],
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['secretsmanager:*'],
              resources: ['*'],
            }),
          ],
        })
      )
    }

    const {
      alias: mongoDbTriggerQueueConsumerAlias,
      func: mongoDbTriggerQueueConsumerFunc,
    } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.MONGO_DB_TRIGGER_QUEUE_CONSUMER_FUNCTION_NAME,
        memorySize: this.config.resource.MONGO_DB_TRIGGER_LAMBDA?.MEMORY_SIZE,
      },
      heavyLibLayer
    )

    this.addTagsToResource(mongoDbTriggerQueueConsumerAlias, {
      [FEATURE]: FEATURES.MONGO_DB_CONSUMER,
    })

    this.addTagsToResource(mongoDbTriggerQueueConsumerFunc, {
      [FEATURE]: FEATURES.MONGO_DB_CONSUMER,
    })

    mongoDbTriggerQueueConsumerAlias.addEventSource(
      new SqsEventSource(mongoDbConsumerQueue, {
        batchSize: 500,
        maxBatchingWindow: Duration.seconds(10),
        maxConcurrency:
          this.config.resource.MONGO_DB_TRIGGER_LAMBDA
            ?.PROVISIONED_CONCURRENCY ?? 100,
      })
    )

    const {
      alias: dynamoDbTriggerQueueConsumerAlias,
      func: dynamoDbTriggerQueueConsumerFunc,
    } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.DYNAMO_DB_TRIGGER_QUEUE_CONSUMER_FUNCTION_NAME,
        memorySize: config.resource.DYNAMO_DB_TRIGGER_LAMBDA?.MEMORY_SIZE,
      },
      heavyLibLayer
    )

    this.addTagsToResource(dynamoDbTriggerQueueConsumerAlias, {
      [FEATURE]: FEATURES.DYNAMO_DB_CONSUMER,
    })

    this.addTagsToResource(dynamoDbTriggerQueueConsumerFunc, {
      [FEATURE]: FEATURES.DYNAMO_DB_CONSUMER,
    })

    // Connect the Lambda to the queue
    dynamoDbTriggerQueueConsumerAlias.addEventSource(
      new SqsEventSource(dynamoDbConsumerQueue, {
        batchSize: 1,
        maxBatchingWindow: Duration.seconds(10),
        maxConcurrency: 100,
      })
    )

    /**
     * CloudWatch Logs Ingestion Pipeline (CloudWatch Logs → Firehose → S3 → Lambda → ClickHouse)
     */
    if (
      !isDevUserStack &&
      this.config.resource.CLOUDWATCH_LOGS_INGESTION?.ENABLED
    ) {
      const logsS3BucketName = getNameForGlobalResource(
        StackConstants.CLOUDWATCH_LOGS_S3_BUCKET_PREFIX,
        config
      )
      const logsS3Bucket = new Bucket(this, logsS3BucketName, {
        bucketName: logsS3BucketName,
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        encryption: BucketEncryption.S3_MANAGED,
        lifecycleRules: [
          {
            expiration: Duration.days(7),
          },
        ],
        removalPolicy:
          config.stage === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
        autoDeleteObjects: config.stage === 'dev',
      })

      const firehoseRole = new Role(this, 'FirehoseLogsRole', {
        assumedBy: new ServicePrincipal('firehose.amazonaws.com'),
      })

      logsS3Bucket.grantWrite(firehoseRole)

      firehoseRole.addToPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            'logs:PutLogEvents',
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
          ],
          resources: ['*'],
        })
      )

      const firehoseStream = new CfnDeliveryStream(
        this,
        'CloudwatchLogsFirehoseStream',
        {
          deliveryStreamName:
            StackConstants.CLOUDWATCH_LOGS_FIREHOSE_STREAM_NAME,
          deliveryStreamType: 'DirectPut',
          s3DestinationConfiguration: {
            bucketArn: logsS3Bucket.bucketArn,
            roleArn: firehoseRole.roleArn,
            prefix: 'logs/',
            errorOutputPrefix: 'errors/',
            bufferingHints: {
              intervalInSeconds:
                this.config.resource.CLOUDWATCH_LOGS_INGESTION
                  ?.FIREHOSE_BUFFER_INTERVAL_SECONDS || 300, // 5 minutes
              sizeInMBs:
                this.config.resource.CLOUDWATCH_LOGS_INGESTION
                  ?.FIREHOSE_BUFFER_SIZE_MB || 5, // 5 MB
            },
            compressionFormat: 'GZIP',
          },
        }
      )

      const logsToFirehoseRole = new Role(this, 'LogsToFirehoseRole', {
        assumedBy: new ServicePrincipal('logs.amazonaws.com', {
          conditions: {
            StringEquals: {
              'aws:SourceAccount': config.env.account,
            },
            ArnLike: {
              'aws:SourceArn': `arn:aws:logs:${config.env.region}:${config.env.account}:*`,
            },
          },
        }),
        inlinePolicies: {
          FirehosePublishPolicy: new PolicyDocument({
            statements: [
              new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['firehose:PutRecord', 'firehose:PutRecordBatch'],
                resources: [firehoseStream.attrArn],
              }),
            ],
          }),
        },
      })

      const logGroupName =
        //  TODO: uncomment this and remove the qa group name before merge
        // this.config.resource.CLOUDWATCH_LOGS_INGESTION?.LOG_GROUP_NAME ||
        '/aws/lambda/tarponPublicApiTransactionFunction'

      // Get or reference the log group
      const transactionLogGroup = LogGroup.fromLogGroupName(
        this,
        'TransactionLogGroup',
        logGroupName
      )

      // Create subscription filter to send logs to Firehose
      const subscriptionFilter = new cdk.aws_logs.CfnSubscriptionFilter(
        this,
        'TransactionLogsSubscription',
        {
          logGroupName: transactionLogGroup.logGroupName,
          destinationArn: firehoseStream.attrArn,
          roleArn: logsToFirehoseRole.roleArn,
          // filterPattern: '[r=REPORT, ...]', // Only send REPORT lines
          filterPattern: '', // Empty pattern = send all logs
        }
      )

      subscriptionFilter.node.addDependency(logsToFirehoseRole)
      subscriptionFilter.node.addDependency(firehoseStream)

      // Create Lambda for log ingestion from S3
      const { alias: logsIngestionAlias, func: logsIngestionFunc } =
        createFunction(
          this,
          lambdaExecutionRole,
          {
            name: StackConstants.CLOUDWATCH_LOGS_INGESTION_FUNCTION_NAME,
          },
          heavyLibLayer
        )

      // Grant Lambda permission to read from S3
      logsS3Bucket.grantRead(logsIngestionAlias)

      // Add S3 event source to trigger Lambda when new files arrive
      logsIngestionAlias.addEventSource(
        new S3EventSource(logsS3Bucket, {
          events: [EventType.OBJECT_CREATED],
          filters: [{ prefix: 'logs/' }],
        })
      )

      new CfnOutput(this, 'CloudWatch Logs S3 Bucket', {
        value: logsS3Bucket.bucketName,
      })
      new CfnOutput(this, 'Firehose Delivery Stream', {
        value: firehoseStream.deliveryStreamName || '',
      })
      new CfnOutput(this, 'CloudWatch Logs Ingestion Lambda', {
        value: logsIngestionFunc.functionName,
      })

      /**
       * CloudWatch Logs S3 Parquet Export Pipeline (ClickHouse → S3 Parquet → PostHog)
       * S3 bucket, IAM user, Secrets: Only in eu-central-1 (PostHog suggests eu-central-1)
       * Export Lambda: In every region (queries local ClickHouse, writes to eu-central-1 S3)
       */

      // Create S3 bucket and IAM resources only in eu-central-1
      if (config.env.region === 'eu-central-1') {
        const parquetBucketName = getNameForGlobalResource(
          StackConstants.CLOUDWATCH_LOGS_PARQUET_BUCKET_PREFIX,
          config
        )

        const parquetS3Bucket = new Bucket(
          this,
          'CloudWatchLogsParquetBucket',
          {
            bucketName: parquetBucketName,
            encryption: BucketEncryption.S3_MANAGED,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            removalPolicy:
              config.stage === 'dev'
                ? cdk.RemovalPolicy.DESTROY
                : cdk.RemovalPolicy.RETAIN,
            autoDeleteObjects: config.stage === 'dev',
            versioned: false,
            lifecycleRules: [
              {
                // Log retention: 2 weeks for dev/sandbox, 3 months for prod
                expiration: cdk.Duration.days(
                  config.stage === 'dev' || config.stage === 'sandbox' ? 14 : 90
                ),
              },
            ],
          }
        )

        const posthogS3Policy = new Policy(this, 'PostHogS3ReadPolicy', {
          policyName: `${config.stage}-posthog-s3-read-policy`,
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                's3:PutObject',
                's3:GetObject',
                's3:PutObjectAcl',
                's3:ListBucket',
                's3:ListBucketMultipartUploads',
                's3:AbortMultipartUpload',
                's3:GetBucketLocation',
              ],
              resources: [
                parquetS3Bucket.bucketArn,
                `${parquetS3Bucket.bucketArn}/*`,
              ],
            }),
          ],
        })

        // PostHog S3 user
        const posthogUser = new iam.User(this, 'PostHogS3User', {
          userName: `posthog-s3-reader`,
        })

        posthogUser.attachInlinePolicy(posthogS3Policy)

        const posthogAccessKey = new iam.CfnAccessKey(
          this,
          'PostHogAccessKey',
          {
            userName: posthogUser.userName,
          }
        )

        // Create secrets with automatic replication to regions based on stage
        // dev: no replicas (only eu-central-1)
        // sandbox: replicate to ap-southeast-1
        // prod: replicate to all regions except eu-central-1 (primary)
        const replicaRegions = getSecretsManagerReplicaRegions(
          config.stage as DeployStage
        )

        new secretsmanager.Secret(this, 'PostHogAccessKeySecret', {
          secretName: StackConstants.POSTHOG_S3_ACCESS_KEY_SECRET_NAME,
          secretStringValue: cdk.SecretValue.unsafePlainText(
            posthogAccessKey.ref
          ),
          description:
            'PostHog S3 Access Key ID for CloudWatch logs data warehouse',
          ...(replicaRegions.length > 0
            ? { replicaRegions: replicaRegions.map((region) => ({ region })) }
            : {}),
        })

        new secretsmanager.Secret(this, 'PostHogSecretKeySecret', {
          secretName: StackConstants.POSTHOG_S3_SECRET_KEY_SECRET_NAME,
          secretStringValue: cdk.SecretValue.unsafePlainText(
            posthogAccessKey.attrSecretAccessKey
          ),
          description:
            'PostHog S3 Secret Access Key for CloudWatch logs data warehouse',
          ...(replicaRegions.length > 0
            ? { replicaRegions: replicaRegions.map((region) => ({ region })) }
            : {}),
        })

        new CfnOutput(this, 'CloudWatch Logs Parquet S3 Bucket', {
          value: parquetS3Bucket.bucketName,
        })
        new CfnOutput(this, 'PostHog S3 User', {
          value: posthogUser.userName,
        })
        new CfnOutput(this, 'PostHog S3 URL Pattern', {
          value: `https://${parquetS3Bucket.bucketName}.s3.eu-central-1.amazonaws.com/*`,
          description: 'Use this URL pattern when creating PostHog data source',
        })
      }

      // Reference the replicated secrets in the current region
      // NOTE: Deploy to eu-central-1 FIRST to create primary secrets with replicas
      // Then deploy to other regions which will reference the replica secrets
      const accessKeySecretArn = `arn:aws:secretsmanager:${config.env.region}:${config.env.account}:secret:${StackConstants.POSTHOG_S3_ACCESS_KEY_SECRET_NAME}`
      const secretKeySecretArn = `arn:aws:secretsmanager:${config.env.region}:${config.env.account}:secret:${StackConstants.POSTHOG_S3_SECRET_KEY_SECRET_NAME}`

      const { alias: s3ExporterAlias, func: s3ExporterFunc } = createFunction(
        this,
        lambdaExecutionRole,
        {
          name: StackConstants.CLOUDWATCH_LOGS_S3_EXPORTER_FUNCTION_NAME,
        },
        heavyLibLayer
      )

      // Construct centralized S3 bucket name (always in eu-central-1)
      const centralizedParquetBucketName = getNameForGlobalResource(
        StackConstants.CLOUDWATCH_LOGS_PARQUET_BUCKET_PREFIX,
        config,
        'eu-central-1'
      )

      s3ExporterFunc.addToRolePolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['secretsmanager:GetSecretValue'],
          resources: [
            `${accessKeySecretArn}*`, // Add * for versioning
            `${secretKeySecretArn}*`,
          ],
        })
      )

      // Local DynamoDB read/write for sync state tracking
      s3ExporterFunc.addToRolePolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
          ],
          resources: [
            `arn:aws:dynamodb:${config.env.region}:${config.env.account}:table/${DYNAMODB_TABLE_NAMES.TARPON}`,
          ],
        })
      )

      // Add environment variables
      s3ExporterFunc.addEnvironment(
        'PARQUET_S3_BUCKET_NAME',
        centralizedParquetBucketName // S3 bucket in eu-central-1
      )
      s3ExporterFunc.addEnvironment(
        'POSTHOG_ACCESS_KEY_SECRET_ARN',
        accessKeySecretArn // Secret in the current region
      )
      s3ExporterFunc.addEnvironment(
        'POSTHOG_SECRET_KEY_SECRET_ARN',
        secretKeySecretArn // Secret in the current region
      )

      // Cron job to trigger the Lambda every 10 minutes
      const cloudwatchLogsExportRule = new events.Rule(
        this,
        'CloudWatchLogsS3ExportRule',
        {
          schedule: Schedule.cron({ minute: '*/10' }),
          description:
            'Trigger Lambda to export CloudWatch logs from ClickHouse to S3 Parquet every 10 minutes',
        }
      )

      cloudwatchLogsExportRule.addTarget(
        new targets.LambdaFunction(s3ExporterAlias)
      )

      new CfnOutput(this, 'CloudWatch Logs S3 Exporter Lambda', {
        value: s3ExporterFunc.functionName,
      })
    }

    if (this.config.clickhouse?.awsPrivateLinkEndpointName && vpc) {
      const vpcEndpoint = new InterfaceVpcEndpoint(
        this,
        'clickhouse-endpoint',
        {
          vpc,
          service: new InterfaceVpcEndpointService(
            this.config.clickhouse.awsPrivateLinkEndpointName
          ),
          privateDnsEnabled: true,

          securityGroups: [clickhouseSecurityGroup, securityGroup],
        }
      )
      this.addTagsToResource(vpcEndpoint, {
        Name: 'ClickhouseEndpoint',
      })
    }

    /**
     * Outputs
     */
    new CfnOutput(this, 'API Gateway endpoint URL - Public API', {
      value: publicApi.urlForPath('/'),
    })
    new CfnOutput(this, 'API Gateway endpoint URL - Public Management API', {
      value: publicConsoleApi.urlForPath('/'),
    })
    if (this.config.resource.LAMBDA_VPC_ENABLED) {
      new CfnOutput(this, 'Lambda VPC ID', {
        value: vpc.vpcId,
      })
      new CfnOutput(this, 'Lambda VPC CIDR', {
        value: vpcCidr,
      })
    }

    if (!isQaEnv()) {
      createTransactionFunctionPerformanceDashboard(this, this.config.region)
    }
  }

  private createDynamodbTable(
    tableName: string,
    kinesisStream?: IStream,
    enableTimeToLive = false,
    contributorInsightsEnabled = false
  ) {
    const isDevUserStack = process.env.ENV === 'dev:user'
    if (isDevUserStack) {
      return Table.fromTableName(this, tableName, tableName)
    }
    const tableProps: any = {
      tableName: tableName,
      partitionKey: { name: 'PartitionKeyID', type: AttributeType.STRING },
      sortKey: { name: 'SortKeyID', type: AttributeType.STRING },
      readCapacity: this.config.resource.DYNAMODB.READ_CAPACITY,
      writeCapacity: this.config.resource.DYNAMODB.WRITE_CAPACITY,
      billingMode: this.config.resource.DYNAMODB
        .BILLING_MODE as unknown as BillingMode,
      kinesisStream,
      pointInTimeRecovery: true,
      removalPolicy:
        this.config.stage === 'dev'
          ? RemovalPolicy.DESTROY
          : RemovalPolicy.RETAIN,
      timeToLiveAttribute: enableTimeToLive ? 'ttl' : undefined,
      contributorInsightsEnabled,
    }

    const table = new Table(this, tableName, tableProps)
    return table
  }

  private createKinesisStream(
    streamId: string,
    streamName: string,
    retentionPeriod: Duration
  ): IStream {
    if (isQaEnv()) {
      const streamArn = `arn:aws:kinesis:${this.config.env.region}:${this.config.env.account}:stream/${streamName}`
      return Stream.fromStreamArn(this, streamId, streamArn)
    }

    const stream = new Stream(this, streamId, {
      streamName,
      retentionPeriod: retentionPeriod,
      streamMode: StreamMode.ON_DEMAND,
    })
    if (this.config.stage === 'dev') {
      stream.applyRemovalPolicy(RemovalPolicy.DESTROY)
    }

    return stream
  }

  private createKinesisEventSource(
    alias: Alias,
    stream: IStream,
    props?: Partial<KinesisEventSourceProps>
  ) {
    const eventSource = new KinesisEventSource(stream, {
      batchSize: 100,
      maxBatchingWindow: Duration.seconds(10),
      ...props,
      startingPosition: isQaEnv()
        ? StartingPosition.LATEST
        : props?.startingPosition ?? StartingPosition.LATEST,
    })
    alias.addEventSource(eventSource)
  }

  private createDynamoDbVpcEndpoint(
    vpc: Vpc | null
  ): GatewayVpcEndpoint | null {
    if (
      !vpc ||
      !this.config.resource.LAMBDA_VPC_ENABLED ||
      (envIsNot('prod') && envIsNot('sandbox'))
    ) {
      return null
    }

    const privateSubnets = vpc.selectSubnets({
      subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      onePerAz: true, // prevents multiple subnets in the same AZ trying to attach the same endpoint
    })

    // Create DynamoDB Gateway VPC endpoint with explicit route table association
    const dynamoDbVpcEndpoint = vpc.addGatewayEndpoint(
      'dynamodb-gateway-endpoint',
      {
        service: GatewayVpcEndpointAwsService.DYNAMODB,
        subnets: [privateSubnets],
      }
    )

    this.addTagsToResource(dynamoDbVpcEndpoint, {
      Name: 'DynamoDBGatewayEndpoint',
      Service: 'DynamoDB',
      Stage: this.config.stage,
    })

    // Output VPC endpoint information
    if (this.config.resource.LAMBDA_VPC_ENABLED) {
      new CfnOutput(this, 'DynamoDB Gateway VPC Endpoint ID', {
        value: dynamoDbVpcEndpoint.vpcEndpointId,
      })
    }

    return dynamoDbVpcEndpoint
  }

  private createS3VpcEndpoint(vpc: Vpc | null): GatewayVpcEndpoint | null {
    if (
      !vpc ||
      !this.config.resource.LAMBDA_VPC_ENABLED ||
      (envIsNot('prod') && envIsNot('sandbox'))
    ) {
      return null
    }

    const privateSubnets = vpc.selectSubnets({
      subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      onePerAz: true, // prevents multiple subnets in the same AZ trying to attach the same endpoint
    })

    // Create S3 Gateway VPC endpoint with explicit route table association
    const s3VpcEndpoint = vpc.addGatewayEndpoint('s3-gateway-endpoint', {
      service: GatewayVpcEndpointAwsService.S3,
      subnets: [privateSubnets],
    })

    this.addTagsToResource(s3VpcEndpoint, {
      Name: 'S3GatewayEndpoint',
      Service: 'S3',
      Stage: this.config.stage,
    })

    // Output VPC endpoint information
    if (this.config.resource.LAMBDA_VPC_ENABLED) {
      new CfnOutput(this, 'S3 Gateway VPC Endpoint ID', {
        value: s3VpcEndpoint.vpcEndpointId,
      })
    }

    return s3VpcEndpoint
  }

  private createSqsInterfaceVpcEndpoint(
    vpc: Vpc | null,
    vpcCidr: string | null
  ): InterfaceVpcEndpoint | null {
    if (
      !vpc ||
      !this.config.resource.LAMBDA_VPC_ENABLED ||
      (envIsNot('prod') && envIsNot('sandbox'))
    ) {
      return null
    }

    const privateSubnets = vpc.selectSubnets({
      subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      onePerAz: true, // prevents multiple subnets in the same AZ trying to attach the same endpoint
    })

    const sqsEndpointSecurityGroup = new SecurityGroup(
      this,
      getResourceNameForTarpon('SqsInterfaceEndpointSecurityGroup'),
      {
        vpc,
        allowAllOutbound: true,
        description: 'Security group for SQS Interface Endpoint',
      }
    )

    if (vpcCidr) {
      sqsEndpointSecurityGroup.addIngressRule(
        Peer.ipv4(vpcCidr),
        Port.tcp(443),
        'Allow HTTPS from within VPC'
      )
    }

    const sqsInterfaceVpcEndpoint = vpc.addInterfaceEndpoint(
      getResourceNameForTarpon('SqsInterfaceEndpoint'),
      {
        service: InterfaceVpcEndpointAwsService.SQS,
        subnets: { subnets: privateSubnets.subnets },
        securityGroups: [sqsEndpointSecurityGroup],
        privateDnsEnabled: true,
      }
    )

    this.addTagsToResource(sqsEndpointSecurityGroup, {
      Name: 'SqsInterfaceEndpointSecurityGroup',
      Stage: this.config.stage,
    })

    this.addTagsToResource(sqsInterfaceVpcEndpoint, {
      Name: 'SqsInterfaceEndpoint',
      Service: 'SQS',
      Stage: this.config.stage,
    })

    if (this.config.resource.LAMBDA_VPC_ENABLED) {
      new CfnOutput(this, 'SQS Interface VPC Endpoint ID', {
        value: sqsInterfaceVpcEndpoint.vpcEndpointId,
      })
    }

    return sqsInterfaceVpcEndpoint
  }

  private createMongoAtlasVpc() {
    // Enable VPC forsandbox, and prod stages
    if (this.config.stage !== 'sandbox' && this.config.stage !== 'prod') {
      return {
        vpc: null,
        vpcCidr: null,
        securityGroup: null,
        clickhouseSecurityGroup: null,
      } as any
    }
    const IP_ADDRESS_RANGE = '10.0.0.0/21'
    const ipAddresses = IpAddresses.cidr(IP_ADDRESS_RANGE)
    const vpc = new Vpc(this, 'vpc', {
      vpcName: StackConstants.VPC_NAME,
      ipAddresses,
      subnetConfiguration: [
        {
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
          name: 'PrivateSubnet1',
        },
        {
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
          name: 'PrivateSubnet2',
        },
        {
          subnetType: SubnetType.PUBLIC,
          cidrMask: 28,
          name: 'PublicSubnet1',
        },
      ],
    })

    createVpcLogGroup(this, vpc, {
      name: 'MongoAtlas',
      logRetention: this.config.resource.CLOUD_WATCH
        .logRetention as unknown as RetentionDays,
    })

    const securityGroup = new SecurityGroup(
      this,
      StackConstants.VPC_SECURITY_GROUP_ID,
      {
        vpc,
        securityGroupName: StackConstants.VPC_SECURITY_GROUP_ID,
      }
    )
    securityGroup.addIngressRule(Peer.ipv4(IP_ADDRESS_RANGE), Port.tcp(27017))
    securityGroup.addEgressRule(
      Peer.anyIpv4(),
      Port.tcp(443),
      'HTTPS for DynamoDB VPC endpoint'
    )
    securityGroup.addEgressRule(
      Peer.anyIpv4(),
      Port.tcp(80),
      'HTTP for DynamoDB VPC endpoint'
    )
    const clickhouseSecurityGroup = new SecurityGroup(
      this,
      StackConstants.CLICKHOUSE_SECURITY_GROUP_ID,
      {
        vpc,
        securityGroupName: StackConstants.CLICKHOUSE_SECURITY_GROUP_ID,
      }
    )

    clickhouseSecurityGroup.addIngressRule(
      Peer.ipv4(IP_ADDRESS_RANGE),
      Port.tcp(8443)
    )
    clickhouseSecurityGroup.addIngressRule(
      Peer.ipv4(IP_ADDRESS_RANGE),
      Port.tcp(9440)
    )

    return {
      vpc,
      vpcCidr: IP_ADDRESS_RANGE,
      securityGroup,
      clickhouseSecurityGroup,
    }
  }

  private createQueue(
    queueName: string,
    options?: {
      visibilityTimeout?: Duration
      maxReceiveCount?: number
      fifo?: boolean
      retentionPeriod?: Duration
    }
  ): Queue {
    const maxReceiveCount = options?.maxReceiveCount || 30
    const queue = new Queue(this, queueName, {
      queueName,
      fifo: options?.fifo,
      visibilityTimeout:
        options?.visibilityTimeout || DEFAULT_SQS_VISIBILITY_TIMEOUT,
      deadLetterQueue: {
        queue: new Queue(this, getDeadLetterQueueName(queueName), {
          fifo: options?.fifo,
        }),
        maxReceiveCount,
      },
      retentionPeriod: options?.retentionPeriod,
      ...(options?.fifo
        ? {
            // High throughput for FIFO queues
            fifoThroughputLimit: FifoThroughputLimit.PER_MESSAGE_GROUP_ID,
            deduplicationScope: DeduplicationScope.MESSAGE_GROUP,
          }
        : {}),
    })
    return queue
  }

  /**
   *
   * @description Define the IAM policies and roles for GuardDuty malware protection for S3. Also scan the using
   * GuardDuty for malware and tag the objects with the result.
   */
  private createMalwareProtectionPlanForS3Bucket(bucket: Bucket) {
    const guarddutyRoleName = getNameForGlobalResource(
      'GuardDutyMalwareProtectionRole',
      this.config
    )

    const guardDutyRole = new Role(this, guarddutyRoleName, {
      assumedBy: new ServicePrincipal(
        'malware-protection-plan.guardduty.amazonaws.com'
      ),
      description:
        'Role for GuardDuty Malware Protection to assume and scan S3 events',
      roleName: guarddutyRoleName,
      inlinePolicies: {
        GuardDutyMalwareProtectionPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              sid: 'AllowManagedRuleToSendS3EventsToGuardDuty',
              effect: Effect.ALLOW,
              actions: [
                'events:PutRule',
                'events:DeleteRule',
                'events:PutTargets',
                'events:RemoveTargets',
              ],
              resources: [
                `arn:aws:events:${this.config.env.region}:${this.config.env.account}:rule/DO-NOT-DELETE-AmazonGuardDutyMalwareProtectionS3*`,
              ],
              conditions: {
                StringLike: {
                  'events:ManagedBy':
                    'malware-protection-plan.guardduty.amazonaws.com',
                },
              },
            }),
            new PolicyStatement({
              sid: 'AllowGuardDutyToMonitorEventBridgeManagedRule',
              effect: Effect.ALLOW,
              actions: ['events:DescribeRule', 'events:ListTargetsByRule'],
              resources: [
                `arn:aws:events:${this.config.env.region}:${this.config.env.account}:rule/DO-NOT-DELETE-AmazonGuardDutyMalwareProtectionS3*`,
              ],
            }),
            new PolicyStatement({
              sid: 'AllowPostScanTag',
              effect: Effect.ALLOW,
              actions: [
                's3:PutObjectTagging',
                's3:GetObjectTagging',
                's3:PutObjectVersionTagging',
                's3:GetObjectVersionTagging',
              ],
              resources: [`${bucket.bucketArn}/*`],
            }),
            new PolicyStatement({
              sid: 'AllowEnableS3EventBridgeEvents',
              effect: Effect.ALLOW,
              actions: ['s3:PutBucketNotification', 's3:GetBucketNotification'],
              resources: [bucket.bucketArn],
            }),
            new PolicyStatement({
              sid: 'AllowPutValidationObject',
              effect: Effect.ALLOW,
              actions: ['s3:PutObject'],
              resources: [
                `${bucket.bucketArn}/malware-protection-resource-validation-object`,
              ],
            }),
            new PolicyStatement({
              sid: 'AllowCheckBucketOwnership',
              effect: Effect.ALLOW,
              actions: ['s3:ListBucket'],
              resources: [bucket.bucketArn],
            }),
            new PolicyStatement({
              sid: 'AllowMalwareScan',
              effect: Effect.ALLOW,
              actions: ['s3:GetObject', 's3:GetObjectVersion'],
              resources: [`${bucket.bucketArn}/*`],
            }),
            new PolicyStatement({
              sid: 'AllowDecryptForMalwareScan',
              effect: Effect.ALLOW,
              actions: ['kms:GenerateDataKey', 'kms:Decrypt'],
              resources: [
                `arn:aws:kms:${this.config.env.region}:${this.config.env.account}:key/*`,
              ],
              conditions: {
                StringLike: {
                  'kms:ViaService': 's3.*.amazonaws.com',
                },
              },
            }),
          ],
        }),
      },
    })

    new CfnMalwareProtectionPlan(this, 'GuardDutyMalwareProtectionPlan', {
      actions: {
        tagging: {
          status: 'ENABLED',
        },
      },
      protectedResource: {
        s3Bucket: {
          bucketName: bucket.bucketName,
        },
      },
      role: guardDutyRole.roleArn,
    })
  }

  private createOpensearchService(
    vpc: Vpc,
    lambdaExecutionRole: cdk.aws_iam.Role,
    ecsTaskExecutionRole: cdk.aws_iam.Role
  ) {
    if (!this.config.opensearch.deploy || isQaEnv()) {
      return
    }
    let vpcProps: {
      vpc?: Vpc
      securityGroups?: cdk.aws_ec2.ISecurityGroup[]
      vpcSubnets?: cdk.aws_ec2.SubnetSelection[]
    } = {}
    if (vpc && (envIs('sandbox') || envIs('prod'))) {
      const endpointSecurityGroup = new SecurityGroup(
        this,
        'OpenSearchEndpointSG',
        {
          vpc,
          description: 'Security group for OpenSearch Serverless VPC endpoint',
        }
      )

      endpointSecurityGroup.addIngressRule(
        Peer.ipv4('10.0.0.0/21'),
        Port.tcp(443)
      )
      const privateSubnets = vpc
        .selectSubnets({
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        })
        .subnets.slice(0, 3)
      vpcProps = {
        vpc,
        securityGroups: [endpointSecurityGroup],
        vpcSubnets: privateSubnets.map((subnet) => ({ subnets: [subnet] })),
      }
    }
    const domainName = `${this.config.stage}-${
      this.config.region ?? ''
    }-opensearch`
    new Domain(this, domainName, {
      version: EngineVersion.OPENSEARCH_2_17,
      enableVersionUpgrade: true,
      domainName: domainName,
      capacity: {
        dataNodes: this.config.opensearch.dataNodes,
        dataNodeInstanceType: this.config.opensearch.dataNodeInstanceType,
      },
      nodeToNodeEncryption: true,
      encryptionAtRest: {
        enabled: true,
      },
      ...vpcProps,
      enforceHttps: true,
      automatedSnapshotStartHour: undefined,
      ebs: {
        volumeType: EbsDeviceVolumeType.GP3,
        volumeSize: this.config.opensearch.volumeSize,
        iops: 3000,
        throughput: 125,
      },
      zoneAwareness: {
        enabled: true,
        availabilityZoneCount: 3,
      },
      accessPolicies: [
        new PolicyStatement({
          actions: ['es:*'],
          effect: Effect.ALLOW,
          principals: [
            lambdaExecutionRole,
            ecsTaskExecutionRole,
            new ArnPrincipal(
              `arn:aws:iam::${this.config.env.account}:role/CodePipelineDeployRole`
            ),
          ],
          resources: [
            `arn:aws:es:${this.config.env.region}:${this.config.env.account}:domain/${domainName}/*`,
          ],
        }),
      ],
    })
  }
}

const getSubdomain = (): string => {
  if (envIsNot('dev')) {
    throw new Error('Automated domain generation is only available in dev')
  }
  if (isQaEnv()) {
    return `${process.env.QA_SUBDOMAIN}.api`
  }
  return `api`
}
const getApiDomain = (config: Config): string => {
  return `${getSubdomain()}.${getBaseDomain(config)}`
}

const getBaseDomain = (config: Config): string => {
  return getDomainWithoutSubdomain(config.application.CONSOLE_URI).replace(
    'console.',
    ''
  )
}

const getDomainWithoutSubdomain = (url: string) => {
  const urlParts = new URL(url).hostname.split('.')

  return urlParts
    .slice(0)
    .slice(-(urlParts.length === 4 ? 3 : 2))
    .join('.')
}
