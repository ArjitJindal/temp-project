import * as cdk from 'aws-cdk-lib'
import { CfnOutput, Duration, Fn, RemovalPolicy, Resource } from 'aws-cdk-lib'
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
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb'
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

import { Stream } from 'aws-cdk-lib/aws-kinesis'
import {
  KinesisEventSource,
  SqsEventSource,
} from 'aws-cdk-lib/aws-lambda-event-sources'
import { LogGroup } from 'aws-cdk-lib/aws-logs'

import {
  getNameForGlobalResource,
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
} from '@/lambdas/file-import/app'
import {
  TransactionViewConfig,
  UserViewConfig,
} from '@/lambdas/phytoplankton-internal-api-handlers/app'

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
    let tarponStream
    if (!isDevUserStack) {
      tarponStream = new Stream(this, StackConstants.TARPON_STREAM_ID, {
        streamName: StackConstants.TARPON_STREAM_NAME,
        retentionPeriod: Duration.hours(72),
        shardCount: 1,
      })
      if (config.stage === 'dev') {
        tarponStream.applyRemovalPolicy(RemovalPolicy.DESTROY)
      }

      createKinesisAlarm(
        this,
        this.betterUptimeCloudWatchTopic,
        `TarponChangeCaptureKinesisPutRecordErrorRate`,
        tarponStream.streamName
      )
    } else {
      const streamArn = `arn:aws:kinesis:${config.env.region}:${config.env.account}:stream/${StackConstants.TARPON_STREAM_NAME}`
      tarponStream = Stream.fromStreamArn(
        this,
        StackConstants.TARPON_STREAM_ID,
        streamArn
      )
    }

    let hammerheadStream
    if (!isDevUserStack) {
      hammerheadStream = new Stream(this, StackConstants.HAMMERHEAD_STREAM_ID, {
        streamName: StackConstants.HAMMERHEAD_STREAM_NAME,
        retentionPeriod: Duration.hours(72),
        shardCount: 1,
      })
      if (config.stage === 'dev') {
        hammerheadStream.applyRemovalPolicy(RemovalPolicy.DESTROY)
      }

      createKinesisAlarm(
        this,
        this.betterUptimeCloudWatchTopic,
        `HammerheadChangeCaptureKinesisPutRecordErrorRate`,
        hammerheadStream.streamName
      )
    } else {
      const streamArn = `arn:aws:kinesis:${config.env.region}:${config.env.account}:stream/${StackConstants.HAMMERHEAD_STREAM_NAME}`
      hammerheadStream = Stream.fromStreamArn(
        this,
        StackConstants.HAMMERHEAD_STREAM_ID,
        streamArn
      )
    }

    /**
     * DynamoDB
     */
    let tarponDynamoDbTable
    let hammerheadDynamoDbTable

    if (!isDevUserStack) {
      tarponDynamoDbTable = new Table(
        this,
        StackConstants.TARPON_DYNAMODB_TABLE_NAME,
        {
          tableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
          partitionKey: { name: 'PartitionKeyID', type: AttributeType.STRING },
          sortKey: { name: 'SortKeyID', type: AttributeType.STRING },
          readCapacity: config.resource.DYNAMODB.READ_CAPACITY,
          writeCapacity: config.resource.DYNAMODB.WRITE_CAPACITY,
          billingMode: config.resource.DYNAMODB.BILLING_MODE,
          kinesisStream: tarponStream,
          removalPolicy:
            config.stage === 'dev'
              ? RemovalPolicy.DESTROY
              : RemovalPolicy.RETAIN,
        }
      )
      this.createDynamoDbAlarms(StackConstants.TARPON_DYNAMODB_TABLE_NAME)

      hammerheadDynamoDbTable = new Table(
        this,
        StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
        {
          tableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
          partitionKey: { name: 'PartitionKeyID', type: AttributeType.STRING },
          sortKey: { name: 'SortKeyID', type: AttributeType.STRING },
          readCapacity: config.resource.DYNAMODB.READ_CAPACITY,
          writeCapacity: config.resource.DYNAMODB.WRITE_CAPACITY,
          billingMode: config.resource.DYNAMODB.BILLING_MODE,
          kinesisStream: hammerheadStream,
          removalPolicy:
            config.stage === 'dev'
              ? RemovalPolicy.DESTROY
              : RemovalPolicy.RETAIN,
        }
      )
      this.createDynamoDbAlarms(StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME)
    } else {
      tarponDynamoDbTable = Table.fromTableName(
        this,
        StackConstants.TARPON_DYNAMODB_TABLE_NAME,
        StackConstants.TARPON_DYNAMODB_TABLE_NAME
      )
      hammerheadDynamoDbTable = Table.fromTableName(
        this,
        StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
        StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME
      )
    }

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
      name: StackConstants.TRANSACTION_FUNCTION_NAME,
      handler: 'app.transactionHandler',
      codePath: 'dist/rules-engine',
      provisionedConcurrency:
        config.resource.TRANSACTION_LAMBDA.PROVISIONED_CONCURRENCY,
      layers: [fastGeoIpLayer],
      memorySize: config.resource.TRANSACTION_LAMBDA.MEMORY_SIZE,
    })
    tarponDynamoDbTable.grantReadWriteData(transactionAlias)
    hammerheadDynamoDbTable.grantReadData(transactionAlias)

    /* Transaction Event */
    const { alias: transactionEventAlias } = this.createFunction({
      name: StackConstants.TRANSACTION_EVENT_FUNCTION_NAME,
      handler: 'app.transactionEventHandler',
      codePath: 'dist/rules-engine',
    })
    tarponDynamoDbTable.grantReadWriteData(transactionEventAlias)

    /*  User Event */
    const { alias: userEventAlias } = this.createFunction({
      name: StackConstants.USER_EVENT_FUNCTION_NAME,
      handler: 'app.userEventsHandler',
      codePath: 'dist/rules-engine',
    })
    tarponDynamoDbTable.grantReadWriteData(userEventAlias)

    /* File Import */
    const { alias: fileImportAlias } = this.createFunction(
      {
        name: StackConstants.FILE_IMPORT_FUNCTION_NAME,
        handler: 'app.fileImportHandler',
        codePath: 'dist/file-import/',
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
        name: StackConstants.GET_PRESIGNED_URL_FUNCTION_NAME,
        handler: 'app.getPresignedUrlHandler',
        codePath: 'dist/file-import/',
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
        name: StackConstants.RULE_FUNCTION_NAME,
        handler: 'app.ruleHandler',
        codePath: 'dist/phytoplankton-internal-api-handlers/',
      },
      atlasFunctionProps
    )
    tarponDynamoDbTable.grantWriteData(ruleAlias)
    this.grantMongoDbAccess(ruleAlias)

    /* Rule Instance */
    const { alias: ruleInstanceAlias } = this.createFunction(
      {
        name: StackConstants.RULE_INSTANCE_FUNCTION_NAME,
        handler: 'app.ruleInstanceHandler',
        codePath: 'dist/phytoplankton-internal-api-handlers/',
      },
      atlasFunctionProps
    )
    tarponDynamoDbTable.grantReadWriteData(ruleInstanceAlias)
    this.grantMongoDbAccess(ruleInstanceAlias)

    /* Transactions view */
    const { alias: transactionsViewAlias } = this.createFunction(
      {
        name: StackConstants.TRANSACTIONS_VIEW_FUNCTION_NAME,
        handler: 'app.transactionsViewHandler',
        codePath: 'dist/phytoplankton-internal-api-handlers/',
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
        name: StackConstants.ACCOUNT_FUNCTION_NAME,
        handler: 'app.accountsHandler',
        codePath: 'dist/phytoplankton-internal-api-handlers/',
      },
      atlasFunctionProps
    )

    /* Accounts */
    this.createFunction(
      {
        name: StackConstants.TENANT_FUNCTION_NAME,
        handler: 'app.tenantsHandler',
        codePath: 'dist/phytoplankton-internal-api-handlers/',
      },
      atlasFunctionProps
    )

    /* Business users view */
    const { alias: businessUsersViewAlias } = this.createFunction(
      {
        name: StackConstants.BUSINESS_USERS_VIEW_FUNCTION_NAME,
        handler: 'app.businessUsersViewHandler',
        codePath: 'dist/phytoplankton-internal-api-handlers/',
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
        name: StackConstants.CONSUMER_USERS_VIEW_FUNCTION_NAME,
        handler: 'app.consumerUsersViewHandler',
        codePath: 'dist/phytoplankton-internal-api-handlers/',
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
        name: StackConstants.DASHBOARD_STATS_TRANSACTIONS_FUNCTION_NAME,
        handler: 'app.dashboardStatsHandler',
        codePath: 'dist/phytoplankton-internal-api-handlers/',
        provisionedConcurrency:
          config.resource.DASHBOARD_LAMBDA.PROVISIONED_CONCURRENCY,
        memorySize: config.resource.DASHBOARD_LAMBDA.MEMORY_SIZE,
      },
      atlasFunctionProps
    )
    this.grantMongoDbAccess(dashboardStatsAlias)

    /* User */
    const { alias: userAlias } = this.createFunction({
      name: StackConstants.USER_FUNCTION_NAME,
      handler: 'app.userHandler',
      codePath: 'dist/user-management',
      provisionedConcurrency:
        config.resource.USER_LAMBDA.PROVISIONED_CONCURRENCY,
      memorySize: config.resource.USER_LAMBDA.MEMORY_SIZE,
    })
    tarponDynamoDbTable.grantReadWriteData(userAlias)

    /* List Importer */
    const { alias: listsAlias } = this.createFunction({
      name: StackConstants.LISTS_FUNCTION_NAME,
      handler: 'app.listsHandler',
      codePath: 'dist/phytoplankton-internal-api-handlers/',
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
        codePath: 'dist/webhook',
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
        name: StackConstants.WEBHOOK_CONFIGURATION_FUNCTION_NAME,
        handler: 'app.webhookConfigurationHandler',
        codePath: 'dist/webhook',
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
        name: StackConstants.RISK_CLASSIFICATION_FUNCTION_NAME,
        handler: 'app.riskClassificationHandler',
        codePath: 'dist/phytoplankton-internal-api-handlers/',
      },
      atlasFunctionProps
    )
    hammerheadDynamoDbTable.grantReadWriteData(riskClassificationAlias)

    /* Manual User Risk Assignment function */
    const { alias: manualUserRiskAssignmentAlias } = this.createFunction({
      name: StackConstants.MANUAL_USER_RISK_ASSIGNMENT_FUNCTION_NAME,
      handler: 'app.manualRiskAssignmentHandler',
      codePath: 'dist/phytoplankton-internal-api-handlers/',
    })
    hammerheadDynamoDbTable.grantReadWriteData(manualUserRiskAssignmentAlias)

    /* Parameter risk level assignment function */
    const { alias: parameterRiskAssignmentAlias } = this.createFunction({
      name: StackConstants.PARAMETER_RISK_ASSIGNMENT_FUNCTION_NAME,
      handler: 'app.parameterRiskAssignmentHandler',
      codePath: 'dist/phytoplankton-internal-api-handlers/',
    })
    hammerheadDynamoDbTable.grantReadWriteData(parameterRiskAssignmentAlias)

    /* Tarpon Kinesis Change capture consumer */

    // MongoDB mirror handler
    const { alias: tarponChangeCaptureKinesisConsumerAlias } =
      this.createFunction(
        {
          name: StackConstants.TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
          handler: 'app.tarponChangeCaptureHandler',
          codePath: 'dist/tarpon-change-capture-kinesis-consumer',
        },
        {
          ...atlasFunctionProps,
          environment: {
            ...atlasFunctionProps.environment,
            SLACK_ALERT_QUEUE_URL: slackAlertQueue.queueUrl,
          },
          timeout: Duration.minutes(15),
        }
      )
    tarponChangeCaptureKinesisConsumerAlias.addEventSource(
      new KinesisEventSource(tarponStream, {
        batchSize: 1,
        startingPosition: StartingPosition.TRIM_HORIZON,
      })
    )
    this.grantMongoDbAccess(tarponChangeCaptureKinesisConsumerAlias)
    slackAlertQueue.grantSendMessages(tarponChangeCaptureKinesisConsumerAlias)

    // Webhook handler
    const { alias: webhookTarponChangeCaptureHandlerAlias } =
      this.createFunction(
        {
          name: StackConstants.WEBHOOK_TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
          handler: 'app.webhookTarponChangeCaptureHandler',
          codePath: 'dist/webhook',
        },
        {
          ...atlasFunctionProps,
          environment: {
            ...atlasFunctionProps.environment,
            WEBHOOK_DELIVERY_QUEUE_URL: webhookDeliveryQueue.queueUrl,
          },
          timeout: Duration.minutes(15),
        }
      )
    webhookTarponChangeCaptureHandlerAlias.addEventSource(
      new KinesisEventSource(tarponStream, {
        batchSize: 1,
        startingPosition: StartingPosition.LATEST,
      })
    )
    webhookDeliveryQueue.grantSendMessages(
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

    hammerheadChangeCaptureKinesisConsumerAlias.addEventSource(
      new KinesisEventSource(hammerheadStream, {
        batchSize: 10,
        startingPosition: StartingPosition.TRIM_HORIZON,
      })
    )
    this.grantMongoDbAccess(hammerheadChangeCaptureKinesisConsumerAlias)

    /**
     * API Gateway
     * Open Issue: CDK+OpenAPI proper integration - https://github.com/aws/aws-cdk/issues/1461
     */

    // Public APIs
    const PUBLIC_API_OPENAPI_PATH = `./dist/openapi/openapi-public-autogenerated-${config.stage}.yaml`
    let apiDefinition: ApiDefinition
    if (config.stage === 'local') {
      apiDefinition = ApiDefinition.fromAsset(PUBLIC_API_OPENAPI_PATH)
    } else {
      const publicOpenApiAsset = new Asset(
        this,
        StackConstants.PUBLIC_OPENAPI_ASSET_NAME,
        {
          path: PUBLIC_API_OPENAPI_PATH,
        }
      )
      const publicOpenApiData = Fn.transform('AWS::Include', {
        Location: publicOpenApiAsset.s3ObjectUrl,
      })
      apiDefinition = AssetApiDefinition.fromInline(publicOpenApiData)
    }

    const publicApiLogGroup = new LogGroup(
      this,
      StackConstants.LOG_GROUP_PUBLIC_API_NAME,
      {
        logGroupName: StackConstants.TARPON_API_LOG_GROUP_NAME,
      }
    )
    const publicApi = new SpecRestApi(this, StackConstants.TARPON_API_NAME, {
      restApiName: StackConstants.TARPON_API_NAME,
      apiDefinition,
      deployOptions: {
        loggingLevel: MethodLoggingLevel.INFO,
        tracingEnabled: true,
        accessLogDestination: new LogGroupLogDestination(publicApiLogGroup),
      },
    })
    const apiValidationErrorTemplate = {
      'application/json': '{ "errors": $context.error.validationErrorString }',
    }
    publicApi.addGatewayResponse('BadRequestBodyValidationResponse', {
      type: ResponseType.BAD_REQUEST_BODY,
      statusCode: '400',
      templates: apiValidationErrorTemplate,
    })
    publicApi.addGatewayResponse('BadRequestParametersValidationResponse', {
      type: ResponseType.BAD_REQUEST_PARAMETERS,
      statusCode: '400',
      templates: apiValidationErrorTemplate,
    })

    /**
     * Public API Gateway Alarm
     */
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

    // Console APIs
    const CONSOLE_API_OPENAPI_PATH = `./dist/openapi/openapi-internal-autogenerated-${config.stage}.yaml`
    if (config.stage === 'local') {
      apiDefinition = ApiDefinition.fromAsset(CONSOLE_API_OPENAPI_PATH)
    } else {
      const internalOpenApiAsset = new Asset(
        this,
        StackConstants.CONSOLE_OPENAPI_ASSET_NAME,
        {
          path: CONSOLE_API_OPENAPI_PATH,
        }
      )
      const internalOpenApiData = Fn.transform('AWS::Include', {
        Location: internalOpenApiAsset.s3ObjectUrl,
      })
      apiDefinition = AssetApiDefinition.fromInline(internalOpenApiData)
    }
    const consoleApiLogGroup = new LogGroup(
      this,
      StackConstants.LOG_GROUP_CONSOLE_API_NAME,
      {
        logGroupName: StackConstants.CONSOLE_API_LOG_GROUP_NAME,
      }
    )
    const consoleApi = new SpecRestApi(this, StackConstants.CONSOLE_API_NAME, {
      restApiName: StackConstants.CONSOLE_API_NAME,
      apiDefinition,
      deployOptions: {
        loggingLevel: MethodLoggingLevel.INFO,
        tracingEnabled: true,
        accessLogDestination: new LogGroupLogDestination(consoleApiLogGroup),
        cacheClusterEnabled: !!config.resource.CONSOLE_API_GATEWAY.CACHE,
        cacheClusterSize: config.resource.CONSOLE_API_GATEWAY.CACHE?.CAPACITY,
        cacheTtl: config.resource.CONSOLE_API_GATEWAY.CACHE?.TTL,
      },
    })
    /**
     * Console API Gateway Alarm
     */

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
  createFunction(
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
}
