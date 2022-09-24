import * as cdk from 'aws-cdk-lib'
import { CfnOutput, Duration, Fn, RemovalPolicy, Resource } from 'aws-cdk-lib'
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb'
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
  SqsEventSource,
} from 'aws-cdk-lib/aws-lambda-event-sources'
import { LogGroup } from 'aws-cdk-lib/aws-logs'

import _ from 'lodash'
import {
  getNameForGlobalResource,
  getResourceName,
  getResourceNameForTarpon,
  StackConstants,
} from './constants'
import { Config } from './configs/config'
import {
  createTarponOverallLambdaAlarm,
  createKinesisAlarm,
  createAPIGatewayAlarm,
  dynamoTableOperations,
  createDynamoDBAlarm,
  dynamoTableOperationMetrics,
  createAPIGatewayThrottlingAlarm,
  createLambdaErrorPercentageAlarm,
  createLambdaThrottlingAlarm,
} from './cdk-cw-alarms'
import {
  FileImportConfig,
  GetPresignedUrlConfig,
} from '@/lambdas/console-api-file-import/app'
import { TransactionViewConfig } from '@/lambdas/console-api-transaction/app'
import { UserViewConfig } from '@/lambdas/console-api-user/app'

const DEFAULT_LAMBDA_TIMEOUT = Duration.seconds(100)

type InternalFunctionProps = {
  name: string
  handler: string
  codePath: string
  provisionedConcurrency?: number
  layers?: Array<ILayerVersion>
  memorySize?: number
}
export class CdkTarponStack extends cdk.Stack {
  config: Config
  cwInsightsLayer: LayerVersion
  betterUptimeCloudWatchTopic: Topic
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

    const slackAlertQueue = new Queue(
      this,
      StackConstants.SLACK_ALERT_QUEUE_NAME,
      {
        visibilityTimeout: Duration.seconds(
          DEFAULT_LAMBDA_TIMEOUT.toSeconds() * 6
        ),
      }
    )

    const webhookDeliveryDeadLetterQueue = new Queue(
      this,
      StackConstants.WEBHOOK_DELIVERY_DLQ_NAME
    )
    const webhookDeliveryVisibilityTimeout = Duration.seconds(
      DEFAULT_LAMBDA_TIMEOUT.toSeconds() * 6
    )
    const webhookDeliveryQueue = new Queue(
      this,
      StackConstants.WEBHOOK_DELIVERY_QUEUE_NAME,
      {
        visibilityTimeout: webhookDeliveryVisibilityTimeout,
        deadLetterQueue: {
          queue: webhookDeliveryDeadLetterQueue,
          // Retry up to 3 days
          maxReceiveCount:
            Duration.days(3).toSeconds() /
            webhookDeliveryVisibilityTimeout.toSeconds(),
        },
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
      tarponStream
    )
    const hammerheadDynamoDbTable = this.createDynamodbTable(
      StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      hammerheadStream
    )
    const transientDynamoDbTable = this.createDynamodbTable(
      StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME
    )

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

    const atlasFunctionProps = {
      // TODO: Re-enable VPC https://flagright.atlassian.net/browse/FDT-190
      // securityGroups: [atlasSg],
      // vpc: atlasVpc,
      environment: {
        SM_SECRET_ARN: config.application.ATLAS_CREDENTIALS_SECRET_ARN,
      },
    }

    /* API Key Generator */
    const { alias: apiKeyGeneratorAlias } = this.createFunction(
      {
        name: StackConstants.API_KEY_GENERATOR_FUNCTION_NAME,
        handler: 'app.apiKeyGeneratorHandler',
        codePath: 'dist/api-key-generator',
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
        handler: 'app.apiKeyAuthorizer',
        codePath: 'dist/api-key-authorizer',
        provisionedConcurrency:
          config.resource.API_KEY_AUTHORIZER_LAMBDA.PROVISIONED_CONCURRENCY,
      })

    /* JWT Authorizer */
    const { alias: jwtAuthorizerAlias, func: jwtAuthorizerFunction } =
      this.createFunction(
        {
          name: StackConstants.JWT_AUTHORIZER_FUNCTION_NAME,
          handler: 'app.jwtAuthorizer',
          codePath: 'dist/jwt-authorizer',
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

    /* Transaction */
    const { alias: transactionAlias } = this.createFunction({
      name: StackConstants.PUBLIC_API_TRANSACTION_FUNCTION_NAME,
      handler: 'app.transactionHandler',
      codePath: 'dist/public-api-rules-engine',
      provisionedConcurrency:
        config.resource.TRANSACTION_LAMBDA.PROVISIONED_CONCURRENCY,
      layers: [fastGeoIpLayer],
      memorySize: config.resource.TRANSACTION_LAMBDA.MEMORY_SIZE,
    })
    tarponDynamoDbTable.grantReadWriteData(transactionAlias)
    hammerheadDynamoDbTable.grantReadData(transactionAlias)

    /* Transaction Event */
    const { alias: transactionEventAlias } = this.createFunction({
      name: StackConstants.PUBLIC_API_TRANSACTION_EVENT_FUNCTION_NAME,
      handler: 'app.transactionEventHandler',
      codePath: 'dist/public-api-rules-engine',
    })
    tarponDynamoDbTable.grantReadWriteData(transactionEventAlias)

    /*  User Event */
    const { alias: userEventAlias } = this.createFunction({
      name: StackConstants.PUBLIC_API_USER_EVENT_FUNCTION_NAME,
      handler: 'app.userEventsHandler',
      codePath: 'dist/public-api-rules-engine',
    })
    tarponDynamoDbTable.grantReadWriteData(userEventAlias)

    /* File Import */
    const { alias: fileImportAlias } = this.createFunction(
      {
        name: StackConstants.CONSOLE_API_FILE_IMPORT_FUNCTION_NAME,
        handler: 'app.fileImportHandler',
        codePath: 'dist/console-api-file-import/',
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
        handler: 'app.getPresignedUrlHandler',
        codePath: 'dist/console-api-file-import/',
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
        handler: 'app.ruleHandler',
        codePath: 'dist/console-api-rule/',
      },
      atlasFunctionProps
    )
    tarponDynamoDbTable.grantWriteData(ruleAlias)
    this.grantMongoDbAccess(ruleAlias)

    /* Rule Instance */
    const { alias: ruleInstanceAlias } = this.createFunction(
      {
        name: StackConstants.CONSOLE_API_RULE_INSTANCE_FUNCTION_NAME,
        handler: 'app.ruleInstanceHandler',
        codePath: 'dist/console-api-rule/',
      },
      atlasFunctionProps
    )
    tarponDynamoDbTable.grantReadWriteData(ruleInstanceAlias)
    this.grantMongoDbAccess(ruleInstanceAlias)

    /* Transactions view */
    const { alias: transactionsViewAlias } = this.createFunction(
      {
        name: StackConstants.CONSOLE_API_TRANSACTIONS_VIEW_FUNCTION_NAME,
        handler: 'app.transactionsViewHandler',
        codePath: 'dist/console-api-transaction/',
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
        handler: 'app.accountsHandler',
        codePath: 'dist/console-api-account/',
      },
      atlasFunctionProps
    )

    /* Tenants */
    this.createFunction(
      {
        name: StackConstants.CONSOLE_API_TENANT_FUNCTION_NAME,
        handler: 'app.tenantsHandler',
        codePath: 'dist/console-api-tenant/',
      },
      atlasFunctionProps
    )

    /* Business users view */
    const { alias: businessUsersViewAlias } = this.createFunction(
      {
        name: StackConstants.CONSOLE_API_BUSINESS_USERS_VIEW_FUNCTION_NAME,
        handler: 'app.businessUsersViewHandler',
        codePath: 'dist/console-api-user/',
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
        handler: 'app.consumerUsersViewHandler',
        codePath: 'dist/console-api-user/',
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

    /* dashboard stats */
    const { alias: dashboardStatsAlias } = this.createFunction(
      {
        name: StackConstants.CONSOLE_API_DASHBOARD_STATS_TRANSACTIONS_FUNCTION_NAME,
        handler: 'app.dashboardStatsHandler',
        codePath: 'dist/console-api-dashboard/',
        provisionedConcurrency:
          config.resource.DASHBOARD_LAMBDA.PROVISIONED_CONCURRENCY,
        memorySize: config.resource.DASHBOARD_LAMBDA.MEMORY_SIZE,
      },
      atlasFunctionProps
    )
    this.grantMongoDbAccess(dashboardStatsAlias)

    /* User */
    const { alias: userAlias } = this.createFunction({
      name: StackConstants.PUBLIC_API_USER_FUNCTION_NAME,
      handler: 'app.userHandler',
      codePath: 'dist/public-api-user-management',
      provisionedConcurrency:
        config.resource.USER_LAMBDA.PROVISIONED_CONCURRENCY,
      memorySize: config.resource.USER_LAMBDA.MEMORY_SIZE,
    })
    tarponDynamoDbTable.grantReadWriteData(userAlias)

    /* List Importer */
    const { alias: listsAlias } = this.createFunction({
      name: StackConstants.CONSOLE_API_LISTS_FUNCTION_NAME,
      handler: 'app.listsHandler',
      codePath: 'dist/console-api-list-importer/',
    })
    tarponDynamoDbTable.grantReadWriteData(listsAlias)

    /* Slack App */
    const { alias: slackAppAlias } = this.createFunction(
      {
        name: StackConstants.SLACK_APP_FUNCTION_NAME,
        handler: 'app.slackAppHandler',
        codePath: 'dist/slack-app',
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
        handler: 'app.slackAlertHandler',
        codePath: 'dist/slack-app',
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

    const { alias: webhookDelivererAlias } = this.createFunction(
      {
        name: StackConstants.WEBHOOK_DELIVERER_FUNCTION_NAME,
        handler: 'app.webhookDeliveryHandler',
        codePath: 'dist/webhook-deliverer',
      },
      atlasFunctionProps
    )
    this.grantMongoDbAccess(webhookDelivererAlias)
    this.grantSecretsManagerAccess(webhookDelivererAlias, 'webhooks', 'READ')
    webhookDeliveryQueue.grantConsumeMessages(webhookDelivererAlias)
    webhookDelivererAlias.addEventSource(
      new SqsEventSource(webhookDeliveryQueue, { batchSize: 1 })
    )

    const { alias: webhookConfigurationHandlerAlias } = this.createFunction(
      {
        name: StackConstants.CONSOLE_API_WEBHOOK_CONFIGURATION_FUNCTION_NAME,
        handler: 'app.webhookConfigurationHandler',
        codePath: 'dist/console-api-webhook',
      },
      atlasFunctionProps
    )
    this.grantMongoDbAccess(webhookConfigurationHandlerAlias)
    this.grantSecretsManagerAccess(
      webhookConfigurationHandlerAlias,
      'webhooks',
      'READ_WRITE'
    )

    /*
     * Hammerhead console functions
     */
    /* Risk Classification function */
    const { alias: riskClassificationAlias } = this.createFunction(
      {
        name: StackConstants.CONSOLE_API_RISK_CLASSIFICATION_FUNCTION_NAME,
        handler: 'app.riskClassificationHandler',
        codePath: 'dist/console-api-pulse/',
      },
      atlasFunctionProps
    )
    hammerheadDynamoDbTable.grantReadWriteData(riskClassificationAlias)

    /* Manual User Risk Assignment function */
    const { alias: manualUserRiskAssignmentAlias } = this.createFunction({
      name: StackConstants.CONSOLE_API_MANUAL_USER_RISK_ASSIGNMENT_FUNCTION_NAME,
      handler: 'app.manualRiskAssignmentHandler',
      codePath: 'dist/console-api-pulse/',
    })
    hammerheadDynamoDbTable.grantReadWriteData(manualUserRiskAssignmentAlias)

    /* Parameter risk level assignment function */
    const { alias: parameterRiskAssignmentAlias } = this.createFunction({
      name: StackConstants.CONSOLE_API_PARAMETER_RISK_ASSIGNMENT_FUNCTION_NAME,
      handler: 'app.parameterRiskAssignmentHandler',
      codePath: 'dist/console-api-pulse/',
    })
    hammerheadDynamoDbTable.grantReadWriteData(parameterRiskAssignmentAlias)

    /* Tarpon Kinesis Change capture consumer */

    // MongoDB mirror handler
    const { alias: tarponChangeCaptureKinesisConsumerAlias } =
      this.createFunction(
        {
          name: StackConstants.TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
          handler: 'app.tarponChangeMongodbHandler',
          codePath: 'dist/tarpon-change-mongodb-consumer',
        },
        {
          ...atlasFunctionProps,
          environment: {
            ...atlasFunctionProps.environment,
            SLACK_ALERT_QUEUE_URL: slackAlertQueue.queueUrl,
            RETRY_KINESIS_STREAM_NAME: tarponMongoDbRetryStream.streamName,
          },
          timeout: Duration.minutes(15),
        }
      )
    if (!isDevUserStack) {
      tarponChangeCaptureKinesisConsumerAlias.addEventSource(
        new KinesisEventSource(tarponStream, {
          batchSize: 1,
          startingPosition: StartingPosition.TRIM_HORIZON,
        })
      )
      tarponChangeCaptureKinesisConsumerAlias.addEventSource(
        new KinesisEventSource(tarponMongoDbRetryStream, {
          batchSize: 1,
          startingPosition: StartingPosition.LATEST,
        })
      )
    }
    tarponMongoDbRetryStream.grantReadWrite(
      tarponChangeCaptureKinesisConsumerAlias
    )
    transientDynamoDbTable.grantReadWriteData(
      tarponChangeCaptureKinesisConsumerAlias
    )
    this.grantMongoDbAccess(tarponChangeCaptureKinesisConsumerAlias)
    slackAlertQueue.grantSendMessages(tarponChangeCaptureKinesisConsumerAlias)

    // Webhook handler
    const { alias: webhookTarponChangeCaptureHandlerAlias } =
      this.createFunction(
        {
          name: StackConstants.WEBHOOK_TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
          handler: 'app.tarponChangeWebhookHandler',
          codePath: 'dist/tarpon-change-webhook-consumer',
        },
        {
          ...atlasFunctionProps,
          environment: {
            ...atlasFunctionProps.environment,
            WEBHOOK_DELIVERY_QUEUE_URL: webhookDeliveryQueue.queueUrl,
            RETRY_KINESIS_STREAM_NAME: tarponWebhookRetryStream.streamName,
          },
          timeout: Duration.minutes(15),
        }
      )
    if (!isDevUserStack) {
      webhookTarponChangeCaptureHandlerAlias.addEventSource(
        new KinesisEventSource(tarponStream, {
          batchSize: 1,
          startingPosition: StartingPosition.LATEST,
        })
      )
      webhookTarponChangeCaptureHandlerAlias.addEventSource(
        new KinesisEventSource(tarponWebhookRetryStream, {
          batchSize: 1,
          startingPosition: StartingPosition.LATEST,
        })
      )
    }
    tarponWebhookRetryStream.grantReadWrite(
      webhookTarponChangeCaptureHandlerAlias
    )
    webhookDeliveryQueue.grantSendMessages(
      webhookTarponChangeCaptureHandlerAlias
    )
    transientDynamoDbTable.grantReadWriteData(
      webhookTarponChangeCaptureHandlerAlias
    )
    this.grantMongoDbAccess(webhookTarponChangeCaptureHandlerAlias)

    /* Hammerhead Kinesis Change capture consumer */

    const { alias: hammerheadChangeCaptureKinesisConsumerAlias } =
      this.createFunction(
        {
          name: StackConstants.HAMMERHEAD_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
          handler: 'app.hammerheadChangeCaptureHandler',
          codePath: 'dist/hammerhead-change-capture-kinesis-consumer',
        },
        {
          ...atlasFunctionProps,
          timeout: Duration.minutes(15),
        }
      )

    if (!isDevUserStack) {
      hammerheadChangeCaptureKinesisConsumerAlias.addEventSource(
        new KinesisEventSource(hammerheadStream, {
          batchSize: 10,
          startingPosition: StartingPosition.TRIM_HORIZON,
        })
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

    createAPIGatewayAlarm(
      this,
      this.betterUptimeCloudWatchTopic,
      StackConstants.TARPON_API_GATEWAY_ALARM_NAME,
      publicApi.restApiName
    )

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

    createAPIGatewayAlarm(
      this,
      this.betterUptimeCloudWatchTopic,
      StackConstants.TARPON_MANAGEMENT_API_GATEWAY_ALARM_NAME,
      publicConsoleApi.restApiName
    )

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

    createAPIGatewayAlarm(
      this,
      this.betterUptimeCloudWatchTopic,
      StackConstants.CONSOLE_API_GATEWAY_ALARM_NAME,
      consoleApi.restApiName
    )

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

    if (!isDevUserStack) {
      createTarponOverallLambdaAlarm(this, this.betterUptimeCloudWatchTopic)
    }

    /**
     * Outputs
     */
    new CfnOutput(
      this,
      'API Gateway endpoint URL for Prod stage - Public API',
      {
        value: publicApi.urlForPath('/'),
      }
    )
    new CfnOutput(
      this,
      'API Gateway endpoint URL for Prod stage - Console API',
      {
        value: consoleApi.urlForPath('/'),
      }
    )
    new CfnOutput(this, 'Transaction Function Name', {
      value: transactionAlias.functionName,
    })
    new CfnOutput(this, 'User Function Name', {
      value: userAlias.functionName,
    })
    new CfnOutput(this, 'Transaction Table', {
      value: tarponDynamoDbTable.tableName,
    })
  }

  // IMPORTANT: We should use the returned `alias` for granting further roles.
  // We should only use the returned `func` to do the things that alias cannot do
  // (e.g add environment variables)
  private createFunction(
    internalFunctionProps: InternalFunctionProps,
    props: Partial<FunctionProps> = {}
  ): { alias: Alias; func: LambdaFunction } {
    const {
      layers,
      name,
      handler,
      codePath,
      memorySize,
      provisionedConcurrency,
    } = internalFunctionProps
    const layersArray = layers ? [...layers] : []
    if (
      !layersArray.includes(this.cwInsightsLayer) &&
      this.config.stage !== 'local'
    ) {
      layersArray.push(this.cwInsightsLayer)
    }
    const func = new LambdaFunction(this, name, {
      functionName: name,
      runtime: Runtime.NODEJS_16_X,
      handler,
      code: Code.fromAsset(codePath),
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
        },
      },
    })
    // This is needed to allow using ${Function.Arn} in openapi.yaml
    ;(func.node.defaultChild as CfnFunction).overrideLogicalId(name)

    /* Alarms */
    createLambdaErrorPercentageAlarm(
      this,
      this.betterUptimeCloudWatchTopic,
      name
    )
    createLambdaThrottlingAlarm(this, this.betterUptimeCloudWatchTopic, name)

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

  private grantSecretsManagerAccess(
    alias: Alias,
    prefix: string,
    mode: 'READ' | 'WRITE' | 'READ_WRITE'
  ) {
    const aliasIdentifier = alias.node.id.replace(/:/g, '-')
    const actions = []
    if (mode === 'READ' || mode === 'READ_WRITE') {
      actions.push('secretsmanager:GetSecretValue')
    }
    if (mode === 'WRITE' || mode === 'READ_WRITE') {
      actions.push('secretsmanager:CreateSecret')
      actions.push('secretsmanager:DeleteSecret')
    }
    alias.role?.attachInlinePolicy(
      new Policy(this, `${aliasIdentifier}-SecretsManagerPolicy`, {
        policyName: `${aliasIdentifier}-SecretsManagerPolicy`,
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: actions,
            resources: [`arn:aws:secretsmanager:*:*:secret:*/${prefix}/*`],
          }),
        ],
      })
    )
  }

  private createDynamoDbAlarms(tableName: string) {
    dynamoTableOperationMetrics.map((metric) => {
      dynamoTableOperations.map((operation) => {
        createDynamoDBAlarm(
          this,
          this.betterUptimeCloudWatchTopic,
          `Dynamo${tableName}${operation}${metric}`,
          tableName,
          metric,
          {
            threshold: 1,
            period: Duration.minutes(5),
            dimensions: { Operation: operation },
          }
        )
      })
    })

    if (this.config.stage === 'prod') {
      // We only monitor consumed read/write capacity for production as we use on-demand
      // mode only in production

      createDynamoDBAlarm(
        this,
        this.betterUptimeCloudWatchTopic,
        `Dynamo${tableName}ConsumedReadCapacityUnits`,
        tableName,
        'ConsumedReadCapacityUnits',
        {
          threshold: 600,
          statistic: 'Maximum',
          period: Duration.minutes(1),
        }
      )
      createDynamoDBAlarm(
        this,
        this.betterUptimeCloudWatchTopic,
        `Dynamo${tableName}ConsumedWriteCapacityUnits`,
        tableName,
        'ConsumedWriteCapacityUnits',
        {
          threshold: 300,
          statistic: 'Maximum',
          period: Duration.minutes(1),
        }
      )
    }
  }

  private createDynamodbTable(tableName: string, kinesisStream?: IStream) {
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
      removalPolicy:
        this.config.stage === 'dev'
          ? RemovalPolicy.DESTROY
          : RemovalPolicy.RETAIN,
    })
    this.createDynamoDbAlarms(tableName)
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

    createKinesisAlarm(
      this,
      this.betterUptimeCloudWatchTopic,
      `${streamId}PutRecordErrorRate`,
      stream.streamName
    )
    return stream
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
      'application/json': '{ "errors": $context.error.validationErrorString }',
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
}
