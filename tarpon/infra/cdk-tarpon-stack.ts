import { URL } from 'url'
import * as cdk from 'aws-cdk-lib'
import { CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib'
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb'
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  HttpMethods,
} from 'aws-cdk-lib/aws-s3'
import { LambdaFunction as LambdaFunctionTarget } from 'aws-cdk-lib/aws-events-targets'
import {
  ArnPrincipal,
  CompositePrincipal,
  Effect,
  ManagedPolicy,
  Policy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam'
import {
  ApiKey,
  DomainName,
  Period,
  UsagePlan,
} from 'aws-cdk-lib/aws-apigateway'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { Subscription, SubscriptionProtocol, Topic } from 'aws-cdk-lib/aws-sns'

import { Alias, FunctionProps, StartingPosition } from 'aws-cdk-lib/aws-lambda'

import { Construct } from 'constructs'
import { IStream, Stream, StreamMode } from 'aws-cdk-lib/aws-kinesis'
import {
  KinesisEventSource,
  KinesisEventSourceProps,
  SqsEventSource,
} from 'aws-cdk-lib/aws-lambda-event-sources'
import { SqsSubscription } from 'aws-cdk-lib/aws-sns-subscriptions'
import {
  IpAddresses,
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
  Vpc,
} from 'aws-cdk-lib/aws-ec2'
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager'
import { CnameRecord, HostedZone } from 'aws-cdk-lib/aws-route53'
import { Rule, Schedule } from 'aws-cdk-lib/aws-events'
import {
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
  BATCH_JOB_PAYLOAD_RESULT_KEY,
  BATCH_JOB_RUN_TYPE_RESULT_KEY,
  FARGATE_BATCH_JOB_RUN_TYPE,
  LAMBDA_BATCH_JOB_RUN_TYPE,
  BATCH_JOB_ID_ENV_VAR,
  BATCH_JOB_TENANT_ID_ENV_VAR,
} from '@lib/cdk/constants'
import {
  Cluster,
  ContainerImage,
  FargatePlatformVersion,
} from 'aws-cdk-lib/aws-ecs'
import { FlagrightRegion } from '@flagright/lib/constants/deploy'
import { CdkTarponAlarmsStack } from './cdk-tarpon-nested-stacks/cdk-tarpon-alarms-stack'
import { CdkTarponConsoleLambdaStack } from './cdk-tarpon-nested-stacks/cdk-tarpon-console-api-stack'
import { createApiGateway } from './cdk-utils/cdk-apigateway-utils'
import { createAPIGatewayThrottlingAlarm } from './cdk-utils/cdk-cw-alarms-utils'
import { createFunction } from './cdk-utils/cdk-lambda-utils'
import { createVpcLogGroup } from './cdk-utils/cdk-log-group-utils'
import { createCanary } from './cdk-utils/cdk-synthetics-utils'
import {
  addFargateContainer,
  createDockerImage,
  createFargateTaskDefinition,
} from './cdk-utils/cdk-fargate-utils'
import { CdkBudgetStack } from './cdk-tarpon-nested-stacks/cdk-budgets-stack'
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

// TODO make this equal to !isQaEnv before merge
// const deployKinesisConsumer = !isQaEnv()
const deployKinesisConsumer = !isQaEnv()

export class CdkTarponStack extends cdk.Stack {
  config: Config
  betterUptimeCloudWatchTopic: Topic
  functionProps: Partial<FunctionProps>

  constructor(scope: Construct, id: string, config: Config) {
    super(scope, id, {
      env: config.env,
    })
    this.config = config

    /**
     * SQS & SNS
     */
    const BetterUptimeCloudWatchTopic = new Topic(
      this,
      StackConstants.BETTER_UPTIME_CLOUD_WATCH_TOPIC_NAME,
      {
        displayName: StackConstants.BETTER_UPTIME_CLOUD_WATCH_TOPIC_NAME,
        topicName: StackConstants.BETTER_UPTIME_CLOUD_WATCH_TOPIC_NAME,
      }
    )
    this.betterUptimeCloudWatchTopic = BetterUptimeCloudWatchTopic

    new Subscription(this, StackConstants.BETTER_UPTIME_SUBSCRIPTION_NAME, {
      topic: this.betterUptimeCloudWatchTopic,
      endpoint: config.application.BETTERUPTIME_HOOK_URL
        ? config.application.BETTERUPTIME_HOOK_URL
        : '',
      protocol: SubscriptionProtocol.HTTPS,
    })

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

    const batchJobQueue = this.createQueue(
      SQSQueues.BATCH_JOB_QUEUE_NAME.name,
      {
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
        retentionPeriod: Duration.days(7),
      }
    )

    // Kinesis consumer retry queues
    const tarponChangeCaptureRetryQueue = this.createQueue(
      SQSQueues.TARPON_CHANGE_CAPTURE_RETRY_QUEUE_NAME.name,
      {
        fifo: true,
        maxReceiveCount: MAX_SQS_RECEIVE_COUNT,
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
      }
    )

    const webhookTarponChangeCaptureRetryQueue = this.createQueue(
      SQSQueues.WEBHOOK_TARPON_CHANGE_CAPTURE_RETRY_QUEUE_NAME.name,
      {
        fifo: true,
        maxReceiveCount: MAX_SQS_RECEIVE_COUNT,
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
      }
    )

    const hammerheadChangeCaptureRetryQueue = this.createQueue(
      SQSQueues.HAMMERHEAD_CHANGE_CAPTURE_RETRY_QUEUE_NAME.name,
      {
        fifo: true,
        maxReceiveCount: MAX_SQS_RECEIVE_COUNT,
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
      }
    )

    const requestLoggerQueue = this.createQueue(
      SQSQueues.REQUEST_LOGGER_QUEUE_NAME.name,
      {
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
        maxReceiveCount: MAX_SQS_RECEIVE_COUNT,
      }
    )

    const transactionEventQueue = this.createQueue(
      SQSQueues.TRANSACTION_EVENT_QUEUE_NAME.name,
      {
        fifo: true,
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
        maxReceiveCount: MAX_SQS_RECEIVE_COUNT,
      }
    )
    const userEventQueue = this.createQueue(
      SQSQueues.USER_EVENT_QUEUE_NAME.name,
      {
        fifo: true,
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
        maxReceiveCount: MAX_SQS_RECEIVE_COUNT,
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
    const hammerheadStream = this.createKinesisStream(
      StackConstants.HAMMERHEAD_STREAM_ID,
      StackConstants.HAMMERHEAD_STREAM_NAME,
      Duration.days(7)
    )

    /**
     * DynamoDB
     */
    const tarponDynamoDbTable = this.createDynamodbTable(
      StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      tarponStream,
      true,
      true
    )
    const tarponRuleDynamoDbTable = this.createDynamodbTable(
      StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME
    )
    const hammerheadDynamoDbTable = this.createDynamodbTable(
      StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      hammerheadStream
    )
    const transientDynamoDbTable = this.createDynamodbTable(
      StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
      undefined,
      true
    )

    /*
     * MongoDB Atlas DB
     * VPC configuration: https://www.mongodb.com/docs/atlas/security-vpc-peering/
     */

    const { vpc, vpcCidr, securityGroup } = this.createMongoAtlasVpc()

    /**
     * S3 Buckets
     * NOTE: Bucket name needs to be unique across accounts. We append account ID to the
     * logical bucket name.
     */

    let s3ImportBucket
    let s3DocumentBucket
    let s3TmpBucket
    let s3demoModeBucket
    let s3SharedAssetsBucket

    const s3BucketCors = [
      {
        allowedMethods: [HttpMethods.GET, HttpMethods.PUT, HttpMethods.POST],
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

      s3ImportBucket = new Bucket(this, importBucketName, {
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

      s3DocumentBucket = new Bucket(this, documentBucketName, {
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

      s3demoModeBucket = new Bucket(this, s3demoModeBucketName, {
        bucketName: s3demoModeBucketName,
        cors: s3BucketCors,
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        removalPolicy:
          config.stage === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
        encryption: BucketEncryption.S3_MANAGED,
        serverAccessLogsBucket: serverAccessLogBucket,
        serverAccessLogsPrefix: `tarpon/${s3demoModeBucketName}`,
      })

      s3SharedAssetsBucket = new Bucket(this, sharedAssetsBucketName, {
        bucketName: sharedAssetsBucketName,
        cors: s3BucketCors,
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        removalPolicy:
          config.stage === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
        encryption: BucketEncryption.S3_MANAGED,
        serverAccessLogsBucket: serverAccessLogBucket,
        serverAccessLogsPrefix: `tarpon/${sharedAssetsBucketName}`,
      })
    } else {
      s3ImportBucket = Bucket.fromBucketName(
        this,
        importBucketName,
        importBucketName
      )
      s3DocumentBucket = Bucket.fromBucketName(
        this,
        documentBucketName,
        documentBucketName
      )

      s3TmpBucket = Bucket.fromBucketName(this, tmpBucketName, tmpBucketName)

      s3demoModeBucket = Bucket.fromBucketName(
        this,
        s3demoModeBucketName,
        s3demoModeBucketName
      )
      s3SharedAssetsBucket = Bucket.fromBucketName(
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
        ? [securityGroup]
        : undefined,
      vpc: this.config.resource.LAMBDA_VPC_ENABLED ? vpc : undefined,
      environment: {
        DOCUMENT_BUCKET: documentBucketName,
        IMPORT_BUCKET: importBucketName,
        TMP_BUCKET: tmpBucketName,
        SHARED_ASSETS_BUCKET: sharedAssetsBucketName,
        WEBHOOK_DELIVERY_QUEUE_URL: webhookDeliveryQueue.queueUrl,
        TRANSACTION_AGGREGATION_QUEUE_URL: transactionAggregationQueue.queueUrl,
        WEBHOOK_TARPON_CHANGE_CAPTURE_RETRY_QUEUE_URL:
          webhookTarponChangeCaptureRetryQueue.queueUrl,
        COMPLYADVANTAGE_API_KEY: process.env.COMPLYADVANTAGE_API_KEY as string,
        SLACK_ALERT_QUEUE_URL: slackAlertQueue.queueUrl,
        HAMMERHEAD_CHANGE_CAPTURE_RETRY_QUEUE_URL:
          hammerheadChangeCaptureRetryQueue.queueUrl,
        REQUEST_LOGGER_QUEUE_URL: requestLoggerQueue.queueUrl,
        TARPON_CHANGE_CAPTURE_RETRY_QUEUE_URL:
          tarponChangeCaptureRetryQueue.queueUrl,
        AUDITLOG_TOPIC_ARN: auditLogTopic?.topicArn,
        BATCH_JOB_QUEUE_URL: batchJobQueue?.queueUrl,
        TRANSACTION_EVENT_QUEUE_URL: transactionEventQueue.queueUrl,
        USER_EVENT_QUEUE_URL: userEventQueue.queueUrl,
      },
    }

    let lambdaRoleName = `flagrightLambdaExecutionRole${getSuffix()}`
    let ecsRoleName = `flagrightEcsTaskExecutionRole${getSuffix()}`

    // On production the role name was set without a suffix, it's dangerous for us
    // to change without downtime.
    if (
      (this.config.stage === 'prod' && config.region !== 'asia-2') ||
      (this.config.stage === 'sandbox' && config.region !== 'eu-1')
    ) {
      lambdaRoleName += `-${config.region}`
      ecsRoleName += `-${config.region}`
    }
    const lambdaExecutionRole = new Role(this, `lambda-role`, {
      roleName: lambdaRoleName,
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaVPCAccessExecutionRole'
        ),
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        ),
        ManagedPolicy.fromAwsManagedPolicyName(
          'CloudWatchLambdaInsightsExecutionRolePolicy'
        ),
      ],
    })

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
          resources: [
            hammerheadDynamoDbTable.tableArn,
            tarponRuleDynamoDbTable.tableArn,
            transientDynamoDbTable.tableArn,
            tarponRuleDynamoDbTable.tableArn,
            tarponDynamoDbTable.tableArn,
          ],
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
            tarponChangeCaptureRetryQueue.queueArn,
            batchJobQueue.queueArn,
            webhookTarponChangeCaptureRetryQueue.queueArn,
            hammerheadChangeCaptureRetryQueue.queueArn,
            webhookDeliveryQueue.queueArn,
            slackAlertQueue.queueArn,
            transactionAggregationQueue.queueArn,
            requestLoggerQueue.queueArn,
            notificationQueue.queueArn,
            transactionEventQueue.queueArn,
            userEventQueue.queueArn,
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
          ],
          resources: [
            s3ImportBucket.bucketArn,
            s3DocumentBucket.bucketArn,
            s3TmpBucket.bucketArn,
            s3demoModeBucket.bucketArn,
            s3SharedAssetsBucket.bucketArn,
            `arn:aws:s3:::flagright-datalake-${config.stage}-${
              config.region || 'eu-1'
            }-bucket`,
          ],
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

        // TODO remove after initial deployment
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['sts:AssumeRole'],
          resources: ['*'],
        }),
      ],
    })

    // Give role access to all secrets
    lambdaExecutionRole.attachInlinePolicy(policy)
    ecsTaskExecutionRole.attachInlinePolicy(policy)

    Metric.grantPutMetricData(lambdaExecutionRole)
    Metric.grantPutMetricData(ecsTaskExecutionRole)

    /* API Key Authorizer */
    const { alias: apiKeyAuthorizerAlias, func: apiKeyAuthorizerFunction } =
      createFunction(this, lambdaExecutionRole, {
        name: StackConstants.API_KEY_AUTHORIZER_FUNCTION_NAME,
        provisionedConcurrency:
          config.resource.API_KEY_AUTHORIZER_LAMBDA.PROVISIONED_CONCURRENCY,
      })

    /* Transaction and Transaction Event */
    const transactionFunctionProps = {
      provisionedConcurrency:
        config.resource.TRANSACTION_LAMBDA.PROVISIONED_CONCURRENCY,
      memorySize: config.resource.TRANSACTION_LAMBDA.MEMORY_SIZE,
    }

    const { alias: transactionAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.PUBLIC_API_TRANSACTION_FUNCTION_NAME,
        ...transactionFunctionProps,
      }
    )

    // Configure AutoScaling for Tx Function
    const as = transactionAlias.addAutoScaling({
      maxCapacity: config.resource.TRANSACTION_LAMBDA.PROVISIONED_CONCURRENCY,
    })
    // Configure Target Tracking
    as.scaleOnUtilization({
      utilizationTarget: 0.7,
    })

    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.PUBLIC_API_TRANSACTION_EVENT_FUNCTION_NAME,
      ...transactionFunctionProps,
    })

    /*  User Event */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.PUBLIC_API_USER_EVENT_FUNCTION_NAME,
    })

    /* Rule Template (Public) */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.PUBLIC_MANAGEMENT_API_RULE_FUNCTION_NAME,
    })

    /* Rule Instance (Public) */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.PUBLIC_MANAGEMENT_API_RULE_INSTANCE_FUNCTION_NAME,
    })

    /* Case (Public) */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.PUBLIC_MANAGEMENT_API_CASE_FUNCTION_NAME,
    })

    /* Alert (Public) */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.PUBLIC_MANAGEMENT_API_ALERT_FUNCTION_NAME,
    })

    /* Upload file (Public) */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.PUBLIC_MANAGEMENT_API_FILE_UPLOAD_FUNCTION_NAME,
    })

    /* User (Public) */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.PUBLIC_MANAGEMENT_API_USER_FUNCTION_NAME,
    })

    /* User */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.PUBLIC_API_USER_FUNCTION_NAME,
      provisionedConcurrency:
        config.resource.USER_LAMBDA.PROVISIONED_CONCURRENCY,
      memorySize: config.resource.USER_LAMBDA.MEMORY_SIZE,
    })

    /* Slack App */
    const { alias: slackAlertAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.SLACK_ALERT_FUNCTION_NAME,
      }
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
      }
    )

    webhookDelivererAlias.addEventSource(
      new SqsEventSource(webhookDeliveryQueue, { batchSize: 1 })
    )

    /* Transaction Aggregation */
    const { alias: transactionAggregatorAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.TRANSACTION_AGGREGATION_FUNCTION_NAME,
        memorySize:
          this.config.resource.TRANSACTION_AGGREGATION_LAMBDA?.MEMORY_SIZE,
      }
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
      }
    )

    requestLoggerAlias.addEventSource(
      new SqsEventSource(requestLoggerQueue, {
        batchSize: 50,
        maxConcurrency: 5,
        maxBatchingWindow: Duration.minutes(5),
      })
    )

    /* Audit Log */
    const { alias: auditLogConsumerAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.AUDIT_LOG_CONSUMER_FUNCTION_NAME,
      }
    )
    auditLogConsumerAlias.addEventSource(new SqsEventSource(auditLogQueue))

    /* Notification */
    const { alias: notificationsConsumerAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.NOTIFICATIONS_CONSUMER_FUNCTION_NAME,
      }
    )

    notificationsConsumerAlias.addEventSource(
      new SqsEventSource(notificationQueue)
    )

    /* Batch Job */
    const { alias: jobDecisionAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.BATCH_JOB_DECISION_FUNCTION_NAME,
      }
    )
    const { alias: jobRunnerAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.BATCH_JOB_RUNNER_FUNCTION_NAME,
        memorySize:
          config.resource.BATCH_JOB_LAMBDA?.MEMORY_SIZE ??
          config.resource.LAMBDA_DEFAULT.MEMORY_SIZE,
      }
    )

    jobRunnerAlias.role?.attachInlinePolicy(
      new Policy(this, getResourceNameForTarpon('BatchJobRunnerPolicy'), {
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['s3:GetObject*'],
            resources: [`${s3DocumentBucket.bucketArn}/*`],
          }),
        ],
      })
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
        }
      )

      const fargateBatchJobContainer = addFargateContainer(
        this,
        StackConstants.FARGATE_BATCH_JOB_CONTAINER_NAME,
        fargateBatchJobTaskDefinition,
        {
          memoryLimitMiB:
            config.resource.FARGATE_BATCH_JOB_CONTAINER.MEMORY_LIMIT,
          image: ContainerImage.fromDockerImageAsset(
            createDockerImage(
              this,
              StackConstants.FARGATE_BATCH_JOB_CONTAINER_NAME,
              {
                path:
                  process.env.INFRA_CI === 'true'
                    ? 'src/fargate'
                    : 'dist/fargate',
              }
            )
          ),
        }
      )
      const batchJobCluster = new Cluster(
        this,
        StackConstants.FARGATE_BATCH_JOB_CLUSTER_NAME,
        { vpc }
      )
      ecsBatchJobTask = new EcsRunTask(
        this,
        getResourceNameForTarpon('BatchJobFargateRunner'),
        {
          cluster: batchJobCluster,
          taskDefinition: fargateBatchJobTaskDefinition,
          launchTarget: new EcsFargateLaunchTarget({
            platformVersion: FargatePlatformVersion.LATEST,
          }),
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
          maxDelay: Duration.hours(1),
          maxAttempts: 15,
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
                  maxAttempts: 15,
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
        }
      )
      const monthlyRule = new Rule(
        this,
        getResourceNameForTarpon('MonthlyRule'),
        {
          schedule: Schedule.cron({ minute: '0', hour: '0', day: '1' }),
        }
      )
      monthlyRule.addTarget(new LambdaFunctionTarget(cronJobMonthlyHandler))

      // Daily
      const { func: cronJobDailyHandler } = createFunction(
        this,
        lambdaExecutionRole,
        {
          name: StackConstants.CRON_JOB_DAILY,

          memorySize: config.resource.CRON_JOB_LAMBDA?.MEMORY_SIZE,
        }
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
          'eu-1': { hour: '20', minute: '0' },
          'eu-2': { hour: '20', minute: '15' },
          'asia-1': { hour: '20', minute: '30' },
          'asia-2': { hour: '20', minute: '45' },
          'au-1': { hour: '21', minute: '0' },
          'us-1': { hour: '21', minute: '15' },
          'me-1': { hour: '21', minute: '30' },
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
        }
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
        }
      )
      const { alias: tarponChangeCaptureKinesisConsumerRetryAlias } =
        createFunction(this, lambdaExecutionRole, {
          name: StackConstants.TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_RETRY_FUNCTION_NAME,
        })

      this.createKinesisEventSource(
        tarponChangeCaptureKinesisConsumerAlias,
        tarponStream,
        { startingPosition: StartingPosition.TRIM_HORIZON, batchSize: 200 }
      )
      tarponChangeCaptureKinesisConsumerRetryAlias.addEventSource(
        new SqsEventSource(tarponChangeCaptureRetryQueue)
      )

      /* Hammerhead Kinesis Change capture consumer */
      const { alias: hammerheadChangeCaptureKinesisConsumerAlias } =
        createFunction(this, lambdaExecutionRole, {
          name: StackConstants.HAMMERHEAD_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
          memorySize:
            config.resource.HAMMERHEAD_CHANGE_CAPTURE_LAMBDA?.MEMORY_SIZE,
        })

      const { alias: hammerheadChangeCaptureKinesisConsumerRetryAlias } =
        createFunction(this, lambdaExecutionRole, {
          name: StackConstants.HAMMERHEAD_CHANGE_CAPTURE_KINESIS_CONSUMER_RETRY_FUNCTION_NAME,
        })

      this.createKinesisEventSource(
        hammerheadChangeCaptureKinesisConsumerAlias,
        hammerheadStream,
        { startingPosition: StartingPosition.TRIM_HORIZON }
      )
      hammerheadChangeCaptureKinesisConsumerRetryAlias.addEventSource(
        new SqsEventSource(hammerheadChangeCaptureRetryQueue)
      )

      const { alias: transactionEventQueueConsumerAlias } = createFunction(
        this,
        lambdaExecutionRole,
        {
          name: StackConstants.TRANSACTION_EVENT_QUEUE_CONSUMER_FUNCTION_NAME,
        }
      )
      transactionEventQueueConsumerAlias.addEventSource(
        new SqsEventSource(transactionEventQueue)
      )

      const { alias: userEventQueueConsumerAlias } = createFunction(
        this,
        lambdaExecutionRole,
        {
          name: StackConstants.USER_EVENT_QUEUE_CONSUMER_FUNCTION_NAME,
        }
      )
      userEventQueueConsumerAlias.addEventSource(
        new SqsEventSource(userEventQueue)
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
      this.betterUptimeCloudWatchTopic,
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
      this.betterUptimeCloudWatchTopic,
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
        betterUptimeCloudWatchTopic: this.betterUptimeCloudWatchTopic,
      })

      if (this.config.region !== 'me-1') {
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
        betterUptimeCloudWatchTopic: this.betterUptimeCloudWatchTopic,
      }
    )

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
    const table = new Table(this, tableName, {
      tableName: tableName,
      partitionKey: { name: 'PartitionKeyID', type: AttributeType.STRING },
      sortKey: { name: 'SortKeyID', type: AttributeType.STRING },
      readCapacity: this.config.resource.DYNAMODB.READ_CAPACITY,
      writeCapacity: this.config.resource.DYNAMODB.WRITE_CAPACITY,
      billingMode: this.config.resource.DYNAMODB.BILLING_MODE,
      kinesisStream,
      pointInTimeRecovery: true,
      removalPolicy:
        this.config.stage === 'dev'
          ? RemovalPolicy.DESTROY
          : RemovalPolicy.RETAIN,
      timeToLiveAttribute: enableTimeToLive ? 'ttl' : undefined,
      contributorInsightsEnabled,
    })
    return table
  }

  private createKinesisStream(
    streamId: string,
    streamName: string,
    retentionPeriod: Duration,
    shardCount = 1
  ): IStream {
    if (isQaEnv()) {
      const streamArn = `arn:aws:kinesis:${this.config.env.region}:${this.config.env.account}:stream/${streamName}`
      return Stream.fromStreamArn(this, streamId, streamArn)
    }

    const stream = new Stream(this, streamId, {
      streamName,
      retentionPeriod: retentionPeriod,
      streamMode: StreamMode.PROVISIONED,
      shardCount: shardCount,
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

  private createMongoAtlasVpc() {
    if (this.config.stage !== 'sandbox' && this.config.stage !== 'prod') {
      return {
        vpc: null,
        vpcCidr: null,
        securityGroup: null,
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
      logRetention: this.config.resource.CLOUD_WATCH.logRetention,
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

    return {
      vpc,
      vpcCidr: IP_ADDRESS_RANGE,
      securityGroup,
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
    })
    return queue
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
