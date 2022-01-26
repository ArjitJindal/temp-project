import * as cdk from '@aws-cdk/core'
import {
  ArnPrincipal,
  Effect,
  ManagedPolicy,
  Policy,
  PolicyStatement,
  Role,
} from '@aws-cdk/aws-iam'
import { AttributeType, Table } from '@aws-cdk/aws-dynamodb'

import {
  AuthorizationType,
  IdentitySource,
  LambdaIntegration,
  LambdaRestApi,
  MethodOptions,
  RequestAuthorizer,
} from '@aws-cdk/aws-apigateway'

import { CfnOutput, Duration } from '@aws-cdk/core'

import { Code, Function, Runtime, Tracing } from '@aws-cdk/aws-lambda'
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

    const apiKeyAuthorizerFunction = new Function(
      this,
      getResourceName('ApiKeyAuthorizerFunction'),
      {
        functionName: getResourceName('ApiKeyAuthorizerFunction'),
        runtime: Runtime.NODEJS_14_X,
        handler: 'app.apiKeyHandler',
        code: Code.fromAsset('dist/authorizer'),
        tracing: Tracing.ACTIVE,
        timeout: Duration.seconds(10),
      }
    )

    const transactionFunction = new Function(
      this,
      getResourceName('TransactionFunction'),
      {
        functionName: getResourceName('TransactionFunction'),
        runtime: Runtime.NODEJS_14_X,
        handler: 'app.transactionHandler',
        code: Code.fromAsset('dist/rules-engine'),
        tracing: Tracing.ACTIVE,
        timeout: Duration.seconds(10),
      }
    )
    dynamoDbTable.grantReadWriteData(transactionFunction)

    const ruleInstanceFunction = new Function(
      this,
      getResourceName('RuleInstanceFunction'),
      {
        functionName: getResourceName('RuleInstanceFunction'),
        runtime: Runtime.NODEJS_14_X,
        handler: 'app.ruleInstanceHandler',
        code: Code.fromAsset('dist/rules-engine'),
        tracing: Tracing.ACTIVE,
        timeout: Duration.seconds(10),
      }
    )
    dynamoDbTable.grantReadWriteData(ruleInstanceFunction)

    const userFunction = new Function(this, getResourceName('UserFunction'), {
      functionName: getResourceName('UserFunction'),
      runtime: Runtime.NODEJS_14_X,
      handler: 'app.userHandler',
      code: Code.fromAsset('dist/user-management'),
      tracing: Tracing.ACTIVE,
      timeout: Duration.seconds(10),
    })
    dynamoDbTable.grantReadWriteData(userFunction)

    /**
     * API Gateway
     */

    // Public APIs

    // TODO: CDK+OpenAPI integration (issue: https://github.com/aws/aws-cdk/issues/1461)
    const api = new LambdaRestApi(this, 'TarponAPI', {
      handler: transactionFunction, // TODO: create default handler,
      proxy: false,
    })
    const apiKeyAuthorizer = new RequestAuthorizer(
      this,
      getResourceName('ApiKeyAuthorizer'),
      {
        authorizerName: getResourceName('ApiKeyAuthorizer'),
        handler: apiKeyAuthorizerFunction,
        identitySources: [IdentitySource.header('x-api-key')],
        resultsCacheTtl: Duration.seconds(0),
      }
    )
    const publicApiSecurityOptions: MethodOptions = {
      authorizationType: AuthorizationType.CUSTOM,
      authorizer: apiKeyAuthorizer,
      apiKeyRequired: true,
    }

    const transactionsResource = api.root.addResource('transactions')
    transactionsResource.addMethod(
      'POST',
      new LambdaIntegration(transactionFunction, { proxy: true }),
      publicApiSecurityOptions
    )
    const transactionResource =
      transactionsResource.addResource('{transactionId}')
    transactionResource.addMethod(
      'GET',
      new LambdaIntegration(transactionFunction, { proxy: true }),
      publicApiSecurityOptions
    )

    const businessResource = api.root.addResource('business')
    const businessUsersResource = businessResource.addResource('users')
    businessUsersResource.addMethod(
      'POST',
      new LambdaIntegration(userFunction, { proxy: true }),
      publicApiSecurityOptions
    )
    const businessUserResource = businessUsersResource.addResource('{userId}')
    businessUserResource.addMethod(
      'GET',
      new LambdaIntegration(userFunction, { proxy: true }),
      publicApiSecurityOptions
    )
    const consumerResource = api.root.addResource('consumer')
    const consumerUsersResource = consumerResource.addResource('users')
    consumerUsersResource.addMethod(
      'POST',
      new LambdaIntegration(userFunction, { proxy: true }),
      publicApiSecurityOptions
    )
    const consumerUserResource = consumerUsersResource.addResource('{userId}')
    consumerUserResource.addMethod(
      'GET',
      new LambdaIntegration(userFunction, { proxy: true }),
      publicApiSecurityOptions
    )

    // Internal APIs

    const internalApiSecurityOptions: MethodOptions = {
      authorizationType: AuthorizationType.IAM,
    }

    // NOTE: API Key is currently generated by us and delivered to customers manually.
    // This endpoint will be used by Flagright console UI and customers can generate
    // the API keys by themselves.

    const apiKeyResource = api.root.addResource('apikey')
    apiKeyResource.addMethod(
      'POST',
      new LambdaIntegration(apiKeyGeneratorFunction),
      internalApiSecurityOptions
    )

    const ruleInstancesResource = api.root.addResource('rule_instances')
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
    new CfnOutput(this, 'API Gateway endpoint URL for Prod stage', {
      value: api.urlForPath('/'),
    })
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
