import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { FunctionProps } from 'aws-cdk-lib/aws-lambda'
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { Queue } from 'aws-cdk-lib/aws-sqs'
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
import { Duration } from 'aws-cdk-lib'
import {
  StackConstants,
  getNameForGlobalResource,
  getResourceNameForTarpon,
} from '@lib/constants'
import { Config } from '@lib/configs/config'
import { createApiGateway } from '../cdk-utils/cdk-apigateway-utils'
import { createFunction } from '../cdk-utils/cdk-lambda-utils'
import { createAPIGatewayThrottlingAlarm } from '../cdk-utils/cdk-cw-alarms-utils'

interface ConsoleLambdasProps extends cdk.NestedStackProps {
  config: Config
  lambdaExecutionRole: IRole
  securityGroup: SecurityGroup
  vpc: Vpc
  auditLogTopic: Topic
  batchJobQueue: Queue
  webhookDeliveryQueue: Queue
  betterUptimeCloudWatchTopic: Topic
  domainName?: DomainName
}

export class CdkTarponConsoleLambdaStack extends cdk.NestedStack {
  config: Config

  constructor(scope: Construct, id: string, props: ConsoleLambdasProps) {
    super(scope, id, props)
    this.config = props.config
    const {
      lambdaExecutionRole,
      securityGroup,
      vpc,
      auditLogTopic,
      batchJobQueue,
      webhookDeliveryQueue,
      betterUptimeCloudWatchTopic,
      domainName,
    } = props

    const importBucketName = getNameForGlobalResource(
      StackConstants.S3_IMPORT_BUCKET_PREFIX,
      this.config
    )
    const documentBucketName = getNameForGlobalResource(
      StackConstants.S3_DOCUMENT_BUCKET_PREFIX,
      this.config
    )
    const tmpBucketName = getNameForGlobalResource(
      StackConstants.S3_TMP_BUCKET_PREFIX,
      this.config
    )
    const functionProps: Partial<FunctionProps> = {
      securityGroups: this.config.resource.LAMBDA_VPC_ENABLED
        ? [securityGroup]
        : undefined,
      vpc: this.config.resource.LAMBDA_VPC_ENABLED ? vpc : undefined,
      environment: {
        ...Object.entries(this.config.application).reduce<{
          [key: string]: string | number
        }>((acc, [key, value]) => {
          acc[key] = value
          return acc
        }, {}),
        SM_SECRET_ARN: this.config.application.ATLAS_CREDENTIALS_SECRET_ARN,
        WEBHOOK_DELIVERY_QUEUE_URL: webhookDeliveryQueue.queueUrl,
        TMP_BUCKET: tmpBucketName,
        DOCUMENT_BUCKET: documentBucketName,
        IMPORT_BUCKET: importBucketName,
        AUTH0_AUDIENCE: this.config.application.AUTH0_AUDIENCE,
      },
    }

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
      createFunction(
        this,
        lambdaExecutionRole,
        {
          name: StackConstants.JWT_AUTHORIZER_FUNCTION_NAME,
          provisionedConcurrency:
            this.config.resource.JWT_AUTHORIZER_LAMBDA.PROVISIONED_CONCURRENCY,
          auditLogTopic,
          batchJobQueue,
        },
        {
          environment: {
            AUTH0_AUDIENCE: this.config.application.AUTH0_AUDIENCE,
            AUTH0_DOMAIN: this.config.application.AUTH0_DOMAIN,
          },
        }
      )
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
        ],
      })
    )
    jwtAuthorizerFunction.addEnvironment(
      'AUTHORIZER_BASE_ROLE_ARN',
      jwtAuthorizerBaseRole.roleArn
    )

    /* File Import */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_FILE_IMPORT_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    const { alias: presignedUrlAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_GET_PRESIGNED_URL_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
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
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_RULE_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /* Rule Instance */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_RULE_INSTANCE_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /* Transactions view */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_TRANSACTIONS_VIEW_FUNCTION_NAME,
        memorySize: this.config.resource.TRANSACTIONS_VIEW_LAMBDA?.MEMORY_SIZE,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /* Accounts */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_ACCOUNT_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /* Roles */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_ROLE_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      {
        ...functionProps,
        environment: {
          ...functionProps.environment,
        },
      }
    )

    /* Tenants */
    const { alias: tenantsFunctionAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_TENANT_FUNCTION_NAME,
        provisionedConcurrency:
          this.config.resource.TENANT_LAMBDA.PROVISIONED_CONCURRENCY,
        memorySize: this.config.resource.TENANT_LAMBDA.MEMORY_SIZE,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
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
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_BUSINESS_USERS_VIEW_FUNCTION_NAME,
        provisionedConcurrency:
          this.config.resource.USERS_VIEW_LAMBDA.PROVISIONED_CONCURRENCY,
        memorySize: this.config.resource.USERS_VIEW_LAMBDA.MEMORY_SIZE,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /* Merchant Monitoring */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_MERCHANT_MONITORING_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /* Copilot */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_COPILOT_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /* Consumer users view */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_CONSUMER_USERS_VIEW_FUNCTION_NAME,
        provisionedConcurrency:
          this.config.resource.USERS_VIEW_LAMBDA.PROVISIONED_CONCURRENCY,
        memorySize: this.config.resource.USERS_VIEW_LAMBDA.MEMORY_SIZE,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /* All users view */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_ALL_USERS_VIEW_FUNCTION_NAME,
        provisionedConcurrency:
          this.config.resource.USERS_VIEW_LAMBDA.PROVISIONED_CONCURRENCY,
        memorySize: this.config.resource.USERS_VIEW_LAMBDA.MEMORY_SIZE,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /* dashboard stats */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_DASHBOARD_STATS_FUNCTION_NAME,
        provisionedConcurrency:
          this.config.resource.DASHBOARD_LAMBDA.PROVISIONED_CONCURRENCY,
        memorySize: this.config.resource.DASHBOARD_LAMBDA.MEMORY_SIZE,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /* List Importer */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_LISTS_FUNCTION_NAME,
      auditLogTopic,
      batchJobQueue,
    })

    /* Case */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_CASE_FUNCTION_NAME,
        memorySize: this.config.resource.CASE_LAMBDA?.MEMORY_SIZE,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /* Webhook */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_WEBHOOK_CONFIGURATION_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_INCOMING_WEBHOOKS_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /* Simulation */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_SIMULATION_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /* Device Data */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_DEVICE_DATA_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /* Sanctions */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_SANCTIONS_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )
    /* Risk Classification function */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_RISK_CLASSIFICATION_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /* Manual User Risk Assignment function */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_MANUAL_USER_RISK_ASSIGNMENT_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )
    /* Parameter risk level assignment function */
    createFunction(this, lambdaExecutionRole, {
      name: StackConstants.CONSOLE_API_PARAMETER_RISK_ASSIGNMENT_FUNCTION_NAME,
      auditLogTopic,
      batchJobQueue,
    })

    /* NarrativeTemplate function */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_NARRATIVE_TEMPLATE_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /* Checklist template function */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_CHECKLIST_TEMPLATE_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /* Get Risk Scores */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_RISK_LEVEL_AND_SCORE_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )
    /* Audit Log */
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_AUDIT_LOG_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )
    /* API Key Generator */
    const { alias: apiKeyGeneratorAlias } = createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_API_KEY_GENERATOR_FUNCTION_NAME,
        memorySize:
          this.config.resource.API_KEY_GENERATOR_LAMBDA?.MEMORY_SIZE ??
          this.config.resource.LAMBDA_DEFAULT.MEMORY_SIZE,
        auditLogTopic,
        batchJobQueue,
      },
      {
        ...functionProps,
        timeout: Duration.minutes(4),
      }
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
    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_SLACK_APP_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    createFunction(
      this,
      lambdaExecutionRole,
      {
        name: StackConstants.CONSOLE_API_SAR_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      functionProps
    )

    /**
     * Outputs
     */
    new cdk.CfnOutput(this, 'API Gateway endpoint URL - Console API', {
      value: consoleApi.urlForPath('/'),
    })
  }
}
