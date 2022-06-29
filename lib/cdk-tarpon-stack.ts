import * as cdk from 'aws-cdk-lib'
import { CfnOutput, Duration, Fn, RemovalPolicy } from 'aws-cdk-lib'
import {
  ArnPrincipal,
  Effect,
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
  MethodLoggingLevel,
  ResponseType,
  SpecRestApi,
} from 'aws-cdk-lib/aws-apigateway'

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
import { KinesisEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import { Topic, Subscription, SubscriptionProtocol } from 'aws-cdk-lib/aws-sns'
import { LogGroup } from 'aws-cdk-lib/aws-logs'

import {
  getNameForGlobalResource,
  getResourceNameForHammerhead,
  getResourceNameForTarpon,
  HammerheadStackConstants,
  TarponStackConstants,
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
    super(scope, id, { env: config.env })
    this.config = config
    /* Cloudwatch Insights Layer
    Deets: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Lambda-Insights-extension-versionsx86-64.html
    */
    const cwInsightsLayerArn = `arn:aws:lambda:${this.config.env.region}:580247275435:layer:LambdaInsightsExtension:18`
    this.cwInsightsLayer = LayerVersion.fromLayerVersionArn(
      this,
      `LayerFromArn`,
      cwInsightsLayerArn
    ) as LayerVersion

    /* Better Uptime SNS topic */
    const BetterUptimeCloudWatchTopic = new Topic(
      this,
      'BetterUptimeCloudWatchTopic',
      {
        displayName: 'BetterUptimeCloudWatchTopic',
        topicName: 'BetterUptimeCloudWatchTopic',
      }
    )
    this.betterUptimeCloudWatchTopic = BetterUptimeCloudWatchTopic

    new Subscription(this, 'Subscription', {
      topic: this.betterUptimeCloudWatchTopic,
      endpoint: config.application.BETTERUPTIME_HOOK_URL
        ? config.application.BETTERUPTIME_HOOK_URL
        : '',
      protocol: SubscriptionProtocol.HTTPS,
    })

    /*
     * Kinesis Data Streams
     *
     */
    const tarponStream = new Stream(this, 'tarponStream', {
      streamName: 'tarponDynamoChangeCaptureStream',
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

    const hammerheadStream = new Stream(this, 'hammerheadStream', {
      streamName: 'hammerheadDynamoChangeCaptureStream',
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

    /**
     * DynamoDB
     */
    const tarponDynamoDbTable = new Table(
      this,
      TarponStackConstants.DYNAMODB_TABLE_NAME,
      {
        tableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
        partitionKey: { name: 'PartitionKeyID', type: AttributeType.STRING },
        sortKey: { name: 'SortKeyID', type: AttributeType.STRING },
        readCapacity: config.resource.DYNAMODB.READ_CAPACITY,
        writeCapacity: config.resource.DYNAMODB.WRITE_CAPACITY,
        kinesisStream: tarponStream,
        removalPolicy:
          config.stage === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      }
    )
    /*
     * tarpon Alarms
     */
    dynamoTableOperationMetrics.map((metric) => {
      dynamoTableOperations.map((operation) => {
        createDynamoDBAlarm(
          this,
          this.betterUptimeCloudWatchTopic,
          `DynamoTarpon${operation}${metric}`,
          tarponDynamoDbTable.tableName,
          operation,
          metric
        )
      })
    })

    const hammerheadDynamoDbTable = new Table(
      this,
      HammerheadStackConstants.DYNAMODB_TABLE_NAME,
      {
        tableName: HammerheadStackConstants.DYNAMODB_TABLE_NAME,
        partitionKey: { name: 'PartitionKeyID', type: AttributeType.STRING },
        sortKey: { name: 'SortKeyID', type: AttributeType.STRING },
        readCapacity: config.resource.DYNAMODB.READ_CAPACITY,
        writeCapacity: config.resource.DYNAMODB.WRITE_CAPACITY,
        kinesisStream: hammerheadStream,
        removalPolicy:
          config.stage === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      }
    )

    /*
     * hammerhead Alarms
     */
    dynamoTableOperationMetrics.map((metric) => {
      dynamoTableOperations.map((operation) => {
        createDynamoDBAlarm(
          this,
          this.betterUptimeCloudWatchTopic,
          `DynamoHammerhead${operation}${metric}`,
          hammerheadDynamoDbTable.tableName,
          operation,
          metric
        )
      })
    })

    /**
     * S3 Buckets
     * NOTE: Bucket name needs to be unique across accounts. We append account ID to the
     * logical bucket name.
     */
    const s3BucketCors = [
      {
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      },
    ]
    const importBucketName = getNameForGlobalResource(
      TarponStackConstants.S3_IMPORT_BUCKET_PREFIX,
      config
    )
    const s3ImportBucket = new s3.Bucket(this, importBucketName, {
      bucketName: importBucketName,
      cors: s3BucketCors,
      removalPolicy:
        config.stage === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      autoDeleteObjects: config.stage === 'dev',
      encryption: s3.BucketEncryption.S3_MANAGED,
    })
    const documentBucketName = getNameForGlobalResource(
      TarponStackConstants.S3_DOCUMENT_BUCKET_PREFIX,
      config
    )
    const s3DocumentBucket = new s3.Bucket(this, documentBucketName, {
      bucketName: documentBucketName,
      cors: s3BucketCors,
      removalPolicy:
        config.stage === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      autoDeleteObjects: config.stage === 'dev',
      encryption: s3.BucketEncryption.S3_MANAGED,
    })
    const tmpBucketName = getNameForGlobalResource(
      TarponStackConstants.S3_TMP_BUCKET_PREFIX,
      config
    )
    const s3TmpBucket = new s3.Bucket(this, tmpBucketName, {
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

    /**
     * Lambda Layers
     */

    const fastGeoIpLayer = new LayerVersion(this, 'fast-geoip-layer', {
      compatibleRuntimes: [Runtime.NODEJS_14_X],
      code: Code.fromAsset('dist/layers/fast-geoip'),
      description: 'fast-geoip npm module',
    })

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
    const apiKeyGeneratorFunction = this.createFunction(
      {
        name: TarponStackConstants.API_KEY_GENERATOR_FUNCTION_NAME,
        handler: 'app.apiKeyGeneratorHandler',
        codePath: 'dist/api-key-generator',
      },
      atlasFunctionProps
    )
    apiKeyGeneratorFunction.role?.attachInlinePolicy(
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
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['secretsmanager:GetSecretValue'],
            resources: [config.application.ATLAS_CREDENTIALS_SECRET_ARN],
          }),
        ],
      })
    )

    /* API Key Authorizer */
    const apiKeyAuthorizerFunction = this.createFunction({
      name: TarponStackConstants.API_KEY_AUTHORIZER_FUNCTION_NAME,
      handler: 'app.apiKeyAuthorizer',
      codePath: 'dist/api-key-authorizer',
      provisionedConcurrency:
        config.resource.API_KEY_AUTHORIZER_LAMBDA.PROVISIONED_CONCURRENCY,
    })

    /* JWT Authorizer */
    const jwtAuthorizerFunction = this.createFunction(
      {
        name: TarponStackConstants.JWT_AUTHORIZER_FUNCTION_NAME,
        handler: 'app.jwtAuthorizer',
        codePath: 'dist/jwt-authorizer',
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
    const transactionFunction = this.createFunction({
      name: TarponStackConstants.TRANSACTION_FUNCTION_NAME,
      handler: 'app.transactionHandler',
      codePath: 'dist/rules-engine',
      provisionedConcurrency:
        config.resource.TRANSACTION_LAMBDA.PROVISIONED_CONCURRENCY,
      layers: [fastGeoIpLayer],
      memorySize: config.resource.TRANSACTION_LAMBDA.MEMORY_SIZE,
    })
    tarponDynamoDbTable.grantReadWriteData(transactionFunction)
    hammerheadDynamoDbTable.grantReadData(transactionFunction)

    /* Transaction Event */
    const transactionEventFunction = this.createFunction({
      name: TarponStackConstants.TRANSACTION_EVENT_FUNCTION_NAME,
      handler: 'app.transactionEventHandler',
      codePath: 'dist/rules-engine',
    })
    tarponDynamoDbTable.grantReadWriteData(transactionEventFunction)

    /* User Event */
    const userEventFunction = this.createFunction({
      name: TarponStackConstants.USER_EVENT_FUNCTION_NAME,
      handler: 'app.userEventHandler',
      codePath: 'dist/rules-engine',
    })
    tarponDynamoDbTable.grantReadWriteData(userEventFunction)

    /* File Import */
    const fileImportFunction = this.createFunction(
      {
        name: TarponStackConstants.FILE_IMPORT_FUNCTION_NAME,
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
    tarponDynamoDbTable.grantReadWriteData(fileImportFunction)
    s3TmpBucket.grantRead(fileImportFunction)
    s3ImportBucket.grantWrite(fileImportFunction)
    fileImportFunction.role?.attachInlinePolicy(
      new Policy(
        this,
        `${TarponStackConstants.FILE_IMPORT_FUNCTION_NAME}Policy`,
        {
          policyName: `${TarponStackConstants.FILE_IMPORT_FUNCTION_NAME}Policy`,
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['secretsmanager:GetSecretValue'],
              resources: [config.application.ATLAS_CREDENTIALS_SECRET_ARN],
            }),
          ],
        }
      )
    )

    const getPresignedUrlFunction = this.createFunction(
      {
        name: TarponStackConstants.GET_PRESIGNED_URL_FUNCTION_NAME,
        handler: 'app.getPresignedUrlHandler',
        codePath: 'dist/file-import/',
      },
      {
        environment: {
          TMP_BUCKET: tmpBucketName,
        } as GetPresignedUrlConfig,
      }
    )
    s3TmpBucket.grantPut(getPresignedUrlFunction)

    /* Rule Template */
    const ruleFunction = this.createFunction(
      {
        name: TarponStackConstants.RULE_FUNCTION_NAME,
        handler: 'app.ruleHandler',
        codePath: 'dist/phytoplankton-internal-api-handlers/',
      },
      atlasFunctionProps
    )
    tarponDynamoDbTable.grantWriteData(ruleFunction)
    ruleFunction.role?.attachInlinePolicy(
      new Policy(this, `${TarponStackConstants.RULE_FUNCTION_NAME}Policy`, {
        policyName: `${TarponStackConstants.RULE_FUNCTION_NAME}Policy`,
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['secretsmanager:GetSecretValue'],
            resources: [config.application.ATLAS_CREDENTIALS_SECRET_ARN],
          }),
        ],
      })
    )

    /* Rule Instance */
    const ruleInstanceFunction = this.createFunction(
      {
        name: TarponStackConstants.RULE_INSTANCE_FUNCTION_NAME,
        handler: 'app.ruleInstanceHandler',
        codePath: 'dist/phytoplankton-internal-api-handlers/',
      },
      atlasFunctionProps
    )
    tarponDynamoDbTable.grantReadWriteData(ruleInstanceFunction)
    ruleInstanceFunction.role?.attachInlinePolicy(
      new Policy(
        this,
        `${TarponStackConstants.RULE_INSTANCE_FUNCTION_NAME}Policy`,
        {
          policyName: `${TarponStackConstants.RULE_INSTANCE_FUNCTION_NAME}Policy`,
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['secretsmanager:GetSecretValue'],
              resources: [config.application.ATLAS_CREDENTIALS_SECRET_ARN],
            }),
          ],
        }
      )
    )

    /* Transactions view */
    const transactionsViewFunction = this.createFunction(
      {
        name: TarponStackConstants.TRANSACTIONS_VIEW_FUNCTION_NAME,
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
    tarponDynamoDbTable.grantReadWriteData(transactionsViewFunction)
    s3TmpBucket.grantRead(transactionsViewFunction)
    s3DocumentBucket.grantWrite(transactionsViewFunction)
    transactionsViewFunction.role?.attachInlinePolicy(
      new Policy(
        this,
        `${TarponStackConstants.TRANSACTIONS_VIEW_FUNCTION_NAME}Policy`,
        {
          policyName: `${TarponStackConstants.TRANSACTIONS_VIEW_FUNCTION_NAME}Policy`,
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['secretsmanager:GetSecretValue'],
              resources: [config.application.ATLAS_CREDENTIALS_SECRET_ARN],
            }),
          ],
        }
      )
    )

    /* Accounts */
    this.createFunction(
      {
        name: TarponStackConstants.ACCOUNT_FUNCTION_NAME,
        handler: 'app.accountsHandler',
        codePath: 'dist/phytoplankton-internal-api-handlers/',
      },
      atlasFunctionProps
    )

    /* Accounts */
    this.createFunction(
      {
        name: TarponStackConstants.TENANT_FUNCTION_NAME,
        handler: 'app.tenantsHandler',
        codePath: 'dist/phytoplankton-internal-api-handlers/',
      },
      atlasFunctionProps
    )

    /* Business users view */
    const businessUsersViewFunction = this.createFunction(
      {
        name: TarponStackConstants.BUSINESS_USERS_VIEW_FUNCTION_NAME,
        handler: 'app.businessUsersViewHandler',
        codePath: 'dist/phytoplankton-internal-api-handlers/',
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
    businessUsersViewFunction.role?.attachInlinePolicy(
      new Policy(
        this,
        `${TarponStackConstants.BUSINESS_USERS_VIEW_FUNCTION_NAME}Policy`,
        {
          policyName: `${TarponStackConstants.BUSINESS_USERS_VIEW_FUNCTION_NAME}Policy`,
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['secretsmanager:GetSecretValue'],
              resources: [config.application.ATLAS_CREDENTIALS_SECRET_ARN],
            }),
          ],
        }
      )
    )

    /* Consumer users view */
    const consumerUsersViewFunction = this.createFunction(
      {
        name: TarponStackConstants.CONSUMER_USERS_VIEW_FUNCTION_NAME,
        handler: 'app.consumerUsersViewHandler',
        codePath: 'dist/phytoplankton-internal-api-handlers/',
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
    consumerUsersViewFunction.role?.attachInlinePolicy(
      new Policy(
        this,
        `${TarponStackConstants.CONSUMER_USERS_VIEW_FUNCTION_NAME}Policy`,
        {
          policyName: `${TarponStackConstants.CONSUMER_USERS_VIEW_FUNCTION_NAME}Policy`,
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['secretsmanager:GetSecretValue'],
              resources: [config.application.ATLAS_CREDENTIALS_SECRET_ARN],
            }),
          ],
        }
      )
    )

    /* dashboard stats */
    const dashboardStatsFunction = this.createFunction(
      {
        name: TarponStackConstants.DASHBOARD_STATS_TRANSACTIONS_FUNCTION_NAME,
        handler: 'app.dashboardStatsHandler',
        codePath: 'dist/phytoplankton-internal-api-handlers/',
      },
      atlasFunctionProps
    )
    dashboardStatsFunction.role?.attachInlinePolicy(
      new Policy(
        this,
        `${TarponStackConstants.DASHBOARD_STATS_TRANSACTIONS_FUNCTION_NAME}Policy`,
        {
          policyName: `${TarponStackConstants.TRANSACTIONS_VIEW_FUNCTION_NAME}Policy`,
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['secretsmanager:GetSecretValue'],
              resources: [config.application.ATLAS_CREDENTIALS_SECRET_ARN],
            }),
          ],
        }
      )
    )

    /* User */
    const userFunction = this.createFunction({
      name: TarponStackConstants.USER_FUNCTION_NAME,
      handler: 'app.userHandler',
      codePath: 'dist/user-management',
      provisionedConcurrency:
        config.resource.USER_LAMBDA.PROVISIONED_CONCURRENCY,
      memorySize: config.resource.USER_LAMBDA.MEMORY_SIZE,
    })
    tarponDynamoDbTable.grantReadWriteData(userFunction)

    /* List Importer */
    const listImporterFunction = this.createFunction({
      name: TarponStackConstants.LIST_IMPORTER_FUNCTION_NAME,
      handler: 'app.listImporterHandler',
      codePath: 'dist/list-importer',
    })
    tarponDynamoDbTable.grantReadWriteData(listImporterFunction)
    /*
     * Hammerhead console functions
     */
    /* Risk Classification function */
    const riskClassificationFunction = this.createFunction(
      {
        name: HammerheadStackConstants.RISK_CLASSIFICATION_FUNCTION_NAME,
        handler: 'app.riskClassificationHandler',
        codePath: 'dist/phytoplankton-internal-api-handlers/',
      },
      atlasFunctionProps
    )
    hammerheadDynamoDbTable.grantReadWriteData(riskClassificationFunction)

    /* Manual User Risk Assignment function */
    const manualRiskAssignmentFunction = this.createFunction({
      name: HammerheadStackConstants.MANUAL_RISK_ASSIGNMENT_FUNCTION_NAME,
      handler: 'app.manualRiskAssignmentHandler',
      codePath: 'dist/phytoplankton-internal-api-handlers/',
    })
    hammerheadDynamoDbTable.grantReadWriteData(manualRiskAssignmentFunction)

    /* Tarpon Kinesis Change capture consumer */

    const tarponChangeCaptureKinesisConsumer = this.createFunction(
      {
        name: TarponStackConstants.TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
        handler: 'app.tarponChangeCaptureHandler',
        codePath: 'dist/tarpon-change-capture-kinesis-consumer',
      },
      {
        ...atlasFunctionProps,
        timeout: Duration.minutes(15),
      }
    )

    tarponChangeCaptureKinesisConsumer.addEventSource(
      new KinesisEventSource(tarponStream, {
        batchSize: 10,
        startingPosition: StartingPosition.TRIM_HORIZON,
      })
    )

    tarponChangeCaptureKinesisConsumer.role?.attachInlinePolicy(
      new Policy(
        this,
        getResourceNameForTarpon(
          'tarponTarponChangeCaptureKinesisConsumerPolicy'
        ),
        {
          policyName: getResourceNameForTarpon(
            'tarponTarponChangeCaptureKinesisConsumerPolicy'
          ),
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['secretsmanager:GetSecretValue'],
              resources: [config.application.ATLAS_CREDENTIALS_SECRET_ARN],
            }),
          ],
        }
      )
    )

    /* Hammerhead Kinesis Change capture consumer */

    const hammerheadChangeCaptureKinesisConsumer = this.createFunction(
      {
        name: HammerheadStackConstants.HAMMERHEAD_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
        handler: 'app.hammerheadChangeCaptureHandler',
        codePath: 'dist/hammerhead-change-capture-kinesis-consumer',
      },
      {
        ...atlasFunctionProps,
        timeout: Duration.minutes(15),
      }
    )

    hammerheadChangeCaptureKinesisConsumer.addEventSource(
      new KinesisEventSource(hammerheadStream, {
        batchSize: 10,
        startingPosition: StartingPosition.TRIM_HORIZON,
      })
    )

    hammerheadChangeCaptureKinesisConsumer.role?.attachInlinePolicy(
      new Policy(
        this,
        getResourceNameForHammerhead('ChangeCaptureKinesisConsumerPolicy'),
        {
          policyName: getResourceNameForHammerhead(
            'ChangeCaptureKinesisConsumerPolicy'
          ),
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['secretsmanager:GetSecretValue'],
              resources: [config.application.ATLAS_CREDENTIALS_SECRET_ARN],
            }),
          ],
        }
      )
    )

    /**
     * API Gateway
     * Open Issue: CDK+OpenAPI proper integration - https://github.com/aws/aws-cdk/issues/1461
     */

    const publicApiLogGroup = new LogGroup(this, 'LogGroupPublicApi', {
      logGroupName: `API-Gateway-Execution-Logs_TarponAPI`,
    })

    const apiDeployOptionsPublicAPI = {
      loggingLevel: MethodLoggingLevel.INFO,
      tracingEnabled: true,
      logGroup: publicApiLogGroup,
    }

    // Public APIs
    const PUBLIC_API_OPENAPI_PATH =
      './lib/openapi/openapi-public-autogenerated.yaml'
    let apiDefinition: ApiDefinition
    if (config.stage === 'local') {
      apiDefinition = ApiDefinition.fromAsset(PUBLIC_API_OPENAPI_PATH)
    } else {
      const publicOpenApiAsset = new Asset(this, 'PublicOpenApiAsset', {
        path: PUBLIC_API_OPENAPI_PATH,
      })
      const publicOpenApiData = Fn.transform('AWS::Include', {
        Location: publicOpenApiAsset.s3ObjectUrl,
      })
      apiDefinition = AssetApiDefinition.fromInline(publicOpenApiData)
    }

    const publicApi = new SpecRestApi(this, 'TarponAPI', {
      restApiName: 'TarponAPI',
      apiDefinition,
      deployOptions: apiDeployOptionsPublicAPI,
    })
    const apiValidationErrorTemplate = {
      'application/json':
        '{ "errors": "$context.error.validationErrorString" }',
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
      `TarponApiErrorPercentage`,
      publicApi.restApiName
    )

    createAPIGatewayThrottlingAlarm(
      this,
      this.betterUptimeCloudWatchTopic,
      publicApiLogGroup,
      `TarponApiThrottlingCount`,
      publicApi.restApiName
    )

    // Console APIs
    const consoleApiLogGroup = new LogGroup(this, 'LogGroupConsoleApi', {
      logGroupName: `API-Gateway-Execution-Logs_ConsoleTarponAPI`,
    })

    const apiDeployOptionsConsoleAPI = {
      loggingLevel: MethodLoggingLevel.INFO,
      tracingEnabled: true,
      logGroup: consoleApiLogGroup,
    }
    const CONSOLE_API_OPENAPI_PATH =
      './lib/openapi/openapi-internal-autogenerated.yaml'
    if (config.stage === 'local') {
      apiDefinition = ApiDefinition.fromAsset(CONSOLE_API_OPENAPI_PATH)
    } else {
      const internalOpenApiAsset = new Asset(this, 'InternalOpenApiAsset', {
        path: CONSOLE_API_OPENAPI_PATH,
      })
      const internalOpenApiData = Fn.transform('AWS::Include', {
        Location: internalOpenApiAsset.s3ObjectUrl,
      })
      apiDefinition = AssetApiDefinition.fromInline(internalOpenApiData)
    }
    const consoleApi = new SpecRestApi(this, 'TarponAPI-console', {
      restApiName: 'TarponAPI-console',
      apiDefinition,
      deployOptions: apiDeployOptionsConsoleAPI,
    })
    /**
     * Console API Gateway Alarm
     */

    createAPIGatewayAlarm(
      this,
      this.betterUptimeCloudWatchTopic,
      `ConsoleTarponApiErrorPercentage`,
      consoleApi.restApiName
    )

    createAPIGatewayThrottlingAlarm(
      this,
      this.betterUptimeCloudWatchTopic,
      publicApiLogGroup,
      `ConsoleApiThrottlingCount`,
      consoleApi.restApiName
    )

    /**
     * IAM roles
     */
    const apiKeyAuthorizerBaseRoleName = getNameForGlobalResource(
      TarponStackConstants.API_KEY_AUTHORIZER_BASE_ROLE_NAME,
      config
    )
    const apiKeyAuthorizerBaseRole = new Role(
      this,
      apiKeyAuthorizerBaseRoleName,
      {
        roleName: apiKeyAuthorizerBaseRoleName,
        assumedBy: new ArnPrincipal(
          apiKeyAuthorizerFunction.role?.roleArn as string
        ),
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName('PowerUserAccess'),
        ],
      }
    )
    apiKeyAuthorizerFunction.role?.attachInlinePolicy(
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
      TarponStackConstants.JWT_AUTHORIZER_BASE_ROLE_NAME,
      config
    )
    const jwtAuthorizerBaseRole = new Role(this, jwtAuthorizerBaseRoleName, {
      roleName: jwtAuthorizerBaseRoleName,
      assumedBy: new ArnPrincipal(
        jwtAuthorizerFunction.role?.roleArn as string
      ),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('PowerUserAccess'),
      ],
    })
    jwtAuthorizerFunction.role?.attachInlinePolicy(
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

    createTarponOverallLambdaAlarm(this, this.betterUptimeCloudWatchTopic)

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
      value: transactionFunction.functionName,
    })
    new CfnOutput(this, 'User Function Name', {
      value: userFunction.functionName,
    })
    new CfnOutput(this, 'Transaction Table', {
      value: tarponDynamoDbTable.tableName,
    })
  }

  createFunction(
    internalFunctionProps: InternalFunctionProps,
    props: Partial<FunctionProps> = {}
  ): LambdaFunction {
    const {
      layers,
      name,
      handler,
      codePath,
      memorySize,
      provisionedConcurrency,
    } = internalFunctionProps
    const layersArray = layers ? layers : []
    if (
      !layersArray.includes(this.cwInsightsLayer) &&
      this.config.stage !== 'local'
    ) {
      layersArray.push(this.cwInsightsLayer)
    }
    const func = new LambdaFunction(this, name, {
      functionName: name,
      runtime: Runtime.NODEJS_14_X,
      handler,
      code: Code.fromAsset(codePath),
      tracing: Tracing.ACTIVE,
      timeout: Duration.seconds(100),
      memorySize: memorySize
        ? memorySize
        : this.config.resource.LAMBDA_DEFAULT.MEMORY_SIZE,
      layers,
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
    // This is needed because of the usage of SpecRestApi
    func.grantInvoke(new ServicePrincipal('apigateway.amazonaws.com'))
    // This is needed to allow using ${Function.Arn} in openapi.yaml
    ;(func.node.defaultChild as CfnFunction).overrideLogicalId(name)
    // Add permissions for lambda insights in cloudWatch
    func.role?.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName(
        'CloudWatchLambdaInsightsExecutionRolePolicy'
      )
    )

    /* Alarms */
    createLambdaErrorPercentageAlarm(
      this,
      this.betterUptimeCloudWatchTopic,
      name
    )
    createLambdaThrottlingAlarm(this, this.betterUptimeCloudWatchTopic, name)

    // Provisioned concurrency settings
    if (provisionedConcurrency) {
      new Alias(this, `${name}-alias`, {
        aliasName: `${name}-alias`,
        version: func.currentVersion,
        provisionedConcurrentExecutions: provisionedConcurrency,
      })
    }
    return func
  }
}
