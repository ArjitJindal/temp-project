import * as cdk from 'aws-cdk-lib'
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
  SpecRestApi,
} from 'aws-cdk-lib/aws-apigateway'

import { CfnOutput, Duration, Fn, RemovalPolicy } from 'aws-cdk-lib'

import {
  CfnFunction,
  Code,
  Function as LambdaFunction,
  FunctionProps,
  Runtime,
  Tracing,
  StartingPosition,
  Alias,
  LayerVersion,
} from 'aws-cdk-lib/aws-lambda'
import { Asset } from 'aws-cdk-lib/aws-s3-assets'

import { Construct } from 'constructs'
import * as s3 from 'aws-cdk-lib/aws-s3'

import { Stream } from 'aws-cdk-lib/aws-kinesis'
import { KinesisEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import * as ec2 from 'aws-cdk-lib/aws-ec2'

import {
  TarponStackConstants,
  getResourceName,
  getNameForGlobalResource,
} from './constants'
import { Config } from './configs/config'
import {
  FileImportConfig,
  GetPresignedUrlConfig,
} from '@/lambdas/file-import/app'
import {
  AccountsConfig,
  TransactionViewConfig,
} from '@/lambdas/phytoplankton-internal-api-handlers/app'

export class CdkTarponStack extends cdk.Stack {
  config: Config

  constructor(scope: Construct, id: string, config: Config) {
    super(scope, id, { env: config.env })
    this.config = config

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

    /**
     * DynamoDB
     */
    const dynamoDbTable = new Table(
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
     * Atlas DB
     */

    const atlasVpcCidr = '10.0.0.0/21'
    const port = 27017

    const atlasVpc = new ec2.Vpc(this, 'vpc', {
      cidr: atlasVpcCidr,
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

    const atlasSg = new ec2.SecurityGroup(
      this,
      TarponStackConstants.MONGO_DB_SECURITY_GROUP_NAME,
      {
        vpc: atlasVpc,
        securityGroupName: TarponStackConstants.MONGO_DB_SECURITY_GROUP_NAME,
      }
    )

    atlasSg.addIngressRule(ec2.Peer.ipv4(atlasVpcCidr), ec2.Port.tcp(port))

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
      securityGroups: [atlasSg],
      vpc: atlasVpc,
      environment: {
        SM_SECRET_ARN: config.application.ATLAS_CREDENTIALS_SECRET_ARN,
      },
    }

    /* API Key Generator */
    const apiKeyGeneratorFunction = this.createFunction(
      TarponStackConstants.API_KEY_GENERATOR_FUNCTION_NAME,
      'app.apiKeyGeneratorHandler',
      'dist/api-key-generator',
      undefined,
      atlasFunctionProps
    )
    apiKeyGeneratorFunction.role?.attachInlinePolicy(
      new Policy(this, getResourceName('ApiKeyGeneratorPolicy'), {
        policyName: getResourceName('ApiKeyGeneratorPolicy'),
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
    const apiKeyAuthorizerFunction = this.createFunction(
      TarponStackConstants.API_KEY_AUTHORIZER_FUNCTION_NAME,
      'app.apiKeyAuthorizer',
      'dist/api-key-authorizer',
      config.resource.API_KEY_AUTHORIZER_LAMBDA.PROVISIONED_CONCURRENCY
    )

    /* JWT Authorizer */
    const jwtAuthorizerFunction = this.createFunction(
      TarponStackConstants.JWT_AUTHORIZER_FUNCTION_NAME,
      'app.jwtAuthorizer',
      'dist/jwt-authorizer',
      undefined,
      {
        environment: {
          AUTH0_AUDIENCE: config.application.AUTH0_AUDIENCE,
          AUTH0_TOKEN_ISSUER: config.application.AUTH0_TOKEN_ISSUER,
          AUTH0_JWKS_URI: config.application.AUTH0_JWKS_URI,
        },
      }
    )

    /* Transaction */
    const transactionFunction = this.createFunction(
      TarponStackConstants.TRANSACTION_FUNCTION_NAME,
      'app.transactionHandler',
      'dist/rules-engine',
      config.resource.TRANSACTION_LAMBDA.PROVISIONED_CONCURRENCY,
      { layers: [fastGeoIpLayer] }
    )
    dynamoDbTable.grantReadWriteData(transactionFunction)

    /* User Event */
    const userEventFunction = this.createFunction(
      TarponStackConstants.USER_EVENT_FUNCTION_NAME,
      'app.userEventHandler',
      'dist/rules-engine'
    )
    dynamoDbTable.grantReadWriteData(userEventFunction)

    /* File Import */
    const fileImportFunction = this.createFunction(
      TarponStackConstants.FILE_IMPORT_FUNCTION_NAME,
      'app.fileImportHandler',
      'dist/file-import/',
      undefined,
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
    dynamoDbTable.grantReadWriteData(fileImportFunction)
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
      TarponStackConstants.GET_PRESIGNED_URL_FUNCTION_NAME,
      'app.getPresignedUrlHandler',
      'dist/file-import/',
      undefined,
      {
        environment: {
          TMP_BUCKET: tmpBucketName,
        } as GetPresignedUrlConfig,
      }
    )
    s3TmpBucket.grantPut(getPresignedUrlFunction)

    /* Rule Template */
    const ruleFunction = this.createFunction(
      TarponStackConstants.RULE_FUNCTION_NAME,
      'app.ruleHandler',
      'dist/phytoplankton-internal-api-handlers/',
      undefined,
      atlasFunctionProps
    )
    dynamoDbTable.grantWriteData(ruleFunction)
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
      TarponStackConstants.RULE_INSTANCE_FUNCTION_NAME,
      'app.ruleInstanceHandler',
      'dist/phytoplankton-internal-api-handlers/',
      undefined,
      atlasFunctionProps
    )
    dynamoDbTable.grantReadWriteData(ruleInstanceFunction)
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
      TarponStackConstants.TRANSACTIONS_VIEW_FUNCTION_NAME,
      'app.transactionsViewHandler',
      'dist/phytoplankton-internal-api-handlers/',
      undefined,
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
    dynamoDbTable.grantReadWriteData(transactionsViewFunction)
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
      TarponStackConstants.ACCOUNT_FUNCTION_NAME,
      'app.accountsHandler',
      'dist/phytoplankton-internal-api-handlers/',
      undefined,
      atlasFunctionProps
    )
    this.createFunction(
      TarponStackConstants.ACCOUNT_ITEM_FUNCTION_NAME,
      'app.accountsItemHandler',
      'dist/phytoplankton-internal-api-handlers/',
      undefined,
      atlasFunctionProps
    )

    /* Transactions per user view */
    const transactionsPerUserViewFunction = this.createFunction(
      TarponStackConstants.TRANSACTIONS_PER_USER_VIEW_FUNCTION_NAME,
      'app.transactionsPerUserViewHandler',
      'dist/phytoplankton-internal-api-handlers/',
      undefined,
      atlasFunctionProps
    )
    dynamoDbTable.grantReadWriteData(transactionsViewFunction)
    transactionsPerUserViewFunction.role?.attachInlinePolicy(
      new Policy(
        this,
        `${TarponStackConstants.TRANSACTIONS_PER_USER_VIEW_FUNCTION_NAME}Policy`,
        {
          policyName: `${TarponStackConstants.TRANSACTIONS_PER_USER_VIEW_FUNCTION_NAME}Policy`,
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

    /* business users view */
    const businessUsersViewFunction = this.createFunction(
      TarponStackConstants.BUSINESS_USERS_VIEW_FUNCTION_NAME,
      'app.businessUsersViewHandler',
      'dist/phytoplankton-internal-api-handlers/',
      undefined,
      atlasFunctionProps
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

    /* consumer users view */
    const consumerUsersViewFunction = this.createFunction(
      TarponStackConstants.CONSUMER_USERS_VIEW_FUNCTION_NAME,
      'app.consumerUsersViewHandler',
      'dist/phytoplankton-internal-api-handlers/',
      undefined,
      atlasFunctionProps
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
      TarponStackConstants.DASHBOARD_STATS_TRANSACTIONS_FUNCTION_NAME,
      'app.dashboardStatsHandler',
      'dist/phytoplankton-internal-api-handlers/',
      undefined,
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
    const userFunction = this.createFunction(
      TarponStackConstants.USER_FUNCTION_NAME,
      'app.userHandler',
      'dist/user-management',
      config.resource.USER_LAMBDA.PROVISIONED_CONCURRENCY
    )
    dynamoDbTable.grantReadWriteData(userFunction)

    /* List Importer */
    const listImporterFunction = this.createFunction(
      TarponStackConstants.LIST_IMPORTER_FUNCTION_NAME,
      'app.listImporterHandler',
      'dist/list-importer'
    )
    dynamoDbTable.grantReadWriteData(listImporterFunction)

    /* Kinesis Change capture consumer */

    const tarponChangeCaptureKinesisConsumer = this.createFunction(
      TarponStackConstants.TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME,
      'app.tarponChangeCaptureHandler',
      'dist/tarpon-change-capture-kinesis-consumer',
      undefined,
      atlasFunctionProps
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
        getResourceName('tarponTarponChangeCaptureKinesisConsumerPolicy'),
        {
          policyName: getResourceName(
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

    /**
     * API Gateway
     * Open Issue: CDK+OpenAPI proper integration - https://github.com/aws/aws-cdk/issues/1461
     */

    const apiDeployOptions = {
      loggingLevel: MethodLoggingLevel.INFO,
      tracingEnabled: true,
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
      deployOptions: apiDeployOptions,
    })

    // Console APIs
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
      deployOptions: apiDeployOptions,
    })

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
      new Policy(this, getResourceName('ApiKeyAuthorizerPolicy'), {
        policyName: getResourceName('ApiKeyAuthorizerPolicy'),
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
      new Policy(this, getResourceName('JwtAuthorizerPolicy'), {
        policyName: getResourceName('JwtAuthorizerPolicy'),
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
      value: dynamoDbTable.tableName,
    })
  }

  createFunction(
    name: string,
    handler: string,
    codePath: string,
    provisionedConcurrency?: number,
    props: Partial<FunctionProps> = {}
  ): LambdaFunction {
    const func = new LambdaFunction(this, name, {
      functionName: name,
      runtime: Runtime.NODEJS_14_X,
      handler,
      code: Code.fromAsset(codePath),
      tracing: Tracing.ACTIVE,
      timeout: Duration.seconds(100),
      ...{
        ...props,
        environment: {
          ...props.environment,
          ENV: this.config.stage,
          ...this.config.application,
        },
      },
    })
    // This is needed because of the usage of SpecRestApi
    func.grantInvoke(new ServicePrincipal('apigateway.amazonaws.com'))
    // This is needed to allow using ${Function.Arn} in openapi.yaml
    ;(func.node.defaultChild as CfnFunction).overrideLogicalId(name)

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
