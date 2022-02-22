import * as cdk from '@aws-cdk/core'
import * as s3 from '@aws-cdk/aws-s3'
import {
  ArnPrincipal,
  Effect,
  ManagedPolicy,
  Policy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from '@aws-cdk/aws-iam'
import { AttributeType, Table } from '@aws-cdk/aws-dynamodb'
import {
  AssetApiDefinition,
  AuthorizationType,
  IdentitySource,
  LambdaIntegration,
  LambdaRestApi,
  MethodLoggingLevel,
  MethodOptions,
  RequestAuthorizer,
  SpecRestApi,
} from '@aws-cdk/aws-apigateway'

import { CfnOutput, Duration, Fn } from '@aws-cdk/core'

import {
  CfnFunction,
  Code,
  Function,
  Runtime,
  Tracing,
} from '@aws-cdk/aws-lambda'
import { Asset } from '@aws-cdk/aws-s3-assets'
import {
  TarponStackConstants,
  getResourceName,
  getS3BucketName,
} from './constants'

export class CdkTarponStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

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
        readCapacity: 1,
        writeCapacity: 1,
      }
    )

    /**
     * S3 Buckets
     * NOTE: Bucket name needs to be unique across accounts. We append account ID to the
     * logical bucket name.
     */
    const importBucketName = getS3BucketName(
      TarponStackConstants.S3_IMPORT_BUCKET_PREFIX,
      process.env.CDK_DEFAULT_ACCOUNT
    )
    const s3ImportBucket = new s3.Bucket(this, importBucketName, {
      bucketName: importBucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    })
    const importTmpBucketName = getS3BucketName(
      TarponStackConstants.S3_IMPORT_TMP_BUCKET_PREFIX,
      process.env.CDK_DEFAULT_ACCOUNT
    )
    const s3ImportTmpBucket = new s3.Bucket(this, importTmpBucketName, {
      bucketName: importTmpBucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
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
    const apiKeyGeneratorFunction = new Function(
      this,
      getResourceName('ApiKeyGeneratorFunction'),
      {
        functionName: getResourceName('ApiKeyGeneratorFunction'),
        runtime: Runtime.NODEJS_14_X,
        handler: 'app.apiKeyGeneratorHandler',
        code: Code.fromAsset('dist/api-key-generator'),
        tracing: Tracing.ACTIVE,
        timeout: Duration.seconds(10),
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
        ],
      })
    )

    /* API Key Authorizer */
    const apiKeyAuthorizerFunctionName = getResourceName(
      'ApiKeyAuthorizerFunction'
    )
    const apiKeyAuthorizerFunction = new Function(
      this,
      apiKeyAuthorizerFunctionName,
      {
        functionName: apiKeyAuthorizerFunctionName,
        runtime: Runtime.NODEJS_14_X,
        handler: 'app.apiKeyAuthorizer',
        code: Code.fromAsset('dist/api-key-authorizer'),
        tracing: Tracing.ACTIVE,
        timeout: Duration.seconds(10),
      }
    )
    // This is needed because of the usage of SpecRestApi
    apiKeyAuthorizerFunction.grantInvoke(
      new ServicePrincipal('apigateway.amazonaws.com')
    )
    // This is needed to allow using ${Function.Arn} in openapi.yaml
    ;(
      apiKeyAuthorizerFunction.node.defaultChild as CfnFunction
    ).overrideLogicalId(apiKeyAuthorizerFunctionName)

    /* JWT Authorizer */
    const jwtAuthorizerFunctionName = getResourceName('JWTAuthorizerFunction')
    const jwtAuthorizerFunction = new Function(
      this,
      jwtAuthorizerFunctionName,
      {
        functionName: jwtAuthorizerFunctionName,
        runtime: Runtime.NODEJS_14_X,
        handler: 'app.jwtAuthorizer',
        code: Code.fromAsset('dist/jwt-authorizer'),
        tracing: Tracing.ACTIVE,
        timeout: Duration.seconds(10),
        environment: {
          // TODO: Use env-specific values
          AUDIENCE: 'https://dev.api.flagright.com/',
          TOKEN_ISSUER: 'https://dev-flagright.eu.auth0.com/',
          JWKS_URI: 'https://dev-flagright.eu.auth0.com/.well-known/jwks.json',
        },
      }
    )
    jwtAuthorizerFunction.grantInvoke(
      new ServicePrincipal('apigateway.amazonaws.com')
    )
    ;(jwtAuthorizerFunction.node.defaultChild as CfnFunction).overrideLogicalId(
      jwtAuthorizerFunctionName
    )

    /* Transaction */
    const transactionFunctionName = getResourceName('TransactionFunction')
    const transactionFunction = new Function(this, transactionFunctionName, {
      functionName: transactionFunctionName,
      runtime: Runtime.NODEJS_14_X,
      handler: 'app.transactionHandler',
      code: Code.fromAsset('dist/rules-engine'),
      tracing: Tracing.ACTIVE,
      timeout: Duration.seconds(10),
    })
    dynamoDbTable.grantReadWriteData(transactionFunction)
    transactionFunction.grantInvoke(
      new ServicePrincipal('apigateway.amazonaws.com')
    )
    ;(transactionFunction.node.defaultChild as CfnFunction).overrideLogicalId(
      transactionFunctionName
    )

    /* File Import */
    const fileImportFunction = new Function(
      this,
      getResourceName('FileImportFunction'),
      {
        functionName: getResourceName('FileImportFunction'),
        runtime: Runtime.NODEJS_14_X,
        handler: 'app.fileImportHandler',
        code: Code.fromAsset('dist/file-import/'),
        tracing: Tracing.ACTIVE,
        timeout: Duration.seconds(10),
      }
    )
    dynamoDbTable.grantReadWriteData(fileImportFunction)
    s3ImportTmpBucket.grantRead(fileImportFunction)
    s3ImportBucket.grantWrite(fileImportFunction)

    const getPresignedUrlFunction = new Function(
      this,
      getResourceName('GetPresignedUrlFunction'),
      {
        functionName: getResourceName('GetPresignedUrlFunction'),
        runtime: Runtime.NODEJS_14_X,
        handler: 'app.getPresignedUrlHandler',
        code: Code.fromAsset('dist/file-import/'),
        tracing: Tracing.ACTIVE,
        timeout: Duration.seconds(10),
      }
    )
    s3ImportTmpBucket.grantPut(getPresignedUrlFunction)

    /* Rule Instance */
    const ruleInstanceFunction = new Function(
      this,
      getResourceName('RuleInstanceFunction'),
      {
        functionName: getResourceName('RuleInstanceFunction'),
        runtime: Runtime.NODEJS_14_X,
        handler: 'app.ruleInstanceHandler',
        code: Code.fromAsset('dist/phytoplankton-internal-api-handlers/'),
        tracing: Tracing.ACTIVE,
        timeout: Duration.seconds(10),
      }
    )
    dynamoDbTable.grantReadWriteData(ruleInstanceFunction)

    /* Transactions view */
    const transactionsViewFunction = new Function(
      this,
      getResourceName('TransactionsViewFunction'),
      {
        functionName: getResourceName('TransactionsViewFunction'),
        runtime: Runtime.NODEJS_14_X,
        handler: 'app.transactionsViewHandler',
        code: Code.fromAsset('dist/phytoplankton-internal-api-handlers/'),
        tracing: Tracing.ACTIVE,
        timeout: Duration.seconds(10),
      }
    )
    dynamoDbTable.grantReadWriteData(transactionsViewFunction)

    /* User */
    const userFunctionName = getResourceName('UserFunction')
    const userFunction = new Function(this, userFunctionName, {
      functionName: userFunctionName,
      runtime: Runtime.NODEJS_14_X,
      handler: 'app.userHandler',
      code: Code.fromAsset('dist/user-management'),
      tracing: Tracing.ACTIVE,
      timeout: Duration.seconds(10),
    })
    dynamoDbTable.grantReadWriteData(userFunction)
    userFunction.grantInvoke(new ServicePrincipal('apigateway.amazonaws.com'))
    ;(userFunction.node.defaultChild as CfnFunction).overrideLogicalId(
      userFunctionName
    )

    /* List Importer */
    const listImporterFunction = new Function(
      this,
      getResourceName('ListImporterFunction'),
      {
        functionName: getResourceName('ListImporterFunction'),
        runtime: Runtime.NODEJS_14_X,
        handler: 'app.listImporterHandler',
        code: Code.fromAsset('dist/list-importer'),
        tracing: Tracing.ACTIVE,
        timeout: Duration.seconds(10),
      }
    )
    dynamoDbTable.grantReadWriteData(listImporterFunction)

    /**
     * API Gateway
     */

    // Public APIs

    // TODO: CDK+OpenAPI integration (issue: https://github.com/aws/aws-cdk/issues/1461)
    const apiDeployOptions = {
      loggingLevel: MethodLoggingLevel.INFO,
      tracingEnabled: true,
    }

    const openApiAsset = new Asset(this, 'OpenApiAsset', {
      path: './lib/openapi.yaml',
    })
    const openApiData = Fn.transform('AWS::Include', {
      Location: openApiAsset.s3ObjectUrl,
    })
    const publicApi = new SpecRestApi(this, 'TarponAPI', {
      restApiName: 'TarponAPI',
      apiDefinition: AssetApiDefinition.fromInline(openApiData),
      deployOptions: apiDeployOptions,
    })
    const internalApi = new LambdaRestApi(this, 'TarponAPI-internal', {
      handler: transactionFunction, // TODO: create default handler,
      proxy: false,
      deployOptions: apiDeployOptions,
    })

    // Console APIs

    const internalApiSecurityOptions: MethodOptions = {
      authorizationType: AuthorizationType.IAM,
    }

    const consoleApiSecurityOptions: MethodOptions = {
      authorizationType: AuthorizationType.CUSTOM,
      authorizer: new RequestAuthorizer(
        this,
        getResourceName('JwtAuthorizer'),
        {
          authorizerName: getResourceName('JwtAuthorizer'),
          handler: jwtAuthorizerFunction,
          identitySources: [IdentitySource.header('Authorization')],
          resultsCacheTtl: Duration.seconds(0),
        }
      ),
    }

    // NOTE: API Key is currently generated by us and delivered to customers manually.
    // This endpoint will be used by Flagright console UI and customers can generate
    // the API keys by themselves.

    const apiKeyResource = internalApi.root.addResource('apikey')
    apiKeyResource.addMethod(
      'POST',
      new LambdaIntegration(apiKeyGeneratorFunction),
      internalApiSecurityOptions
    )

    const ruleInstancesResource = internalApi.root.addResource('rule_instances')
    ruleInstancesResource.addMethod(
      'POST',
      new LambdaIntegration(ruleInstanceFunction),
      internalApiSecurityOptions
    )
    const ruleInstanceResource = ruleInstancesResource.addResource('{id}')
    ruleInstanceResource.addMethod(
      'PUT',
      new LambdaIntegration(ruleInstanceFunction),
      internalApiSecurityOptions
    )
    ruleInstanceResource.addMethod(
      'DELETE',
      new LambdaIntegration(ruleInstanceFunction),
      internalApiSecurityOptions
    )

    const transactionsResource = internalApi.root.addResource('transactions')
    transactionsResource.addMethod(
      'GET',
      new LambdaIntegration(transactionsViewFunction),
      internalApiSecurityOptions
    )

    // TODO: Add security options once we have console authorizer
    const transactionsImportResource =
      transactionsResource.addResource('import')
    transactionsImportResource.addMethod(
      'POST',
      new LambdaIntegration(fileImportFunction),
      consoleApiSecurityOptions
    )
    const transactionsGetPresignedUrlResource =
      transactionsImportResource.addResource('getPresignedUrl')
    transactionsGetPresignedUrlResource.addMethod(
      'POST',
      new LambdaIntegration(getPresignedUrlFunction),
      consoleApiSecurityOptions
    )

    const listsResource = internalApi.root.addResource('lists')
    listsResource.addMethod(
      'POST',
      new LambdaIntegration(listImporterFunction),
      internalApiSecurityOptions
    )

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
      'API Gateway endpoint URL for Prod stage - Internal API',
      {
        value: internalApi.urlForPath('/'),
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
}
