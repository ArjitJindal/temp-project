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
} from 'aws-cdk-lib/aws-lambda'
import { Asset } from 'aws-cdk-lib/aws-s3-assets'

import { Construct } from 'constructs'
import * as s3 from 'aws-cdk-lib/aws-s3'

import { Stream } from 'aws-cdk-lib/aws-kinesis'
import { KinesisEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as docdb from 'aws-cdk-lib/aws-docdb'
import {
  FileImportConfig,
  GetPresignedUrlConfig,
} from '../src/lambdas/file-import/app'
import {
  TarponStackConstants,
  getResourceName,
  getS3BucketName,
} from './constants'

import { Config } from './configs/config'

export class CdkTarponStack extends cdk.Stack {
  constructor(scope: Construct, id: string, config: Config) {
    super(scope, id, { env: config.env })

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
     * Document DB
     */

    const docdbVpcCidr = '10.0.0.0/21'
    const port = 27017

    const docDbVpc = new ec2.Vpc(this, 'vpc', {
      cidr: docdbVpcCidr,
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

    const docDbSg = new ec2.SecurityGroup(
      this,
      TarponStackConstants.DOCUMENT_DB_SECURITY_GROUP_NAME,
      {
        vpc: docDbVpc,
        securityGroupName: TarponStackConstants.DOCUMENT_DB_SECURITY_GROUP_NAME,
      }
    )

    docDbSg.addIngressRule(ec2.Peer.ipv4(docdbVpcCidr), ec2.Port.tcp(port))

    const docDbCluster = new docdb.DatabaseCluster(
      this,
      TarponStackConstants.DOCUMENT_DB_DATABASE_NAME,
      {
        masterUser: {
          username: TarponStackConstants.DOCUMENT_DB_USERNAME_NAME,
        },
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T3,
          ec2.InstanceSize.MEDIUM
        ),
        vpcSubnets: {
          subnetType: ec2.SubnetType.PUBLIC,
        },
        securityGroup: docDbSg,
        vpc: docDbVpc,
        deletionProtection: config.stage !== 'dev',
        removalPolicy:
          config.stage === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      }
    )

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
    const importBucketName = getS3BucketName(
      TarponStackConstants.S3_IMPORT_BUCKET_PREFIX,
      config.stage
    )
    const s3ImportBucket = new s3.Bucket(this, importBucketName, {
      bucketName: importBucketName,
      cors: s3BucketCors,
      removalPolicy:
        config.stage === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      autoDeleteObjects: config.stage === 'dev',
      encryption: s3.BucketEncryption.S3_MANAGED,
    })
    const importTmpBucketName = getS3BucketName(
      TarponStackConstants.S3_IMPORT_TMP_BUCKET_PREFIX,
      config.stage
    )
    const s3ImportTmpBucket = new s3.Bucket(this, importTmpBucketName, {
      bucketName: importTmpBucketName,
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
     * Lambda Functions
     */

    /* API Key Generator */
    const apiKeyGeneratorFunction = this.createFunction(
      TarponStackConstants.API_KEY_GENERATOR_FUNCTION_NAME,
      'app.apiKeyGeneratorHandler',
      'dist/api-key-generator',
      undefined,
      {
        securityGroups: [docDbSg],
        vpc: docDbVpc,
        environment: {
          DB_HOST: docDbCluster.clusterEndpoint.hostname,
          DB_PORT: '27017',
          SM_SECRET_ARN: docDbCluster.secret!.secretFullArn!,
        },
      }
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
            resources: [docDbCluster.secret!.secretFullArn!],
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
      config.resource.TRANSACTION_LAMBDA.PROVISIONED_CONCURRENCY
    )
    dynamoDbTable.grantReadWriteData(transactionFunction)

    /* File Import */
    const fileImportFunction = this.createFunction(
      TarponStackConstants.FILE_IMPORT_FUNCTION_NAME,
      'app.fileImportHandler',
      'dist/file-import/',
      undefined,
      {
        environment: {
          IMPORT_BUCKET: importBucketName,
          IMPORT_TMP_BUCKET: importTmpBucketName,
        } as FileImportConfig,
        timeout: Duration.minutes(15),
      }
    )
    dynamoDbTable.grantReadWriteData(fileImportFunction)
    s3ImportTmpBucket.grantRead(fileImportFunction)
    s3ImportBucket.grantWrite(fileImportFunction)

    const getPresignedUrlFunction = this.createFunction(
      TarponStackConstants.GET_PRESIGNED_URL_FUNCTION_NAME,
      'app.getPresignedUrlHandler',
      'dist/file-import/',
      undefined,
      {
        environment: {
          IMPORT_TMP_BUCKET: importTmpBucketName,
        } as GetPresignedUrlConfig,
      }
    )
    s3ImportTmpBucket.grantPut(getPresignedUrlFunction)

    /* Rule Instance */
    const ruleInstanceFunction = this.createFunction(
      TarponStackConstants.RULE_INSTANCE_FUNCTION_NAME,
      'app.ruleInstanceHandler',
      'dist/phytoplankton-internal-api-handlers/'
    )
    dynamoDbTable.grantReadWriteData(ruleInstanceFunction)

    /* Transactions view */
    const transactionsViewFunction = this.createFunction(
      TarponStackConstants.TRANSACTIONS_VIEW_FUNCTION_NAME,
      'app.transactionsViewHandler',
      'dist/phytoplankton-internal-api-handlers/'
    )
    dynamoDbTable.grantReadWriteData(transactionsViewFunction)

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
      {
        securityGroups: [docDbSg],
        vpc: docDbVpc,
        environment: {
          DB_HOST: docDbCluster.clusterEndpoint.hostname,
          DB_PORT: '27017',
          SM_SECRET_ARN: docDbCluster.secret!.secretFullArn!,
        },
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
        getResourceName('tarponTarponChangeCaptureKinesisConsumerPolicy'),
        {
          policyName: getResourceName(
            'tarponTarponChangeCaptureKinesisConsumerPolicy'
          ),
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['secretsmanager:GetSecretValue'],
              resources: [docDbCluster.secret!.secretFullArn!],
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
    const publicOpenApiAsset = new Asset(this, 'PublicOpenApiAsset', {
      path: './lib/openapi/openapi-public-autogenerated.yaml',
    })
    const publicOpenApiData = Fn.transform('AWS::Include', {
      Location: publicOpenApiAsset.s3ObjectUrl,
    })
    const publicApi = new SpecRestApi(this, 'TarponAPI', {
      restApiName: 'TarponAPI',
      apiDefinition: AssetApiDefinition.fromInline(publicOpenApiData),
      deployOptions: apiDeployOptions,
    })

    // Console APIs
    const internalOpenApiAsset = new Asset(this, 'InternalOpenApiAsset', {
      path: './lib/openapi/openapi-internal-autogenerated.yaml',
    })
    const internalOpenApiData = Fn.transform('AWS::Include', {
      Location: internalOpenApiAsset.s3ObjectUrl,
    })
    const consoleApi = new SpecRestApi(this, 'TarponAPI-console', {
      restApiName: 'TarponAPI-console',
      apiDefinition: AssetApiDefinition.fromInline(internalOpenApiData),
      deployOptions: apiDeployOptions,
    })

    /**
     * IAM roles
     */
    const apiKeyAuthorizerBaseRole = new Role(
      this,
      TarponStackConstants.API_KEY_AUTHORIZER_BASE_ROLE_NAME,
      {
        roleName: TarponStackConstants.API_KEY_AUTHORIZER_BASE_ROLE_NAME,
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
    const jwtAuthorizerBaseRole = new Role(
      this,
      TarponStackConstants.JWT_AUTHORIZER_BASE_ROLE_NAME,
      {
        roleName: TarponStackConstants.JWT_AUTHORIZER_BASE_ROLE_NAME,
        assumedBy: new ArnPrincipal(
          jwtAuthorizerFunction.role?.roleArn as string
        ),
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName('PowerUserAccess'),
        ],
      }
    )
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
    props?: Partial<FunctionProps>
  ): LambdaFunction {
    const func = new LambdaFunction(this, name, {
      functionName: name,
      runtime: Runtime.NODEJS_14_X,
      handler,
      code: Code.fromAsset(codePath),
      tracing: Tracing.ACTIVE,
      timeout: Duration.seconds(10),
      ...props,
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
