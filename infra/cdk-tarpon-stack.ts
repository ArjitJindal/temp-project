import { URL } from 'url'
import * as cdk from 'aws-cdk-lib'
import { CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib'
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb'
import { LambdaFunction as LambdaFunctionTarget } from 'aws-cdk-lib/aws-events-targets'
import {
  ArnPrincipal,
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
import { Topic, Subscription, SubscriptionProtocol } from 'aws-cdk-lib/aws-sns'

import {
  Alias,
  Code,
  FunctionProps,
  LayerVersion,
  Runtime,
  StartingPosition,
} from 'aws-cdk-lib/aws-lambda'

import { Construct } from 'constructs'
import * as s3 from 'aws-cdk-lib/aws-s3'

import { IStream, Stream } from 'aws-cdk-lib/aws-kinesis'
import {
  KinesisEventSource,
  KinesisEventSourceProps,
  SqsEventSource,
} from 'aws-cdk-lib/aws-lambda-event-sources'

import _ from 'lodash'
import { SqsSubscription } from 'aws-cdk-lib/aws-sns-subscriptions'
import { Peer, Port, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2'
import {
  Choice,
  Condition,
  StateMachine,
  Succeed,
} from 'aws-cdk-lib/aws-stepfunctions'
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks'
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
  DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS,
} from '@lib/lambdas'
import { Config } from '@lib/configs/config'
import { Metric } from 'aws-cdk-lib/aws-cloudwatch'
import { getQaApiKey } from '@lib/qa'
import {
  BATCH_JOB_PAYLOAD_RESULT_KEY,
  BATCH_JOB_RUN_TYPE_RESULT_KEY,
  LAMBDA_BATCH_JOB_RUN_TYPE,
} from '../lib/cdk/constants'
import { CdkTarponAlarmsStack } from './cdk-tarpon-nested-stacks/cdk-tarpon-alarms-stack'
import { CdkTarponConsoleLambdaStack } from './cdk-tarpon-nested-stacks/cdk-tarpon-console-api-stack'
import { createApiGateway } from './cdk-utils/cdk-apigateway-utils'
import { createAPIGatewayThrottlingAlarm } from './cdk-utils/cdk-cw-alarms-utils'
import { createFunction } from './cdk-utils/cdk-lambda-utils'

const DEFAULT_SQS_VISIBILITY_TIMEOUT = Duration.seconds(
  DEFAULT_LAMBDA_TIMEOUT_SECONDS * 6
)
const CONSUMER_SQS_VISIBILITY_TIMEOUT = Duration.seconds(
  DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS * 2
)

// SQS max receive count cannot go above 1000
const MAX_SQS_RECEIVE_COUNT = 1000
const isDevUserStack = process.env.ENV === 'dev:user'

export class CdkTarponStack extends cdk.Stack {
  config: Config
  betterUptimeCloudWatchTopic: Topic
  auditLogTopic: Topic
  batchJobQueue: Queue

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

    const slackAlertQueue = this.createQueue(SQSQueues.SLACK_ALERT_QUEUE_NAME, {
      visibilityTimeout: DEFAULT_SQS_VISIBILITY_TIMEOUT,
    })
    const webhookDeliveryQueue = this.createQueue(
      SQSQueues.WEBHOOK_DELIVERY_QUEUE_NAME,
      {
        visibilityTimeout: DEFAULT_SQS_VISIBILITY_TIMEOUT,
        // Retry up to 3 days
        maxReceiveCount:
          Duration.days(3).toSeconds() /
          DEFAULT_SQS_VISIBILITY_TIMEOUT.toSeconds(),
      }
    )

    this.auditLogTopic = new Topic(this, StackConstants.AUDIT_LOG_TOPIC_NAME, {
      displayName: StackConstants.AUDIT_LOG_TOPIC_NAME,
      topicName: StackConstants.AUDIT_LOG_TOPIC_NAME,
    })
    const auditLogQueue = this.createQueue(SQSQueues.AUDIT_LOG_QUEUE_NAME, {
      maxReceiveCount: 3,
    })
    this.auditLogTopic.addSubscription(new SqsSubscription(auditLogQueue))

    const batchJobQueue = this.createQueue(SQSQueues.BATCH_JOB_QUEUE_NAME)
    this.batchJobQueue = batchJobQueue

    // Kinesis consumer retry queues
    const tarponChangeCaptureRetryQueue = this.createQueue(
      SQSQueues.TARPON_CHANGE_CAPTURE_RETRY_QUEUE_NAME,
      {
        fifo: true,
        maxReceiveCount: MAX_SQS_RECEIVE_COUNT,
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
      }
    )

    const webhookTarponChangeCaptureRetryQueue = this.createQueue(
      SQSQueues.WEBHOOK_TARPON_CHANGE_CAPTURE_RETRY_QUEUE_NAME,
      {
        fifo: true,
        maxReceiveCount: MAX_SQS_RECEIVE_COUNT,
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
      }
    )

    const hammerheadChangeCaptureRetryQueue = this.createQueue(
      SQSQueues.HAMMERHEAD_CHANGE_CAPTURE_RETRY_QUEUE_NAME,
      {
        fifo: true,
        maxReceiveCount: MAX_SQS_RECEIVE_COUNT,
        visibilityTimeout: CONSUMER_SQS_VISIBILITY_TIMEOUT,
      }
    )

    /*
     * Kinesis Data Streams
     */
    const tarponStream = this.createKinesisStream(
      StackConstants.TARPON_STREAM_ID,
      StackConstants.TARPON_STREAM_NAME,
      Duration.days(3)
    )
    const hammerheadStream = this.createKinesisStream(
      StackConstants.HAMMERHEAD_STREAM_ID,
      StackConstants.HAMMERHEAD_STREAM_NAME,
      Duration.days(3)
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

    const s3BucketCors = [
      {
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
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
    if (!isDevUserStack) {
      s3ImportBucket = new s3.Bucket(this, importBucketName, {
        bucketName: importBucketName,
        cors: s3BucketCors,
        removalPolicy:
          config.stage === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
        autoDeleteObjects: config.stage === 'dev',
        encryption: s3.BucketEncryption.S3_MANAGED,
      })

      s3DocumentBucket = new s3.Bucket(this, documentBucketName, {
        bucketName: documentBucketName,
        cors: s3BucketCors,
        removalPolicy:
          config.stage === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
        autoDeleteObjects: config.stage === 'dev',
        encryption: s3.BucketEncryption.S3_MANAGED,
      })

      s3TmpBucket = new s3.Bucket(this, tmpBucketName, {
        bucketName: tmpBucketName,
        cors: s3BucketCors,
        removalPolicy:
          config.stage === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
        autoDeleteObjects: config.stage === 'dev',
        encryption: s3.BucketEncryption.S3_MANAGED,
        lifecycleRules: [
          {
            abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
            expiration: cdk.Duration.days(1),
          },
        ],
      })

      s3demoModeBucket = new s3.Bucket(this, s3demoModeBucketName, {
        bucketName: s3demoModeBucketName,
        cors: s3BucketCors,
        removalPolicy:
          config.stage === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
        encryption: s3.BucketEncryption.S3_MANAGED,
      })
    } else {
      s3ImportBucket = s3.Bucket.fromBucketName(
        this,
        importBucketName,
        importBucketName
      )
      s3DocumentBucket = s3.Bucket.fromBucketName(
        this,
        documentBucketName,
        documentBucketName
      )
      s3TmpBucket = s3.Bucket.fromBucketName(this, tmpBucketName, tmpBucketName)
      s3demoModeBucket = s3.Bucket.fromBucketName(
        this,
        s3demoModeBucketName,
        s3demoModeBucketName
      )
    }

    /**
     * Lambda Layers
     */

    const fastGeoIpLayer = new LayerVersion(
      this,
      StackConstants.FAST_GEOIP_LAYER_NAME,
      {
        compatibleRuntimes: [Runtime.NODEJS_16_X],
        code:
          process.env.INFRA_CI === 'true'
            ? Code.fromAsset('infra')
            : Code.fromAsset('dist/layers/fast-geoip'),
        description: 'fast-geoip npm module',
      }
    )

    /**
     * Lambda Functions
     */

    const functionProps: Partial<FunctionProps> = {
      securityGroups: this.config.resource.LAMBDA_VPC_ENABLED
        ? [securityGroup]
        : undefined,
      vpc: this.config.resource.LAMBDA_VPC_ENABLED ? vpc : undefined,
      environment: {
        SM_SECRET_ARN: config.application.ATLAS_CREDENTIALS_SECRET_ARN,
        IMPORT_BUCKET: importBucketName,
        TMP_BUCKET: tmpBucketName,
        AUTH0_DOMAIN: this.config.application.AUTH0_DOMAIN,
        AUTH0_AUDIENCE: this.config.application.AUTH0_AUDIENCE,
        WEBHOOK_DELIVERY_QUEUE_URL: webhookDeliveryQueue.queueUrl,
        WEBHOOK_TARPON_CHANGE_CAPTURE_RETRY_QUEUE_URL:
          webhookTarponChangeCaptureRetryQueue.queueUrl,
        COMPLYADVANTAGE_API_KEY: process.env.COMPLYADVANTAGE_API_KEY as string,
        COMPLYADVANTAGE_DEFAULT_SEARCH_PROFILE_ID: config.application
          .COMPLYADVANTAGE_DEFAULT_SEARCH_PROFILE_ID as string,
        SLACK_ALERT_QUEUE_URL: slackAlertQueue.queueUrl,
        HAMMERHEAD_CHANGE_CAPTURE_RETRY_QUEUE_URL:
          hammerheadChangeCaptureRetryQueue.queueUrl,
        TARPON_CHANGE_CAPTURE_RETRY_QUEUE_URL:
          tarponChangeCaptureRetryQueue.queueUrl,
        SLACK_CLIENT_ID: config.application.SLACK_CLIENT_ID,
        SLACK_CLIENT_SECRET: config.application.SLACK_CLIENT_SECRET,
        SLACK_REDIRECT_URI: config.application.SLACK_REDIRECT_URI,
        CONSOLE_URI: config.application.CONSOLE_URI,
      },
    }

    let roleName = `flagrightLambdaExecutionRole${getSuffix()}`
    if (config.region !== 'asia-2') {
      roleName += `-${config.region}`
    }
    const lambdaExecutionRole = new Role(this, `lambda-role`, {
      roleName,
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

    // Give role access to all secrets
    lambdaExecutionRole.attachInlinePolicy(
      new Policy(this, id, {
        policyName: `${lambdaExecutionRole.roleName}-MongoDbPolicy`,
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['secretsmanager:GetSecretValue'],
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
            actions: ['sqs:*'],
            resources: [
              auditLogQueue.queueArn,
              tarponChangeCaptureRetryQueue.queueArn,
              batchJobQueue.queueArn,
              webhookTarponChangeCaptureRetryQueue.queueArn,
              hammerheadChangeCaptureRetryQueue.queueArn,
              webhookDeliveryQueue.queueArn,
            ],
          }),
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['sns:Publish'],
            resources: [this.auditLogTopic.topicArn],
          }),
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['s3:GetBucket*', 's3:GetObject*', 's3:List*'],
            resources: [
              s3TmpBucket.bucketArn,
              s3ImportBucket.bucketArn,
              s3DocumentBucket.bucketArn,
              s3demoModeBucket.bucketArn,
            ],
          }),
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['states:StartExecution'],
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
    )
    Metric.grantPutMetricData(lambdaExecutionRole)

    /* API Key Authorizer */
    const { alias: apiKeyAuthorizerAlias, func: apiKeyAuthorizerFunction } =
      createFunction(this, lambdaExecutionRole, {
        name: StackConstants.API_KEY_AUTHORIZER_FUNCTION_NAME,
        provisionedConcurrency:
          config.resource.API_KEY_AUTHORIZER_LAMBDA.PROVISIONED_CONCURRENCY,
        auditLogTopic: this.auditLogTopic,
        batchJobQueue,
      })

    /* Transaction and Transaction Event */
    const transactionFunctionProps = {
      provisionedConcurrency:
        config.resource.TRANSACTION_LAMBDA.PROVISIONED_CONCURRENCY,
      layers: [fastGeoIpLayer],
      memorySize: config.resource.TRANSACTION_LAMBDA.MEMORY_SIZE,
    }

    const { alias: transactionAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.PUBLIC_API_TRANSACTION_FUNCTION_NAME,
        auditLogTopic: this.auditLogTopic,
        batchJobQueue,
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

    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.PUBLIC_API_TRANSACTION_EVENT_FUNCTION_NAME,
        auditLogTopic: this.auditLogTopic,
        batchJobQueue,
        ...transactionFunctionProps,
      },
      functionProps
    )

    /*  User Event */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.PUBLIC_API_USER_EVENT_FUNCTION_NAME,
        auditLogTopic: this.auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /* Rule Template (Public) */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.PUBLIC_MANAGEMENT_API_RULE_FUNCTION_NAME,
        auditLogTopic: this.auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /* Rule Instance (Public) */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.PUBLIC_MANAGEMENT_API_RULE_INSTANCE_FUNCTION_NAME,
        auditLogTopic: this.auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /* Device Data (Public) */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.PUBLIC_DEVICE_DATA_API_FUNCTION_NAME,
        auditLogTopic: this.auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /* User */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.PUBLIC_API_USER_FUNCTION_NAME,
        layers: [fastGeoIpLayer],
        provisionedConcurrency:
          config.resource.USER_LAMBDA.PROVISIONED_CONCURRENCY,
        memorySize: config.resource.USER_LAMBDA.MEMORY_SIZE,
        auditLogTopic: this.auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /* Slack App */
    const { alias: slackAlertAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.SLACK_ALERT_FUNCTION_NAME,
        auditLogTopic: this.auditLogTopic,
        batchJobQueue,
      },
      functionProps
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
        auditLogTopic: this.auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    webhookDelivererAlias.addEventSource(
      new SqsEventSource(webhookDeliveryQueue, { batchSize: 1 })
    )

    /* Audit Log */
    const { alias: auditLogConsumerAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.AUDIT_LOG_CONSUMER_FUNCTION_NAME,
        auditLogTopic: this.auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )
    auditLogConsumerAlias.addEventSource(new SqsEventSource(auditLogQueue))

    /* Batch Job */
    const { alias: jobDecisionAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.BATCH_JOB_DECISION_FUNCTION_NAME,
        auditLogTopic: this.auditLogTopic,
        batchJobQueue,
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
        auditLogTopic: this.auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    const batchJobStateMachine = new StateMachine(
      this,
      getResourceNameForTarpon('BatchJobStateMachine'),
      {
        definition: new LambdaInvoke(
          this,
          getResourceNameForTarpon('BatchJobDecisionLambda'),
          {
            lambdaFunction: jobDecisionAlias,
          }
        ).next(
          new Choice(
            this,
            getResourceNameForTarpon('BatchJobRunTypeChoice')
          ).when(
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
              // Use default retry settings for now. Configure RetryProps when needed
              .addRetry({})
              .next(
                new Succeed(
                  this,
                  getResourceNameForTarpon('BatchJobRunSucceed')
                )
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
        auditLogTopic: this.auditLogTopic,
        batchJobQueue,
      },
      {
        environment: {
          BATCH_JOB_STATE_MACHINE_ARN: batchJobStateMachine.stateMachineArn,
        },
      }
    )
    jobTriggerConsumerAlias.addEventSource(new SqsEventSource(batchJobQueue))

    /* API Metrics Lambda */
    if (!isDevUserStack) {
      const { func: cronJobMidnightHandler } = createFunction(
        this,
        lambdaExecutionRole,
        {
          name: StackConstants.CRON_JOB_MIDNIGHT_FUNCTION_NAME,
          auditLogTopic: this.auditLogTopic,
          batchJobQueue,
        },
        {
          ...functionProps,
        }
      )

      const apiMetricsRule = new Rule(
        this,
        getResourceNameForTarpon('ApiMetricsRule'),
        {
          schedule: Schedule.cron({ minute: '0', hour: '0' }),
        }
      )

      apiMetricsRule.addTarget(new LambdaFunctionTarget(cronJobMidnightHandler))
    }

    /* Tarpon Kinesis Change capture consumer */

    // MongoDB mirror handler
    const tarponChangeConsumerProps = {
      ...functionProps,
      memorySize: config.resource.TARPON_CHANGE_CAPTURE_LAMBDA
        ? config.resource.TARPON_CHANGE_CAPTURE_LAMBDA.MEMORY_SIZE
        : 256,
      environment: functionProps.environment,
    }
    const { alias: tarponChangeCaptureKinesisConsumerAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
        memorySize:
          this.config.resource.TARPON_CHANGE_CONSUMER_LAMBDA.MEMORY_SIZE,
        auditLogTopic: this.auditLogTopic,
        batchJobQueue,
      },
      tarponChangeConsumerProps
    )
    const { alias: tarponChangeCaptureKinesisConsumerRetryAlias } =
      createFunction(
        this,
        lambdaExecutionRole,
        {
          name: StackConstants.TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_RETRY_FUNCTION_NAME,
          auditLogTopic: this.auditLogTopic,
          batchJobQueue,
        },
        tarponChangeConsumerProps
      )
    if (!isDevUserStack) {
      this.createKinesisEventSource(
        tarponChangeCaptureKinesisConsumerAlias,
        tarponStream,
        { startingPosition: StartingPosition.TRIM_HORIZON }
      )
      tarponChangeCaptureKinesisConsumerRetryAlias.addEventSource(
        new SqsEventSource(tarponChangeCaptureRetryQueue)
      )
    }
    // Webhook handler
    const webhookTarponChangeConsumerProps = functionProps
    const { alias: webhookTarponChangeCaptureHandlerAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.WEBHOOK_TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
        auditLogTopic: this.auditLogTopic,
        batchJobQueue,
      },
      webhookTarponChangeConsumerProps
    )
    const { alias: webhookTarponChangeCaptureHandlerRetryAlias } =
      createFunction(
        this,
        lambdaExecutionRole,
        {
          name: StackConstants.WEBHOOK_TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_RETRY_FUNCTION_NAME,
          auditLogTopic: this.auditLogTopic,
          batchJobQueue,
        },
        webhookTarponChangeConsumerProps
      )
    if (!isDevUserStack) {
      this.createKinesisEventSource(
        webhookTarponChangeCaptureHandlerAlias,
        tarponStream
      )
      webhookTarponChangeCaptureHandlerRetryAlias.addEventSource(
        new SqsEventSource(webhookTarponChangeCaptureRetryQueue)
      )
    }

    // Public Sanctions handler
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.PUBLIC_SANCTIONS_API_FUNCTION_NAME,
        auditLogTopic: this.auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /* Hammerhead Kinesis Change capture consumer */
    const hammerheadChangeConsumerProps = {
      ...functionProps,
      memorySize: config.resource.HAMMERHEAD_CHANGE_CAPTURE_LAMBDA
        ? config.resource.HAMMERHEAD_CHANGE_CAPTURE_LAMBDA.MEMORY_SIZE
        : 256,
      environment: functionProps.environment,
    }

    const { alias: hammerheadChangeCaptureKinesisConsumerAlias } =
      createFunction(
        this,
        lambdaExecutionRole,
        {
          name: StackConstants.HAMMERHEAD_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
          auditLogTopic: this.auditLogTopic,
          batchJobQueue,
        },
        hammerheadChangeConsumerProps
      )

    const { alias: hammerheadChangeCaptureKinesisConsumerRetryAlias } =
      createFunction(
        this,
        lambdaExecutionRole,
        {
          name: StackConstants.HAMMERHEAD_CHANGE_CAPTURE_KINESIS_CONSUMER_RETRY_FUNCTION_NAME,
          auditLogTopic: this.auditLogTopic,
          batchJobQueue,
        },
        hammerheadChangeConsumerProps
      )

    const apiCert = Certificate.fromCertificateArn(
      this,
      `api-certificate`,
      config.application.CERTIFICATE_ARN
    )

    if (!isDevUserStack) {
      this.createKinesisEventSource(
        hammerheadChangeCaptureKinesisConsumerAlias,
        hammerheadStream,
        { startingPosition: StartingPosition.TRIM_HORIZON }
      )
      hammerheadChangeCaptureKinesisConsumerRetryAlias.addEventSource(
        new SqsEventSource(hammerheadChangeCaptureRetryQueue)
      )
    }

    /**
     * API Gateway
     * Open Issue: CDK+OpenAPI proper integration - https://github.com/aws/aws-cdk/issues/1461
     */
    let domainName: DomainName | undefined
    if (this.config.stage === 'dev') {
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

    // Public Device Data API
    const { api: publicDeviceDataApi, logGroup: publicDeviceDataApiLogGroup } =
      createApiGateway(this, StackConstants.TARPON_DEVICE_DATA_API_NAME)

    if (domainName) {
      domainName.addBasePathMapping(publicDeviceDataApi, {
        basePath: 'device',
      })
    }

    createAPIGatewayThrottlingAlarm(
      this,
      this.betterUptimeCloudWatchTopic,
      publicDeviceDataApiLogGroup,
      StackConstants.TARPON_DEVICE_DATA_API_GATEWAY_THROTTLING_ALARM_NAME,
      publicDeviceDataApi.restApiName
    )

    // Public Sanctions API
    const { api: publicSanctionsApi, logGroup: publicSanctionsApiLogGroup } =
      createApiGateway(this, StackConstants.TARPON_SANCTIONS_API_NAME)
    if (domainName) {
      domainName.addBasePathMapping(publicSanctionsApi, {
        basePath: 'sanctions',
      })
    }
    createAPIGatewayThrottlingAlarm(
      this,
      this.betterUptimeCloudWatchTopic,
      publicSanctionsApiLogGroup,
      StackConstants.TARPON_SANCTIONS_API_GATEWAY_THROTTLING_ALARM_NAME,
      publicSanctionsApi.restApiName
    )

    if (isDevUserStack) {
      const apiKey = ApiKey.fromApiKeyId(this, `api-key`, getQaApiKey())
      const qaSubdomain = process.env.QA_SUBDOMAIN as string
      const usagePlan = new UsagePlan(this, `usage-plan`, {
        name: `dev-${qaSubdomain}`,
        quota: {
          period: Period.MONTH,
          limit: 10_000,
        },
        apiStages: [
          {
            api: publicDeviceDataApi,
            stage: publicDeviceDataApi.deploymentStage,
          },
          {
            api: publicConsoleApi,
            stage: publicConsoleApi.deploymentStage,
          },
          {
            api: publicApi,
            stage: publicApi.deploymentStage,
          },
          {
            api: publicSanctionsApi,
            stage: publicSanctionsApi.deploymentStage,
          },
        ],
      })
      usagePlan.addApiKey(apiKey)
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
        assumedBy: new ArnPrincipal(
          apiKeyAuthorizerAlias.role?.roleArn as string
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
    }
    new CdkTarponConsoleLambdaStack(
      this,
      `${config.stage}-tarpon-console-api`,
      {
        config,
        lambdaExecutionRole,
        securityGroup,
        vpc,
        auditLogTopic: this.auditLogTopic,
        batchJobQueue,
        webhookDeliveryQueue,
        domainName,
        betterUptimeCloudWatchTopic: this.betterUptimeCloudWatchTopic,
      }
    )

    /**
     * Outputs
     */
    new CfnOutput(this, 'API Gateway endpoint URL - Public API', {
      value: publicApi.urlForPath('/'),
    })
    new CfnOutput(this, 'API Gateway endpoint URL - Public Management API', {
      value: publicConsoleApi.urlForPath('/'),
    })
    new CfnOutput(this, 'API Gateway endpoint URL - Public Device Data API', {
      value: publicDeviceDataApi.urlForPath('/'),
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
    const isDevUserStack = process.env.ENV === 'dev:user'
    if (isDevUserStack) {
      const streamArn = `arn:aws:kinesis:${this.config.env.region}:${this.config.env.account}:stream/${streamName}`
      return Stream.fromStreamArn(this, streamId, streamArn)
    }
    const stream = new Stream(this, streamId, {
      streamName,
      retentionPeriod: retentionPeriod,
      shardCount,
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
      startingPosition: StartingPosition.LATEST,
      ...props,
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

    const vpcCidr = '10.0.0.0/21'
    const vpc = new Vpc(this, 'vpc', {
      vpcName: StackConstants.VPC_NAME,
      cidr: vpcCidr,
      subnetConfiguration: [
        {
          subnetType: SubnetType.PRIVATE_WITH_NAT,
          cidrMask: 24,
          name: 'PrivateSubnet1',
        },
        {
          subnetType: SubnetType.PRIVATE_WITH_NAT,
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

    const securityGroup = new SecurityGroup(
      this,
      StackConstants.VPC_SECURITY_GROUP_ID,
      {
        vpc,
        securityGroupName: StackConstants.VPC_SECURITY_GROUP_ID,
      }
    )
    securityGroup.addIngressRule(Peer.ipv4(vpcCidr), Port.tcp(27017))

    return {
      vpc,
      vpcCidr,
      securityGroup,
    }
  }

  private createQueue(
    queueName: string,
    options?: {
      visibilityTimeout?: Duration
      maxReceiveCount?: number
      fifo?: boolean
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
    })
    return queue
  }
}

const getSubdomain = (): string => {
  if (process.env.ENV === 'dev:user') {
    return `${process.env.QA_SUBDOMAIN}.api`
  }
  if (process.env.ENV === 'sandbox') {
    return `sandbox.api`
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
