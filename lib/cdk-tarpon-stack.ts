import * as cdk from 'aws-cdk-lib'
import { CfnOutput, Duration, Fn, RemovalPolicy, Resource } from 'aws-cdk-lib'
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Metric } from 'aws-cdk-lib/aws-cloudwatch'
import {
  ArnPrincipal,
  Effect,
  IRole,
  ManagedPolicy,
  Policy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam'
import {
  ApiDefinition,
  AssetApiDefinition,
  LogGroupLogDestination,
  MethodLoggingLevel,
  ResponseType,
  SpecRestApi,
} from 'aws-cdk-lib/aws-apigateway'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { Topic, Subscription, SubscriptionProtocol } from 'aws-cdk-lib/aws-sns'

import {
  Alias,
  CfnFunction,
  Code,
  Function as LambdaFunction,
  FunctionProps,
  LayerVersion,
  Runtime,
  StartingPosition,
  ILayerVersion,
  Tracing,
} from 'aws-cdk-lib/aws-lambda'
import { Asset } from 'aws-cdk-lib/aws-s3-assets'

import { Construct } from 'constructs'
import * as s3 from 'aws-cdk-lib/aws-s3'

import { IStream, Stream } from 'aws-cdk-lib/aws-kinesis'
import {
  KinesisEventSource,
  KinesisEventSourceProps,
  SqsEventSource,
} from 'aws-cdk-lib/aws-lambda-event-sources'
import { LogGroup } from 'aws-cdk-lib/aws-logs'

import _ from 'lodash'
import { SqsSubscription } from 'aws-cdk-lib/aws-sns-subscriptions'
import {
  getDeadLetterQueueName,
  getNameForGlobalResource,
  getResourceName,
  getResourceNameForTarpon,
  StackConstants,
} from './constants'
import { Config } from './configs/config'
import { createAPIGatewayThrottlingAlarm } from './cdk-cw-alarms'
import { LAMBDAS } from './lambdas'
import {
  FileImportConfig,
  GetPresignedUrlConfig,
} from '@/lambdas/console-api-file-import/app'
import { TransactionViewConfig } from '@/lambdas/console-api-transaction/app'
import { UserViewConfig } from '@/lambdas/console-api-user/app'

const DEFAULT_LAMBDA_TIMEOUT = Duration.seconds(100)
const DEFAULT_SQS_VISIBILITY_TIMEOUT = Duration.seconds(
  DEFAULT_LAMBDA_TIMEOUT.toSeconds() * 6
)

type InternalFunctionProps = {
  name: string
  provisionedConcurrency?: number
  layers?: Array<ILayerVersion>
  memorySize?: number
}
export class CdkTarponStack extends cdk.Stack {
  config: Config
  cwInsightsLayer: LayerVersion
  betterUptimeCloudWatchTopic: Topic
  auditLogTopic: Topic

  constructor(scope: Construct, id: string, config: Config) {
    super(scope, id, {
      env: config.env,
    })
    this.config = config
    const isDevUserStack = process.env.ENV === 'dev:user'

    /* Cloudwatch Insights Layer (https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Lambda-Insights-extension-versionsx86-64.html) */
    const cwInsightsLayerArn = `arn:aws:lambda:${this.config.env.region}:580247275435:layer:LambdaInsightsExtension:18`
    this.cwInsightsLayer = LayerVersion.fromLayerVersionArn(
      this,
      `LayerFromArn`,
      cwInsightsLayerArn
    ) as LayerVersion

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
      StackConstants.SLACK_ALERT_QUEUE_NAME,
      {
        visibilityTimeout: DEFAULT_SQS_VISIBILITY_TIMEOUT,
      }
    )
    const webhookDeliveryQueue = this.createQueue(
      StackConstants.WEBHOOK_DELIVERY_QUEUE_NAME,
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
    const auditLogQueue = this.createQueue(
      StackConstants.AUDIT_LOG_QUEUE_NAME,
      {
        visibilityTimeout: DEFAULT_SQS_VISIBILITY_TIMEOUT,
        maxReceiveCount: 3,
      }
    )
    this.auditLogTopic.addSubscription(new SqsSubscription(auditLogQueue))

    /*
     * Kinesis Data Streams
     */
    const tarponStream = this.createKinesisStream(
      StackConstants.TARPON_STREAM_ID,
      StackConstants.TARPON_STREAM_NAME,
      Duration.days(3)
    )
    const tarponMongoDbRetryStream = this.createKinesisStream(
      StackConstants.TARPON_MONGODB_RETRY_STREAM_ID,
      StackConstants.TARPON_MONGODB_RETRY_STREAM_ID,
      Duration.days(7)
    )
    const tarponWebhookRetryStream = this.createKinesisStream(
      StackConstants.TARPON_WEBHOOK_RETRY_STREAM_ID,
      StackConstants.TARPON_WEBHOOK_RETRY_STREAM_ID,
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

    const { vpc, vpcCidr, securityGroup } = this.createVpc()

    /**
     * S3 Buckets
     * NOTE: Bucket name needs to be unique across accounts. We append account ID to the
     * logical bucket name.
     */
    let s3ImportBucket
    let s3DocumentBucket
    let s3TmpBucket

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
    }

    /**
     * Lambda Layers
     */

    const fastGeoIpLayer = new LayerVersion(
      this,
      StackConstants.FAST_GEOIP_LAYER_NAME,
      {
        compatibleRuntimes: [Runtime.NODEJS_16_X],
        code: Code.fromAsset('dist/layers/fast-geoip'),
        description: 'fast-geoip npm module',
      }
    )

    /**
     * Lambda Functions
     */

    const atlasFunctionProps: Partial<FunctionProps> = {
      securityGroups: this.shouldUseVpc() ? [securityGroup] : undefined,
      vpc: this.shouldUseVpc() ? vpc : undefined,
      environment: {
        SM_SECRET_ARN: config.application.ATLAS_CREDENTIALS_SECRET_ARN,
      },
    }

    /* API Key Generator */
    const { alias: apiKeyGeneratorAlias } = this.createFunction(
      {
        name: StackConstants.API_KEY_GENERATOR_FUNCTION_NAME,
      },
      atlasFunctionProps
    )
    this.grantMongoDbAccess(apiKeyGeneratorAlias)
    apiKeyGeneratorAlias.role?.attachInlinePolicy(
      new Policy(this, getResourceNameForTarpon('ApiKeyGeneratorPolicy'), {
        policyName: getResourceNameForTarpon('ApiKeyGeneratorPolicy'),
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['apigateway:POST'],
            resources: [
              'arn:aws:apigateway:*::/apikeys',
              'arn:aws:apigateway:*::/usageplans/*/keys',
            ],
          }),
        ],
      })
    )

    /* API Key Authorizer */
    const { alias: apiKeyAuthorizerAlias, func: apiKeyAuthorizerFunction } =
      this.createFunction({
        name: StackConstants.API_KEY_AUTHORIZER_FUNCTION_NAME,
        provisionedConcurrency:
          config.resource.API_KEY_AUTHORIZER_LAMBDA.PROVISIONED_CONCURRENCY,
      })

    /* JWT Authorizer */
    const { alias: jwtAuthorizerAlias, func: jwtAuthorizerFunction } =
      this.createFunction(
        {
          name: StackConstants.JWT_AUTHORIZER_FUNCTION_NAME,
          provisionedConcurrency:
            config.resource.JWT_AUTHORIZER_LAMBDA.PROVISIONED_CONCURRENCY,
        },
        {
          environment: {
            AUTH0_AUDIENCE: config.application.AUTH0_AUDIENCE,
            AUTH0_TOKEN_ISSUER: config.application.AUTH0_TOKEN_ISSUER,
            AUTH0_JWKS_URI: config.application.AUTH0_JWKS_URI,
          },
        }
      )

    /* Transaction and Transaction Event */
    const transactionFunctionProps = {
      provisionedConcurrency:
        config.resource.TRANSACTION_LAMBDA.PROVISIONED_CONCURRENCY,
      layers: [fastGeoIpLayer],
      memorySize: config.resource.TRANSACTION_LAMBDA.MEMORY_SIZE,
    }

    const { alias: transactionAlias } = this.createFunction({
      name: StackConstants.PUBLIC_API_TRANSACTION_FUNCTION_NAME,
      ...transactionFunctionProps,
    })
    tarponDynamoDbTable.grantReadWriteData(transactionAlias)
    tarponRuleDynamoDbTable.grantReadWriteData(transactionAlias)
    hammerheadDynamoDbTable.grantReadData(transactionAlias)

    const { alias: transactionEventAlias } = this.createFunction({
      name: StackConstants.PUBLIC_API_TRANSACTION_EVENT_FUNCTION_NAME,
      ...transactionFunctionProps,
    })
    tarponDynamoDbTable.grantReadWriteData(transactionEventAlias)
    tarponRuleDynamoDbTable.grantReadWriteData(transactionEventAlias)

    /*  User Event */
    const { alias: userEventAlias } = this.createFunction({
      name: StackConstants.PUBLIC_API_USER_EVENT_FUNCTION_NAME,
    })
    tarponDynamoDbTable.grantReadWriteData(userEventAlias)
    tarponRuleDynamoDbTable.grantReadWriteData(userEventAlias)

    /* File Import */
    const { alias: fileImportAlias } = this.createFunction(
      {
        name: StackConstants.CONSOLE_API_FILE_IMPORT_FUNCTION_NAME,
      },
      {
        ...atlasFunctionProps,
        environment: {
          ...atlasFunctionProps.environment,
          IMPORT_BUCKET: importBucketName,
          TMP_BUCKET: tmpBucketName,
        } as FileImportConfig,
        timeout: Duration.minutes(15),
      }
    )
    tarponDynamoDbTable.grantReadWriteData(fileImportAlias)
    s3TmpBucket.grantRead(fileImportAlias)
    s3ImportBucket.grantWrite(fileImportAlias)
    this.grantMongoDbAccess(fileImportAlias)

    const { alias: getPresignedUrlAlias } = this.createFunction(
      {
        name: StackConstants.CONSOLE_API_GET_PRESIGNED_URL_FUNCTION_NAME,
      },
      {
        environment: {
          TMP_BUCKET: tmpBucketName,
        } as GetPresignedUrlConfig,
      }
    )
    s3TmpBucket.grantPut(getPresignedUrlAlias)

    /* Rule Template */
    const { alias: ruleAlias } = this.createFunction(
      {
        name: StackConstants.CONSOLE_API_RULE_FUNCTION_NAME,
      },
      atlasFunctionProps
    )
    tarponDynamoDbTable.grantWriteData(ruleAlias)
    tarponRuleDynamoDbTable.grantReadWriteData(ruleAlias)
    this.grantMongoDbAccess(ruleAlias)

    /* Rule Instance */
    const { alias: ruleInstanceAlias } = this.createFunction(
      {
        name: StackConstants.CONSOLE_API_RULE_INSTANCE_FUNCTION_NAME,
      },
      atlasFunctionProps
    )
    tarponDynamoDbTable.grantReadWriteData(ruleInstanceAlias)
    tarponRuleDynamoDbTable.grantReadWriteData(ruleInstanceAlias)
    this.grantMongoDbAccess(ruleInstanceAlias)

    /* Rule Template (Public) */
    const { alias: publicRuleAlias } = this.createFunction(
      {
        name: StackConstants.PUBLIC_MANAGEMENT_API_RULE_FUNCTION_NAME,
      },
      atlasFunctionProps
    )
    tarponDynamoDbTable.grantReadData(publicRuleAlias)
    tarponRuleDynamoDbTable.grantReadWriteData(publicRuleAlias)

    /* Rule Instance (Public) */
    const { alias: publicRuleInstanceAlias } = this.createFunction(
      {
        name: StackConstants.PUBLIC_MANAGEMENT_API_RULE_INSTANCE_FUNCTION_NAME,
      },
      atlasFunctionProps
    )
    tarponDynamoDbTable.grantReadWriteData(publicRuleInstanceAlias)
    tarponRuleDynamoDbTable.grantReadWriteData(publicRuleInstanceAlias)

    /* Transactions view */
    const { alias: transactionsViewAlias } = this.createFunction(
      {
        name: StackConstants.CONSOLE_API_TRANSACTIONS_VIEW_FUNCTION_NAME,
        memorySize: config.resource.TRANSACTIONS_VIEW_LAMBDA?.MEMORY_SIZE,
      },
      {
        ...atlasFunctionProps,
        environment: {
          ...atlasFunctionProps.environment,
          ...({
            TMP_BUCKET: tmpBucketName,
            DOCUMENT_BUCKET: documentBucketName,
          } as TransactionViewConfig),
        },
      }
    )
    tarponDynamoDbTable.grantReadWriteData(transactionsViewAlias)
    s3TmpBucket.grantRead(transactionsViewAlias)
    s3DocumentBucket.grantWrite(transactionsViewAlias)
    this.grantMongoDbAccess(transactionsViewAlias)

    /* Accounts */
    this.createFunction(
      {
        name: StackConstants.CONSOLE_API_ACCOUNT_FUNCTION_NAME,
      },
      atlasFunctionProps
    )

    /* Tenants */
    this.createFunction(
      {
        name: StackConstants.CONSOLE_API_TENANT_FUNCTION_NAME,
      },
      atlasFunctionProps
    )

    /* Business users view */
    const { alias: businessUsersViewAlias } = this.createFunction(
      {
        name: StackConstants.CONSOLE_API_BUSINESS_USERS_VIEW_FUNCTION_NAME,
        provisionedConcurrency:
          config.resource.USERS_VIEW_LAMBDA.PROVISIONED_CONCURRENCY,
        memorySize: config.resource.USERS_VIEW_LAMBDA.MEMORY_SIZE,
      },
      {
        ...atlasFunctionProps,
        environment: {
          ...atlasFunctionProps.environment,
          ...({
            TMP_BUCKET: tmpBucketName,
            DOCUMENT_BUCKET: documentBucketName,
          } as UserViewConfig),
        },
      }
    )
    this.grantMongoDbAccess(businessUsersViewAlias)

    /* Consumer users view */
    const { alias: consumerUsersViewAlias } = this.createFunction(
      {
        name: StackConstants.CONSOLE_API_CONSUMER_USERS_VIEW_FUNCTION_NAME,
        provisionedConcurrency:
          config.resource.USERS_VIEW_LAMBDA.PROVISIONED_CONCURRENCY,
        memorySize: config.resource.USERS_VIEW_LAMBDA.MEMORY_SIZE,
      },
      {
        ...atlasFunctionProps,
        environment: {
          ...atlasFunctionProps.environment,
          ...({
            TMP_BUCKET: tmpBucketName,
            DOCUMENT_BUCKET: documentBucketName,
          } as UserViewConfig),
        },
      }
    )
    this.grantMongoDbAccess(consumerUsersViewAlias)

    /* All users view */
    const { alias: allUsersViewAlias } = this.createFunction(
      {
        name: StackConstants.CONSOLE_API_ALL_USERS_VIEW_FUNCTION_NAME,
        provisionedConcurrency:
          config.resource.USERS_VIEW_LAMBDA.PROVISIONED_CONCURRENCY,
        memorySize: config.resource.USERS_VIEW_LAMBDA.MEMORY_SIZE,
      },
      {
        ...atlasFunctionProps,
        environment: {
          ...atlasFunctionProps.environment,
          ...({
            TMP_BUCKET: tmpBucketName,
            DOCUMENT_BUCKET: documentBucketName,
          } as UserViewConfig),
        },
      }
    )
    this.grantMongoDbAccess(allUsersViewAlias)

    /* dashboard stats */
    const { alias: dashboardStatsAlias } = this.createFunction(
      {
        name: StackConstants.CONSOLE_API_DASHBOARD_STATS_FUNCTION_NAME,
        provisionedConcurrency:
          config.resource.DASHBOARD_LAMBDA.PROVISIONED_CONCURRENCY,
        memorySize: config.resource.DASHBOARD_LAMBDA.MEMORY_SIZE,
      },
      atlasFunctionProps
    )
    this.grantMongoDbAccess(dashboardStatsAlias)
    hammerheadDynamoDbTable.grantReadData(dashboardStatsAlias)

    /* User */
    const { alias: userAlias } = this.createFunction({
      name: StackConstants.PUBLIC_API_USER_FUNCTION_NAME,
      provisionedConcurrency:
        config.resource.USER_LAMBDA.PROVISIONED_CONCURRENCY,
      memorySize: config.resource.USER_LAMBDA.MEMORY_SIZE,
    })
    tarponDynamoDbTable.grantReadWriteData(userAlias)
    hammerheadDynamoDbTable.grantReadWriteData(userAlias)

    /* List Importer */
    const { alias: listsAlias } = this.createFunction({
      name: StackConstants.CONSOLE_API_LISTS_FUNCTION_NAME,
    })
    tarponDynamoDbTable.grantReadWriteData(listsAlias)

    /* Case */
    const { alias: caseAlias } = this.createFunction(
      {
        name: StackConstants.CONSOLE_API_CASE_FUNCTION_NAME,
        memorySize: config.resource.CASE_LAMBDA?.MEMORY_SIZE,
      },
      {
        ...atlasFunctionProps,
        environment: {
          ...atlasFunctionProps.environment,
          ...({
            TMP_BUCKET: tmpBucketName,
            DOCUMENT_BUCKET: documentBucketName,
          } as TransactionViewConfig),
        },
      }
    )
    tarponDynamoDbTable.grantReadWriteData(caseAlias)
    s3TmpBucket.grantRead(caseAlias)
    s3DocumentBucket.grantWrite(caseAlias)
    this.grantMongoDbAccess(caseAlias)

    /* AuditLog */
    const { alias: auditLogAlias } = this.createFunction(
      {
        name: StackConstants.AUDIT_LOG_FUNCTION_NAME,
      },
      {
        ...atlasFunctionProps,
        environment: {
          ...atlasFunctionProps.environment,
        },
      }
    )
    this.grantMongoDbAccess(auditLogAlias)

    /* Slack App */
    const { alias: slackAppAlias } = this.createFunction(
      {
        name: StackConstants.SLACK_APP_FUNCTION_NAME,
      },
      {
        ...atlasFunctionProps,
        environment: {
          ...atlasFunctionProps.environment,
          SLACK_CLIENT_ID: config.application.SLACK_CLIENT_ID,
          SLACK_CLIENT_SECRET: config.application.SLACK_CLIENT_SECRET,
          SLACK_REDIRECT_URI: config.application.SLACK_REDIRECT_URI,
        },
      }
    )
    this.grantMongoDbAccess(slackAppAlias)

    const { alias: slackAlertAlias } = this.createFunction(
      {
        name: StackConstants.SLACK_ALERT_FUNCTION_NAME,
      },
      {
        ...atlasFunctionProps,
        environment: {
          ...atlasFunctionProps.environment,
          SLACK_CLIENT_ID: config.application.SLACK_CLIENT_ID,
          SLACK_CLIENT_SECRET: config.application.SLACK_CLIENT_SECRET,
          SLACK_REDIRECT_URI: config.application.SLACK_REDIRECT_URI,
          CONSOLE_URI: config.application.CONSOLE_URI,
        },
      }
    )
    this.grantMongoDbAccess(slackAlertAlias)
    tarponDynamoDbTable.grantReadData(slackAlertAlias)
    slackAlertQueue.grantConsumeMessages(slackAlertAlias)
    slackAlertAlias.addEventSource(
      // We set batch size to 1 then in case of error, we don't resend the already-sent alerts
      new SqsEventSource(slackAlertQueue, { batchSize: 1 })
    )

    /* Webhook */
    const { alias: webhookDelivererAlias } = this.createFunction(
      {
        name: StackConstants.WEBHOOK_DELIVERER_FUNCTION_NAME,
      },
      atlasFunctionProps
    )
    this.grantMongoDbAccess(webhookDelivererAlias)
    this.grantSecretsManagerAccessByPrefix(
      webhookDelivererAlias,
      'webhooks',
      'READ'
    )
    webhookDeliveryQueue.grantConsumeMessages(webhookDelivererAlias)
    webhookDelivererAlias.addEventSource(
      new SqsEventSource(webhookDeliveryQueue, { batchSize: 1 })
    )

    const { alias: webhookConfigurationHandlerAlias } = this.createFunction(
      {
        name: StackConstants.CONSOLE_API_WEBHOOK_CONFIGURATION_FUNCTION_NAME,
      },
      atlasFunctionProps
    )
    this.grantMongoDbAccess(webhookConfigurationHandlerAlias)
    this.grantSecretsManagerAccessByPrefix(
      webhookConfigurationHandlerAlias,
      'webhooks',
      'READ_WRITE'
    )

    /* Audit Log */
    const { alias: auditLogConsumerAlias } = this.createFunction(
      {
        name: StackConstants.AUDIT_LOG_CONSUMER_FUNCTION_NAME,
      },
      atlasFunctionProps
    )
    this.grantMongoDbAccess(auditLogConsumerAlias)
    auditLogQueue.grantConsumeMessages(auditLogConsumerAlias)
    auditLogConsumerAlias.addEventSource(new SqsEventSource(auditLogQueue))

    /*
     * Hammerhead console functions
     */
    /* Risk Classification function */
    const { alias: riskClassificationAlias } = this.createFunction(
      {
        name: StackConstants.CONSOLE_API_RISK_CLASSIFICATION_FUNCTION_NAME,
      },
      atlasFunctionProps
    )
    hammerheadDynamoDbTable.grantReadWriteData(riskClassificationAlias)

    /* Manual User Risk Assignment function */
    const { alias: manualUserRiskAssignmentAlias } = this.createFunction({
      name: StackConstants.CONSOLE_API_MANUAL_USER_RISK_ASSIGNMENT_FUNCTION_NAME,
    })
    hammerheadDynamoDbTable.grantReadWriteData(manualUserRiskAssignmentAlias)

    /* Parameter risk level assignment function */
    const { alias: parameterRiskAssignmentAlias } = this.createFunction({
      name: StackConstants.CONSOLE_API_PARAMETER_RISK_ASSIGNMENT_FUNCTION_NAME,
    })
    hammerheadDynamoDbTable.grantReadWriteData(parameterRiskAssignmentAlias)

    /* Get Risk Scores */
    const { alias: riskLevelAndScoreAlias } = this.createFunction(
      {
        name: StackConstants.CONSOLE_API_RISK_LEVEL_AND_SCORE_FUNCTION_NAME,
      },
      atlasFunctionProps
    )
    hammerheadDynamoDbTable.grantReadWriteData(riskLevelAndScoreAlias)
    this.grantMongoDbAccess(riskLevelAndScoreAlias)

    /* Tarpon Kinesis Change capture consumer */

    // MongoDB mirror handler
    const tarponChangeConsumerProps = {
      ...atlasFunctionProps,
      memorySize: config.resource.TARPON_CHANGE_CAPTURE_LAMBDA
        ? config.resource.TARPON_CHANGE_CAPTURE_LAMBDA.MEMORY_SIZE
        : 256,
      environment: {
        ...atlasFunctionProps.environment,
        SLACK_ALERT_QUEUE_URL: slackAlertQueue.queueUrl,
        RETRY_KINESIS_STREAM_NAME: tarponMongoDbRetryStream.streamName,
      },
      timeout: Duration.minutes(15),
    }
    const { alias: tarponChangeCaptureKinesisConsumerAlias } =
      this.createFunction(
        {
          name: StackConstants.TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
        },
        tarponChangeConsumerProps
      )
    const { alias: tarponChangeCaptureKinesisConsumerRetryAlias } =
      this.createFunction(
        {
          name: StackConstants.TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_RETRY_FUNCTION_NAME,
        },
        tarponChangeConsumerProps
      )
    if (!isDevUserStack) {
      this.createKinesisEventSource(
        StackConstants.TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
        tarponChangeCaptureKinesisConsumerAlias,
        tarponStream,
        { startingPosition: StartingPosition.TRIM_HORIZON }
      )
      this.createKinesisEventSourceForRetry(
        tarponChangeCaptureKinesisConsumerRetryAlias,
        tarponMongoDbRetryStream
      )
    }
    tarponMongoDbRetryStream.grantWrite(tarponChangeCaptureKinesisConsumerAlias)
    transientDynamoDbTable.grantReadWriteData(
      tarponChangeCaptureKinesisConsumerAlias
    )
    transientDynamoDbTable.grantReadWriteData(
      tarponChangeCaptureKinesisConsumerRetryAlias
    )
    this.grantMongoDbAccess(tarponChangeCaptureKinesisConsumerAlias)
    this.grantMongoDbAccess(tarponChangeCaptureKinesisConsumerRetryAlias)
    slackAlertQueue.grantSendMessages(tarponChangeCaptureKinesisConsumerAlias)
    slackAlertQueue.grantSendMessages(
      tarponChangeCaptureKinesisConsumerRetryAlias
    )
    tarponDynamoDbTable.grantReadData(tarponChangeCaptureKinesisConsumerAlias)
    tarponDynamoDbTable.grantReadData(
      tarponChangeCaptureKinesisConsumerRetryAlias
    )
    tarponRuleDynamoDbTable.grantReadData(
      tarponChangeCaptureKinesisConsumerAlias
    )
    tarponRuleDynamoDbTable.grantReadData(
      tarponChangeCaptureKinesisConsumerRetryAlias
    )
    hammerheadDynamoDbTable.grantReadWriteData(
      tarponChangeCaptureKinesisConsumerAlias
    )
    hammerheadDynamoDbTable.grantReadWriteData(
      tarponChangeCaptureKinesisConsumerRetryAlias
    )

    // Webhook handler
    const webhookTarponChangeConsumerProps = {
      ...atlasFunctionProps,
      environment: {
        ...atlasFunctionProps.environment,
        WEBHOOK_DELIVERY_QUEUE_URL: webhookDeliveryQueue.queueUrl,
        RETRY_KINESIS_STREAM_NAME: tarponWebhookRetryStream.streamName,
      },
      timeout: Duration.minutes(15),
    }
    const { alias: webhookTarponChangeCaptureHandlerAlias } =
      this.createFunction(
        {
          name: StackConstants.WEBHOOK_TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
        },
        webhookTarponChangeConsumerProps
      )
    const { alias: webhookTarponChangeCaptureHandlerRetryAlias } =
      this.createFunction(
        {
          name: StackConstants.WEBHOOK_TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_RETRY_FUNCTION_NAME,
        },
        webhookTarponChangeConsumerProps
      )
    if (!isDevUserStack) {
      this.createKinesisEventSource(
        StackConstants.WEBHOOK_TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
        webhookTarponChangeCaptureHandlerAlias,
        tarponStream
      )
      this.createKinesisEventSourceForRetry(
        webhookTarponChangeCaptureHandlerRetryAlias,
        tarponWebhookRetryStream
      )
    }
    tarponWebhookRetryStream.grantWrite(webhookTarponChangeCaptureHandlerAlias)
    webhookDeliveryQueue.grantSendMessages(
      webhookTarponChangeCaptureHandlerAlias
    )
    webhookDeliveryQueue.grantSendMessages(
      webhookTarponChangeCaptureHandlerRetryAlias
    )
    transientDynamoDbTable.grantReadWriteData(
      webhookTarponChangeCaptureHandlerAlias
    )
    transientDynamoDbTable.grantReadWriteData(
      webhookTarponChangeCaptureHandlerRetryAlias
    )
    this.grantMongoDbAccess(webhookTarponChangeCaptureHandlerAlias)
    this.grantMongoDbAccess(webhookTarponChangeCaptureHandlerRetryAlias)

    // Sanctions handler
    const { alias: sanctionsHandlerAlias } = this.createFunction(
      {
        name: StackConstants.SANCTIONS_FUNCTION_NAME,
      },
      {
        ...atlasFunctionProps,
        environment: {
          ...atlasFunctionProps.environment,
          COMPLYADVANTAGE_API_KEY: process.env
            .COMPLYADVANTAGE_API_KEY as string,
        },
      }
    )
    this.grantMongoDbAccess(sanctionsHandlerAlias)
    this.grantSecretsManagerAccess(
      sanctionsHandlerAlias,
      [this.config.application.COMPLYADVANTAGE_CREDENTIALS_SECRET_ARN],
      'READ'
    )

    /* Hammerhead Kinesis Change capture consumer */

    const { alias: hammerheadChangeCaptureKinesisConsumerAlias } =
      this.createFunction(
        {
          name: StackConstants.HAMMERHEAD_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
        },
        {
          ...atlasFunctionProps,
          timeout: Duration.minutes(15),
        }
      )

    if (!isDevUserStack) {
      this.createKinesisEventSource(
        StackConstants.HAMMERHEAD_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
        hammerheadChangeCaptureKinesisConsumerAlias,
        hammerheadStream,
        { startingPosition: StartingPosition.TRIM_HORIZON }
      )
    }
    this.grantMongoDbAccess(hammerheadChangeCaptureKinesisConsumerAlias)

    /**
     * API Gateway
     * Open Issue: CDK+OpenAPI proper integration - https://github.com/aws/aws-cdk/issues/1461
     */

    // Public API
    const { api: publicApi, logGroup: publicApiLogGroup } =
      this.createApiGateway(StackConstants.TARPON_API_NAME)

    createAPIGatewayThrottlingAlarm(
      this,
      this.betterUptimeCloudWatchTopic,
      publicApiLogGroup,
      StackConstants.TARPON_API_GATEWAY_THROTTLING_ALARM_NAME,
      publicApi.restApiName
    )

    // Public Console API
    const { api: publicConsoleApi, logGroup: publicConsoleApiLogGroup } =
      this.createApiGateway(StackConstants.TARPON_MANAGEMENT_API_NAME)

    createAPIGatewayThrottlingAlarm(
      this,
      this.betterUptimeCloudWatchTopic,
      publicConsoleApiLogGroup,
      StackConstants.TARPON_MANAGEMENT_API_GATEWAY_THROTTLING_ALARM_NAME,
      publicConsoleApi.restApiName
    )

    // Console API
    const { api: consoleApi, logGroup: consoleApiLogGroup } =
      this.createApiGateway(StackConstants.CONSOLE_API_NAME)

    createAPIGatewayThrottlingAlarm(
      this,
      this.betterUptimeCloudWatchTopic,
      consoleApiLogGroup,
      StackConstants.CONSOLE_API_GATEWAY_THROTTLING_ALARM_NAME,
      consoleApi.restApiName
    )

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

    const jwtAuthorizerBaseRoleName = getNameForGlobalResource(
      StackConstants.JWT_AUTHORIZER_BASE_ROLE_NAME,
      config
    )
    const jwtAuthorizerBaseRole = new Role(this, jwtAuthorizerBaseRoleName, {
      roleName: jwtAuthorizerBaseRoleName,
      assumedBy: new ArnPrincipal(jwtAuthorizerAlias.role?.roleArn as string),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('PowerUserAccess'),
      ],
    })
    jwtAuthorizerAlias.role?.attachInlinePolicy(
      new Policy(this, getResourceNameForTarpon('JwtAuthorizerPolicy'), {
        policyName: getResourceNameForTarpon('JwtAuthorizerPolicy'),
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['sts:AssumeRole'],
            resources: [jwtAuthorizerBaseRole.roleArn],
          }),
        ],
      })
    )
    jwtAuthorizerFunction.addEnvironment(
      'AUTHORIZER_BASE_ROLE_ARN',
      jwtAuthorizerBaseRole.roleArn
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
    new CfnOutput(this, 'API Gateway endpoint URL - Console API', {
      value: consoleApi.urlForPath('/'),
    })
    if (this.shouldUseVpc()) {
      new CfnOutput(this, 'Lambda VPC ID', {
        value: vpc.vpcId,
      })
      new CfnOutput(this, 'Lambda VPC CIDR', {
        value: vpcCidr,
      })
    }
  }

  // IMPORTANT: We should use the returned `alias` for granting further roles.
  // We should only use the returned `func` to do the things that alias cannot do
  // (e.g add environment variables)
  private createFunction(
    internalFunctionProps: InternalFunctionProps,
    props: Partial<FunctionProps> = {}
  ): { alias: Alias; func: LambdaFunction } {
    const { layers, name, memorySize, provisionedConcurrency } =
      internalFunctionProps
    const layersArray = layers ? [...layers] : []
    if (
      !layersArray.includes(this.cwInsightsLayer) &&
      this.config.stage !== 'local'
    ) {
      layersArray.push(this.cwInsightsLayer)
    }
    const { handlerName } = LAMBDAS[name]
    if (!handlerName) {
      throw new Error(`Unknown lambda ${name}!`)
    }
    const func = new LambdaFunction(this, name, {
      functionName: name,
      runtime: Runtime.NODEJS_16_X,
      handler: `app.${handlerName}`,
      code: Code.fromAsset(`dist/${LAMBDAS[name].codePath}`),
      tracing: Tracing.ACTIVE,
      timeout: DEFAULT_LAMBDA_TIMEOUT,
      memorySize: memorySize
        ? memorySize
        : this.config.resource.LAMBDA_DEFAULT.MEMORY_SIZE,
      layers: layersArray,
      ...{
        ...props,
        environment: {
          ...props.environment,
          ENV: this.config.stage,
          ...{
            ...Object.entries(this.config.application).reduce(
              (acc: Record<string, string>, [key, value]) => ({
                ...acc,
                [key]: `${value}`,
              }),
              {}
            ),
          },
          AWS_XRAY_CONTEXT_MISSING: 'LOG_ERROR',
          AUDITLOG_TOPIC_ARN: this.auditLogTopic?.topicArn,
          // NOTE: RELEASE_VERSION and LAMBDA_CODE_PATH used for Sentry
          RELEASE_VERSION: process.env.RELEASE_VERSION as string,
          LAMBDA_CODE_PATH: LAMBDAS[name].codePath,
        },
      },
    })
    // This is needed to allow using ${Function.Arn} in openapi.yaml
    ;(func.node.defaultChild as CfnFunction).overrideLogicalId(name)

    // Alias is required for setting provisioned concurrency. We always create
    // an alias for a lambda even it has no provisioned concurrency.
    const alias = new Alias(
      this,
      `${name}:${StackConstants.LAMBDA_LATEST_ALIAS_NAME}`,
      {
        aliasName: StackConstants.LAMBDA_LATEST_ALIAS_NAME,
        version: func.currentVersion,
        provisionedConcurrentExecutions: provisionedConcurrency,
      }
    )
    // This is needed because of the usage of SpecRestApi
    alias.grantInvoke(new ServicePrincipal('apigateway.amazonaws.com'))
    // Add permissions for lambda insights in cloudWatch
    alias.role?.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName(
        'CloudWatchLambdaInsightsExecutionRolePolicy'
      )
    )
    Metric.grantPutMetricData(alias)
    this.auditLogTopic?.grantPublish(alias)
    return { alias, func }
  }

  private grantMongoDbAccess(resource: Resource & { role?: IRole }) {
    const aliasIdentifier = resource.node.id.replace(/:/g, '-')
    resource.role?.attachInlinePolicy(
      new Policy(this, `${aliasIdentifier}-MongoDbPolicy`, {
        policyName: `${aliasIdentifier}-MongoDbPolicy`,
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['secretsmanager:GetSecretValue'],
            resources: [this.config.application.ATLAS_CREDENTIALS_SECRET_ARN],
          }),
        ],
      })
    )
  }

  private grantSecretsManagerAccessByPrefix(
    alias: Alias,
    prefix: string,
    mode: 'READ' | 'WRITE' | 'READ_WRITE'
  ) {
    this.grantSecretsManagerAccess(
      alias,
      [`arn:aws:secretsmanager:*:*:secret:*/${prefix}/*`],
      mode
    )
  }

  private grantSecretsManagerAccess(
    resource: Resource & { role?: IRole },
    resources: string[],
    mode: 'READ' | 'WRITE' | 'READ_WRITE'
  ) {
    const aliasIdentifier = resource.node.id.replace(/:/g, '-')
    const actions = []
    if (mode === 'READ' || mode === 'READ_WRITE') {
      actions.push('secretsmanager:GetSecretValue')
    }
    if (mode === 'WRITE' || mode === 'READ_WRITE') {
      actions.push('secretsmanager:CreateSecret')
      actions.push('secretsmanager:DeleteSecret')
    }
    resource.role?.attachInlinePolicy(
      new Policy(this, `${aliasIdentifier}-SecretsManagerPolicy`, {
        policyName: `${aliasIdentifier}-SecretsManagerPolicy`,
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: actions,
            resources,
          }),
        ],
      })
    )
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
    functionName: string,
    alias: Alias,
    stream: IStream,
    props?: Partial<KinesisEventSourceProps>
  ) {
    const eventSource = new KinesisEventSource(stream, {
      batchSize: 10,
      startingPosition: StartingPosition.LATEST,
      ...props,
    })
    alias.addEventSource(eventSource)
  }

  private createKinesisEventSourceForRetry(
    alias: Alias,
    stream: IStream,
    props?: Partial<KinesisEventSourceProps>
  ) {
    // If there're less than 10000 pending records in the stream, we'll retry evety 5 minutes
    // we should fix the error before it reaches 10000 records
    const eventSource = new KinesisEventSource(stream, {
      batchSize: 10000, // max possible value
      maxBatchingWindow: Duration.minutes(5), // max possible value
      startingPosition: StartingPosition.LATEST,
      ...props,
    })
    alias.addEventSource(eventSource)
  }

  private createApiGateway(apiName: string): {
    api: SpecRestApi
    logGroup: LogGroup
  } {
    // Log group ID cannot be changed
    let logGroupId: string
    let openapiName: 'public' | 'public-management' | 'internal'
    if (apiName === StackConstants.TARPON_API_NAME) {
      openapiName = 'public'
      logGroupId = 'LogGroupPublicApi'
    } else if (apiName === StackConstants.TARPON_MANAGEMENT_API_NAME) {
      openapiName = 'public-management'
      logGroupId = 'LogGroupPublicManagementApi'
    } else if (apiName === StackConstants.CONSOLE_API_NAME) {
      openapiName = 'internal'
      logGroupId = 'LogGroupConsoleApi'
    } else {
      throw new Error(`Cannot find openapi for ${apiName}`)
    }

    const OPENAPI_PATH = `./dist/openapi/openapi-${openapiName}-autogenerated-${this.config.stage}.yaml`
    let apiDefinition: ApiDefinition
    if (this.config.stage === 'local') {
      apiDefinition = ApiDefinition.fromAsset(OPENAPI_PATH)
    } else {
      const openApiAsset = new Asset(this, `${openapiName}-openapi-asset`, {
        path: OPENAPI_PATH,
      })
      const openApiData = Fn.transform('AWS::Include', {
        Location: openApiAsset.s3ObjectUrl,
      })
      apiDefinition = AssetApiDefinition.fromInline(openApiData)
    }
    const logGroupName = getResourceName(
      `API-Gateway-Execution-Logs_${apiName}`
    )
    const apiLogGroup = new LogGroup(this, logGroupId, {
      logGroupName,
      removalPolicy:
        this.config.stage === 'dev'
          ? RemovalPolicy.DESTROY
          : RemovalPolicy.RETAIN,
    })
    const restApi = new SpecRestApi(this, apiName, {
      restApiName: apiName,
      apiDefinition,
      deployOptions: {
        loggingLevel: MethodLoggingLevel.INFO,
        tracingEnabled: true,
        accessLogDestination: new LogGroupLogDestination(apiLogGroup),
      },
    })
    const apiValidationErrorTemplate = {
      'application/json':
        '{ "message": $context.error.messageString, "validationErrors": "$context.error.validationErrorString" }',
    }
    restApi.addGatewayResponse('BadRequestBodyValidationResponse', {
      type: ResponseType.BAD_REQUEST_BODY,
      statusCode: '400',
      templates: apiValidationErrorTemplate,
    })
    restApi.addGatewayResponse('BadRequestParametersValidationResponse', {
      type: ResponseType.BAD_REQUEST_PARAMETERS,
      statusCode: '400',
      templates: apiValidationErrorTemplate,
    })
    return {
      api: restApi,
      logGroup: apiLogGroup,
    }
  }

  private shouldUseVpc() {
    return (
      this.config.resource.LAMBDA_VPC_ENABLED &&
      this.config.stage !== 'local' &&
      process.env.ENV !== 'dev:user'
    )
  }

  private createVpc() {
    if (this.config.stage === 'local' || process.env.ENV === 'dev:user') {
      return {
        vpc: null,
        vpcCidr: null,
        securityGroup: null,
      } as any
    }

    const vpcCidr = '10.0.0.0/21'
    const vpc = new ec2.Vpc(this, 'vpc', {
      cidr: vpcCidr,
      subnetConfiguration: [
        {
          subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
          cidrMask: 24,
          name: 'PrivateSubnet1',
        },
        {
          subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
          cidrMask: 24,
          name: 'PrivateSubnet2',
        },
        {
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 28,
          name: 'PublicSubnet1',
        },
      ],
    })

    const securityGroup = new ec2.SecurityGroup(
      this,
      StackConstants.MONGO_DB_SECURITY_GROUP_NAME,
      {
        vpc,
        securityGroupName: StackConstants.MONGO_DB_SECURITY_GROUP_NAME,
      }
    )
    securityGroup.addIngressRule(ec2.Peer.ipv4(vpcCidr), ec2.Port.tcp(27017))

    return {
      vpc,
      vpcCidr,
      securityGroup,
    }
  }

  private createQueue(
    queueName: string,
    options: {
      visibilityTimeout?: Duration
      maxReceiveCount?: number
    }
  ): Queue {
    const deadLetterQueue = new Queue(this, getDeadLetterQueueName(queueName))
    const queue = new Queue(this, queueName, {
      visibilityTimeout: options.visibilityTimeout,
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: options.maxReceiveCount || 30,
      },
    })
    return queue
  }
}
