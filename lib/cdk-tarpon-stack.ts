import * as cdk from '@aws-cdk/core'
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
  LambdaIntegration,
  LambdaRestApi,
  MethodLoggingLevel,
  MethodOptions,
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
import { TarponStackConstants, getResourceName } from './constants'

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
        handler: 'app.apiKeyHandler',
        code: Code.fromAsset('dist/authorizer'),
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

    // Internal APIs

    const internalApiSecurityOptions: MethodOptions = {
      authorizationType: AuthorizationType.IAM,
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

    const transactionsViewResource =
      internalApi.root.addResource('view_transactions')
    transactionsViewResource.addMethod(
      'GET',
      new LambdaIntegration(transactionsViewFunction),
      internalApiSecurityOptions
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
