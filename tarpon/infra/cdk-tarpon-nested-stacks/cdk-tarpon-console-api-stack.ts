import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { FunctionProps } from 'aws-cdk-lib/aws-lambda'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { DomainName } from 'aws-cdk-lib/aws-apigateway'
import {
  ArnPrincipal,
  Effect,
  IRole,
  ManagedPolicy,
  Policy,
  PolicyStatement,
  Role,
} from 'aws-cdk-lib/aws-iam'
import {
  StackConstants,
  getNameForGlobalResource,
  getResourceNameForTarpon,
} from '@lib/constants'
import { Config } from '@flagright/lib/config/config'
import { Duration } from 'aws-cdk-lib'
import { createApiGateway } from '../cdk-utils/cdk-apigateway-utils'
import { createFunction } from '../cdk-utils/cdk-lambda-utils'
import { createAPIGatewayThrottlingAlarm } from '../cdk-utils/cdk-cw-alarms-utils'

interface ConsoleLambdasProps extends cdk.NestedStackProps {
  config: Config
  lambdaExecutionRole: IRole
  functionProps: Partial<FunctionProps>
  betterUptimeCloudWatchTopic: Topic
  domainName?: DomainName
}

export class CdkTarponConsoleLambdaStack extends cdk.NestedStack {
  config: Config
  functionProps: Partial<FunctionProps>
  constructor(scope: Construct, id: string, props: ConsoleLambdasProps) {
    super(scope, id, props)
    this.config = props.config
    const { lambdaExecutionRole, betterUptimeCloudWatchTopic, domainName } =
      props

    const importBucketName = getNameForGlobalResource(
      StackConstants.S3_IMPORT_BUCKET_PREFIX,
      this.config
    )
    const documentBucketName = getNameForGlobalResource(
      StackConstants.S3_DOCUMENT_BUCKET_PREFIX,
      this.config
    )
    this.functionProps = props.functionProps

    const { api: consoleApi, logGroup: consoleApiLogGroup } = createApiGateway(
      this,
      StackConstants.CONSOLE_API_NAME
    )
    if (domainName) {
      domainName.addBasePathMapping(consoleApi, {
        basePath: 'console',
      })
    }

    createAPIGatewayThrottlingAlarm(
      this,
      betterUptimeCloudWatchTopic,
      consoleApiLogGroup,
      StackConstants.CONSOLE_API_GATEWAY_THROTTLING_ALARM_NAME,
      consoleApi.restApiName
    )

    /* JWT Authorizer */
    const { alias: jwtAuthorizerAlias, func: jwtAuthorizerFunction } =
      createFunction(this, lambdaExecutionRole, {
        name: StackConstants.JWT_AUTHORIZER_FUNCTION_NAME,
        provisionedConcurrency:
          this.config.resource.JWT_AUTHORIZER_LAMBDA.PROVISIONED_CONCURRENCY,
      })
    const jwtAuthorizerBaseRoleName = getNameForGlobalResource(
      StackConstants.JWT_AUTHORIZER_BASE_ROLE_NAME,
      this.config
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
          // dynamodb:GetItem and DynamoDB:PutItem and DeleteItem
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
              'dynamodb:GetItem',
              'dynamodb:PutItem',
              'dynamodb:DeleteItem',
            ],
            resources: ['*'],
          }),
        ],
      })
    )
    jwtAuthorizerFunction.addEnvironment(
      'AUTHORIZER_BASE_ROLE_ARN',
      jwtAuthorizerBaseRole.roleArn
    )

    const { alias: presignedUrlAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_GET_PRESIGNED_URL_FUNCTION_NAME,
      }
    )

    presignedUrlAlias?.role?.attachInlinePolicy(
      new Policy(this, getResourceNameForTarpon('PresignedUrlPolicy'), {
        policyName: getResourceNameForTarpon('PresignedUrlPolicy'),
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['s3:PutObject', 's3:GetObject'],
            resources: [
              `arn:aws:s3:::${importBucketName}/*`,
              `arn:aws:s3:::${documentBucketName}/*`,
            ],
          }),
        ],
      })
    )

    /* Rule Template */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_RULE_FUNCTION_NAME,
    })

    /* Rule Instance */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_RULE_INSTANCE_FUNCTION_NAME,
    })

    /* Transactions view */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_TRANSACTIONS_VIEW_FUNCTION_NAME,
      memorySize: this.config.resource.TRANSACTIONS_VIEW_LAMBDA?.MEMORY_SIZE,
      provisionedConcurrency:
        this.config.resource.TRANSACTIONS_VIEW_LAMBDA.PROVISIONED_CONCURRENCY,
    })

    /* Accounts */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_ACCOUNT_FUNCTION_NAME,
    })

    /* Roles */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_ROLE_FUNCTION_NAME,
    })

    /* Tenants */
    const { alias: tenantsFunctionAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_TENANT_FUNCTION_NAME,
        provisionedConcurrency:
          this.config.resource.TENANT_LAMBDA.PROVISIONED_CONCURRENCY,
        memorySize: this.config.resource.TENANT_LAMBDA.MEMORY_SIZE,
      }
    )

    tenantsFunctionAlias.role?.attachInlinePolicy(
      new Policy(this, getResourceNameForTarpon('TenantApiPolicy'), {
        policyName: getResourceNameForTarpon('TenantApiPolicy'),
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['apigateway:POST', 'apigateway:GET'],
            resources: [
              'arn:aws:apigateway:*::/apikeys',
              'arn:aws:apigateway:*::/usageplans/*/keys',
              'arn:aws:apigateway:*::/usageplans',
              'arn:aws:apigateway:*::/restapis',
              'arn:aws:apigateway:*::/usageplans/*/usage',
              'arn:aws:apigateway:*::/apikeys/*',
            ],
          }),
        ],
      })
    )

    /* Business users view */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_BUSINESS_USERS_VIEW_FUNCTION_NAME,
      provisionedConcurrency:
        this.config.resource.USERS_VIEW_LAMBDA.PROVISIONED_CONCURRENCY,
      memorySize: this.config.resource.USERS_VIEW_LAMBDA.MEMORY_SIZE,
    })

    /* Copilot */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_COPILOT_FUNCTION_NAME,
      memorySize: this.config.resource.COPILOT_LAMBDA?.MEMORY_SIZE ?? 1024,
    })

    /* Notifications */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_NOTIFICATIONS_FUNCTION_NAME,
    })

    /* Consumer users view */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_CONSUMER_USERS_VIEW_FUNCTION_NAME,
      provisionedConcurrency:
        this.config.resource.USERS_VIEW_LAMBDA.PROVISIONED_CONCURRENCY,
      memorySize: this.config.resource.USERS_VIEW_LAMBDA.MEMORY_SIZE,
    })

    /* All users view */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_ALL_USERS_VIEW_FUNCTION_NAME,
      provisionedConcurrency:
        this.config.resource.USERS_VIEW_LAMBDA.PROVISIONED_CONCURRENCY,
      memorySize: this.config.resource.USERS_VIEW_LAMBDA.MEMORY_SIZE,
    })

    /* dashboard stats */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_DASHBOARD_STATS_FUNCTION_NAME,
      provisionedConcurrency:
        this.config.resource.DASHBOARD_LAMBDA.PROVISIONED_CONCURRENCY,
      memorySize: this.config.resource.DASHBOARD_LAMBDA.MEMORY_SIZE,
    })

    /* List Importer */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_LISTS_FUNCTION_NAME,
    })

    /* Case */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_CASE_FUNCTION_NAME,
      memorySize: this.config.resource.CASE_LAMBDA?.MEMORY_SIZE,
    })

    /* Webhook */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_WEBHOOK_CONFIGURATION_FUNCTION_NAME,
    })
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_INCOMING_WEBHOOKS_FUNCTION_NAME,
      memorySize: this.config.resource.INCOMING_WEBHOOK_LAMBDA?.MEMORY_SIZE,
    })

    /* Simulation */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_SIMULATION_FUNCTION_NAME,
    })

    /* Sanctions */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_SANCTIONS_FUNCTION_NAME,
      memorySize: this.config.resource.SANCTIONS_LAMBDA?.MEMORY_SIZE ?? 1024,
    })
    /* Risk Classification function */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_RISK_CLASSIFICATION_FUNCTION_NAME,
    })

    /* Manual User Risk Assignment function */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_MANUAL_USER_RISK_ASSIGNMENT_FUNCTION_NAME,
    })
    /* Parameter risk level assignment function */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_PARAMETER_RISK_ASSIGNMENT_FUNCTION_NAME,
    })

    /* Get Risk Scores */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_RISK_LEVEL_AND_SCORE_FUNCTION_NAME,
    })
    /* Audit Log */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_AUDIT_LOG_FUNCTION_NAME,
    })
    /* API Key Generator */
    const { alias: apiKeyGeneratorAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_API_KEY_GENERATOR_FUNCTION_NAME,
        memorySize:
          this.config.resource.API_KEY_GENERATOR_LAMBDA?.MEMORY_SIZE ??
          this.config.resource.LAMBDA_DEFAULT.MEMORY_SIZE,
      },
      { timeout: Duration.minutes(4) }
    )

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

    /* Slack App Configuration */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_SLACK_APP_FUNCTION_NAME,
    })

    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_SAR_FUNCTION_NAME,
    })

    /**
     * Outputs
     */
    new cdk.CfnOutput(this, 'API Gateway endpoint URL - Console API', {
      value: consoleApi.urlForPath('/'),
    })
  }
}
