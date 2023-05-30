import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { FunctionProps } from 'aws-cdk-lib/aws-lambda'
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2'
import { ITable } from 'aws-cdk-lib/aws-dynamodb'
import { IBucket } from 'aws-cdk-lib/aws-s3'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { DomainName } from 'aws-cdk-lib/aws-apigateway'
import {
  ArnPrincipal,
  Effect,
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
import {
  grantMongoDbAccess,
  grantSecretsManagerAccess,
  grantSecretsManagerAccessByPattern,
  grantSecretsManagerAccessByPrefix,
} from '../cdk-utils/cdk-iam-utils'
import { createAPIGatewayThrottlingAlarm } from '../cdk-utils/cdk-cw-alarms-utils'

interface ConsoleLambdasProps extends cdk.NestedStackProps {
  config: Config
  tarponDynamoDbTable: ITable
  tarponRuleDynamoDbTable: ITable
  hammerheadDynamoDbTable: ITable
  s3TmpBucket: IBucket
  s3ImportBucket: IBucket
  s3DocumentBucket: IBucket
  s3demoModeBucket: IBucket
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
      tarponDynamoDbTable,
      tarponRuleDynamoDbTable,
      hammerheadDynamoDbTable,
      securityGroup,
      vpc,
      s3TmpBucket,
      s3ImportBucket,
      s3DocumentBucket,
      s3demoModeBucket,
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
    const atlasFunctionProps: Partial<FunctionProps> = {
      securityGroups: this.config.resource.LAMBDA_VPC_ENABLED
        ? [securityGroup]
        : undefined,
      vpc: this.config.resource.LAMBDA_VPC_ENABLED ? vpc : undefined,
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
    const { alias: fileImportAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_FILE_IMPORT_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      {
        ...atlasFunctionProps,
        environment: {
          ...atlasFunctionProps.environment,
          IMPORT_BUCKET: importBucketName,
          TMP_BUCKET: tmpBucketName,
        },
      }
    )
    tarponDynamoDbTable.grantReadWriteData(fileImportAlias)
    s3TmpBucket.grantRead(fileImportAlias)
    s3ImportBucket.grantWrite(fileImportAlias)
    grantMongoDbAccess(this, fileImportAlias)

    const { alias: getPresignedUrlAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_GET_PRESIGNED_URL_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      {
        environment: {
          TMP_BUCKET: tmpBucketName,
        },
      }
    )
    s3TmpBucket.grantPut(getPresignedUrlAlias)

    /* Rule Template */
    const { alias: ruleAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_RULE_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      atlasFunctionProps
    )
    tarponDynamoDbTable.grantWriteData(ruleAlias)
    tarponRuleDynamoDbTable.grantReadWriteData(ruleAlias)
    grantMongoDbAccess(this, ruleAlias)

    /* Rule Instance */
    const { alias: ruleInstanceAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_RULE_INSTANCE_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      atlasFunctionProps
    )
    tarponDynamoDbTable.grantReadWriteData(ruleInstanceAlias)
    tarponRuleDynamoDbTable.grantReadWriteData(ruleInstanceAlias)
    grantMongoDbAccess(this, ruleInstanceAlias)

    /* Transactions view */
    const { alias: transactionsViewAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_TRANSACTIONS_VIEW_FUNCTION_NAME,
        memorySize: this.config.resource.TRANSACTIONS_VIEW_LAMBDA?.MEMORY_SIZE,
        auditLogTopic,
        batchJobQueue,
      },
      {
        ...atlasFunctionProps,
        environment: {
          ...atlasFunctionProps.environment,
          ...{
            TMP_BUCKET: tmpBucketName,
            DOCUMENT_BUCKET: documentBucketName,
          },
        },
      }
    )
    tarponDynamoDbTable.grantReadWriteData(transactionsViewAlias)
    hammerheadDynamoDbTable.grantReadData(transactionsViewAlias)
    s3TmpBucket.grantRead(transactionsViewAlias)
    s3DocumentBucket.grantWrite(transactionsViewAlias)
    grantMongoDbAccess(this, transactionsViewAlias)

    /* Accounts */
    const { alias: accountsFunctionAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_ACCOUNT_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      atlasFunctionProps
    )
    grantSecretsManagerAccessByPattern(
      this,
      accountsFunctionAlias,
      'auth0.com',
      'READ'
    )
    tarponDynamoDbTable.grantReadWriteData(accountsFunctionAlias)
    grantMongoDbAccess(this, accountsFunctionAlias)

    /* Roles */
    const { alias: rolesFunctionAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_ROLE_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      {
        ...atlasFunctionProps,
        environment: {
          ...atlasFunctionProps.environment,
          AUTH0_AUDIENCE: this.config.application.AUTH0_AUDIENCE,
        },
      }
    )
    grantSecretsManagerAccessByPattern(
      this,
      rolesFunctionAlias,
      'auth0.com',
      'READ'
    )

    /* Tenants */
    const { alias: tenantsFunctionAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_TENANT_FUNCTION_NAME,
        provisionedConcurrency:
          this.config.resource.TENANT_LAMBDA.PROVISIONED_CONCURRENCY,
        memorySize: this.config.resource.TENANT_LAMBDA.MEMORY_SIZE,
        auditLogTopic,
        batchJobQueue,
      },
      atlasFunctionProps
    )
    grantSecretsManagerAccessByPattern(
      this,
      tenantsFunctionAlias,
      'auth0.com',
      'READ'
    )
    grantMongoDbAccess(this, tenantsFunctionAlias)

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
            ],
          }),
        ],
      })
    )

    /* Business users view */
    const { alias: businessUsersViewAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_BUSINESS_USERS_VIEW_FUNCTION_NAME,
        provisionedConcurrency:
          this.config.resource.USERS_VIEW_LAMBDA.PROVISIONED_CONCURRENCY,
        memorySize: this.config.resource.USERS_VIEW_LAMBDA.MEMORY_SIZE,
        auditLogTopic,
        batchJobQueue,
      },
      {
        ...atlasFunctionProps,
        environment: {
          ...atlasFunctionProps.environment,
          ...{
            TMP_BUCKET: tmpBucketName,
            DOCUMENT_BUCKET: documentBucketName,
          },
        },
      }
    )
    grantMongoDbAccess(this, businessUsersViewAlias)

    /* Merchant Monitoring */
    const { alias: merchantMonitoringAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_MERCHANT_MONITORING_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      atlasFunctionProps
    )

    grantMongoDbAccess(this, merchantMonitoringAlias)
    grantSecretsManagerAccess(
      this,
      merchantMonitoringAlias,
      [this.config.application.OPENAI_CREDENTIALS_SECRET_ARN],
      'READ'
    )

    /* Copilot */
    const { alias: copilotAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_COPILOT_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      atlasFunctionProps
    )

    grantMongoDbAccess(this, copilotAlias)
    grantSecretsManagerAccess(
      this,
      copilotAlias,
      [this.config.application.OPENAI_CREDENTIALS_SECRET_ARN],
      'READ'
    )

    /* Consumer users view */
    const { alias: consumerUsersViewAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_CONSUMER_USERS_VIEW_FUNCTION_NAME,
        provisionedConcurrency:
          this.config.resource.USERS_VIEW_LAMBDA.PROVISIONED_CONCURRENCY,
        memorySize: this.config.resource.USERS_VIEW_LAMBDA.MEMORY_SIZE,
        auditLogTopic,
        batchJobQueue,
      },
      {
        ...atlasFunctionProps,
        environment: {
          ...atlasFunctionProps.environment,
          ...{
            TMP_BUCKET: tmpBucketName,
            DOCUMENT_BUCKET: documentBucketName,
          },
        },
      }
    )
    grantMongoDbAccess(this, consumerUsersViewAlias)

    /* All users view */
    const { alias: allUsersViewAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_ALL_USERS_VIEW_FUNCTION_NAME,
        provisionedConcurrency:
          this.config.resource.USERS_VIEW_LAMBDA.PROVISIONED_CONCURRENCY,
        memorySize: this.config.resource.USERS_VIEW_LAMBDA.MEMORY_SIZE,
        auditLogTopic,
        batchJobQueue,
      },
      {
        ...atlasFunctionProps,
        environment: {
          ...atlasFunctionProps.environment,
          ...{
            TMP_BUCKET: tmpBucketName,
            DOCUMENT_BUCKET: documentBucketName,
          },
        },
      }
    )
    grantMongoDbAccess(this, allUsersViewAlias)
    grantSecretsManagerAccess(
      this,
      allUsersViewAlias,
      [this.config.application.OPENAI_CREDENTIALS_SECRET_ARN],
      'READ'
    )

    /* dashboard stats */
    const { alias: dashboardStatsAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_DASHBOARD_STATS_FUNCTION_NAME,
        provisionedConcurrency:
          this.config.resource.DASHBOARD_LAMBDA.PROVISIONED_CONCURRENCY,
        memorySize: this.config.resource.DASHBOARD_LAMBDA.MEMORY_SIZE,
        auditLogTopic,
        batchJobQueue,
      },
      atlasFunctionProps
    )
    grantMongoDbAccess(this, dashboardStatsAlias)
    hammerheadDynamoDbTable.grantReadData(dashboardStatsAlias)

    /* List Importer */
    const { alias: listsAlias } = createFunction(this, {
      name: StackConstants.CONSOLE_API_LISTS_FUNCTION_NAME,
      auditLogTopic,
      batchJobQueue,
    })
    tarponDynamoDbTable.grantReadWriteData(listsAlias)

    /* Case */
    const { alias: caseAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_CASE_FUNCTION_NAME,
        memorySize: this.config.resource.CASE_LAMBDA?.MEMORY_SIZE,
        auditLogTopic,
        batchJobQueue,
      },
      {
        ...atlasFunctionProps,
        environment: {
          ...atlasFunctionProps.environment,
          WEBHOOK_DELIVERY_QUEUE_URL: webhookDeliveryQueue.queueUrl,
          ...{
            TMP_BUCKET: tmpBucketName,
            DOCUMENT_BUCKET: documentBucketName,
          },
        },
      }
    )
    tarponDynamoDbTable.grantReadWriteData(caseAlias)
    hammerheadDynamoDbTable.grantReadData(caseAlias)
    s3TmpBucket.grantRead(caseAlias)
    s3DocumentBucket.grantWrite(caseAlias)
    webhookDeliveryQueue.grantSendMessages(caseAlias)
    grantMongoDbAccess(this, caseAlias)
    grantSecretsManagerAccessByPattern(this, caseAlias, 'auth0.com', 'READ')

    /* Webhook */
    const { alias: webhookConfigurationHandlerAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_WEBHOOK_CONFIGURATION_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      atlasFunctionProps
    )
    grantMongoDbAccess(this, webhookConfigurationHandlerAlias)
    grantSecretsManagerAccessByPrefix(
      this,
      webhookConfigurationHandlerAlias,
      'webhooks',
      'READ_WRITE'
    )
    const { alias: consoleApiWebhooksHandlerAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_WEBHOOKS_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      {
        ...atlasFunctionProps,
        environment: {
          ...atlasFunctionProps.environment,
          COMPLYADVANTAGE_API_KEY: process.env
            .COMPLYADVANTAGE_API_KEY as string,
          COMPLYADVANTAGE_DEFAULT_SEARCH_PROFILE_ID: this.config.application
            .COMPLYADVANTAGE_DEFAULT_SEARCH_PROFILE_ID as string,
        },
      }
    )
    grantSecretsManagerAccessByPattern(
      this,
      consoleApiWebhooksHandlerAlias,
      'auth0.com',
      'READ'
    )
    grantMongoDbAccess(this, consoleApiWebhooksHandlerAlias)
    grantSecretsManagerAccess(
      this,
      consoleApiWebhooksHandlerAlias,
      [this.config.application.COMPLYADVANTAGE_CREDENTIALS_SECRET_ARN],
      'READ'
    )

    /* Simulation */
    const { alias: simulationHandlerAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_SIMULATION_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      atlasFunctionProps
    )
    grantMongoDbAccess(this, simulationHandlerAlias)

    /* Device Data */
    const { alias: deviceDataHandlerAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_DEVICE_DATA_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      atlasFunctionProps
    )
    grantMongoDbAccess(this, deviceDataHandlerAlias)

    /* Sanctions */
    const { alias: consoleApiSanctionsHandlerAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_SANCTIONS_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      {
        ...atlasFunctionProps,
        environment: {
          ...atlasFunctionProps.environment,
          COMPLYADVANTAGE_API_KEY: process.env
            .COMPLYADVANTAGE_API_KEY as string,
          COMPLYADVANTAGE_DEFAULT_SEARCH_PROFILE_ID: this.config.application
            .COMPLYADVANTAGE_DEFAULT_SEARCH_PROFILE_ID as string,
        },
      }
    )
    grantMongoDbAccess(this, consoleApiSanctionsHandlerAlias)
    grantSecretsManagerAccess(
      this,
      consoleApiSanctionsHandlerAlias,
      [this.config.application.COMPLYADVANTAGE_CREDENTIALS_SECRET_ARN],
      'READ'
    )

    /* Risk Classification function */
    const { alias: riskClassificationAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_RISK_CLASSIFICATION_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      atlasFunctionProps
    )
    hammerheadDynamoDbTable.grantReadWriteData(riskClassificationAlias)

    /* Manual User Risk Assignment function */
    const { alias: manualUserRiskAssignmentAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_MANUAL_USER_RISK_ASSIGNMENT_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      atlasFunctionProps
    )
    hammerheadDynamoDbTable.grantReadWriteData(manualUserRiskAssignmentAlias)
    grantMongoDbAccess(this, manualUserRiskAssignmentAlias)

    /* Parameter risk level assignment function */
    const { alias: parameterRiskAssignmentAlias } = createFunction(this, {
      name: StackConstants.CONSOLE_API_PARAMETER_RISK_ASSIGNMENT_FUNCTION_NAME,
      auditLogTopic,
      batchJobQueue,
    })
    hammerheadDynamoDbTable.grantReadWriteData(parameterRiskAssignmentAlias)

    /* NarrativeTemplate function */
    const { alias: narrativeAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_NARRATIVE_TEMPLATE_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      atlasFunctionProps
    )

    grantMongoDbAccess(this, narrativeAlias)

    /* Get Risk Scores */
    const { alias: riskLevelAndScoreAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_RISK_LEVEL_AND_SCORE_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      atlasFunctionProps
    )
    hammerheadDynamoDbTable.grantReadWriteData(riskLevelAndScoreAlias)
    grantMongoDbAccess(this, riskLevelAndScoreAlias)

    /* Audit Log */
    const { alias: auditLogAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_AUDIT_LOG_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      {
        ...atlasFunctionProps,
        environment: {
          ...atlasFunctionProps.environment,
        },
      }
    )
    grantMongoDbAccess(this, auditLogAlias)

    /* API Key Generator */
    const { alias: apiKeyGeneratorAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_API_KEY_GENERATOR_FUNCTION_NAME,
        memorySize:
          this.config.resource.API_KEY_GENERATOR_LAMBDA?.MEMORY_SIZE ??
          this.config.resource.LAMBDA_DEFAULT.MEMORY_SIZE,
        auditLogTopic,
        batchJobQueue,
      },
      {
        ...atlasFunctionProps,
        timeout: Duration.minutes(4),
      }
    )
    grantMongoDbAccess(this, apiKeyGeneratorAlias)
    tarponDynamoDbTable.grantWriteData(apiKeyGeneratorAlias)
    s3demoModeBucket.grantRead(apiKeyGeneratorAlias)
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
    const { alias: slackAppAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_SLACK_APP_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      {
        ...atlasFunctionProps,
        environment: {
          ...atlasFunctionProps.environment,
          SLACK_CLIENT_ID: this.config.application.SLACK_CLIENT_ID,
          SLACK_CLIENT_SECRET: this.config.application.SLACK_CLIENT_SECRET,
          SLACK_REDIRECT_URI: this.config.application.SLACK_REDIRECT_URI,
        },
      }
    )
    grantMongoDbAccess(this, slackAppAlias)

    const { alias: sarAlias } = createFunction(
      this,
      {
        name: StackConstants.CONSOLE_API_SAR_FUNCTION_NAME,
        auditLogTopic,
        batchJobQueue,
      },
      atlasFunctionProps
    )
    s3TmpBucket.grantRead(sarAlias)
    s3DocumentBucket.grantWrite(sarAlias)
    grantMongoDbAccess(this, sarAlias)

    /**
     * Outputs
     */
    new cdk.CfnOutput(this, 'API Gateway endpoint URL - Console API', {
      value: consoleApi.urlForPath('/'),
    })
  }
}
