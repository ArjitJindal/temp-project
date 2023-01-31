import { Config } from './configs/config'

function getSuffix(): string {
  let suffix = ''
  if (process.env.ENV === 'dev:user') {
    suffix =
      (process.env.GITHUB_USER || '').replace(/-/g, '') +
      (process.env.S_NO || '1')
  }
  return suffix
}

export function getResourceName(resourceName: string) {
  const suffix = getSuffix()
  return `${resourceName}${suffix}`
}

export function getResourceNameForTarpon(
  resourceName: string,
  dash = false,
  ignoreSuffix = false
) {
  const suffix = ignoreSuffix ? '' : getSuffix()
  return `tarpon${dash ? '-' : ''}${resourceName}${suffix}`
}

export function getResourceNameForHammerhead(
  resourceName: string,
  dash = false,
  ignoreSuffix = false
) {
  const suffix = ignoreSuffix ? '' : getSuffix()
  return `hammerhead${dash ? '-' : ''}${resourceName}${suffix}`
}

export function getNameForGlobalResource(name: string, config: Config) {
  return `${name + (config.stage ? `-${config.stage}` : '')}-${
    config.env.region ? config.env.region : 'eu-central-1'
  }`
}

export const StackConstants = {
  TARPON_DYNAMODB_TABLE_NAME: 'Tarpon',
  TARPON_RULE_DYNAMODB_TABLE_NAME: 'TarponRule',
  TRANSIENT_DYNAMODB_TABLE_NAME: 'Transient',
  DYNAMODB_TTL_ATTRIBUTE_NAME: '_ttl',
  MONGO_DB_DATABASE_NAME: 'tarpon',
  MONGO_DB_USERNAME_NAME: 'tarponUser',
  S3_DEMO_MODE_BUCKET_NAME: 'demo-mode-data-files',
  API_KEY_AUTHORIZER_BASE_ROLE_NAME: getResourceNameForTarpon(
    'ApiKeyAuthorizerBaseRole'
  ),
  JWT_AUTHORIZER_BASE_ROLE_NAME: getResourceNameForTarpon(
    'JwtAuthorizerBaseRole'
  ),
  S3_IMPORT_BUCKET_PREFIX: getResourceNameForTarpon('import', true, true),
  S3_DOCUMENT_BUCKET_PREFIX: getResourceNameForTarpon('document', true, true),
  S3_TMP_BUCKET_PREFIX: getResourceNameForTarpon('tmp', true, true),

  // Lambda names
  CONSOLE_API_ACCOUNT_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiAccountFunction'
  ),
  CONSOLE_API_TENANT_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiTenantFunction'
  ),
  API_KEY_AUTHORIZER_FUNCTION_NAME: getResourceNameForTarpon(
    'ApiKeyAuthorizerFunction'
  ),
  JWT_AUTHORIZER_FUNCTION_NAME: getResourceNameForTarpon(
    'JWTAuthorizerFunction'
  ),
  PUBLIC_API_TRANSACTION_FUNCTION_NAME: getResourceNameForTarpon(
    'PublicApiTransactionFunction'
  ),
  PUBLIC_API_TRANSACTION_EVENT_FUNCTION_NAME: getResourceNameForTarpon(
    'PublicApiTransactionEventFunction'
  ),
  PUBLIC_API_USER_FUNCTION_NAME: getResourceNameForTarpon(
    'PublicApiUserFunction'
  ),
  PUBLIC_API_USER_EVENT_FUNCTION_NAME: getResourceNameForTarpon(
    'PublicApiUserEventFunction'
  ),
  API_KEY_GENERATOR_FUNCTION_NAME: getResourceNameForTarpon(
    'ApiKeyGeneratorFunction'
  ),
  PUBLIC_MANAGEMENT_API_RULE_FUNCTION_NAME: getResourceNameForTarpon(
    'PublicManagementApiRuleFunction'
  ),
  PUBLIC_DEVICE_DATA_API_FUNCTION_NAME: getResourceNameForTarpon(
    'PublicDeviceDataApiMetricFunction'
  ),
  PUBLIC_MANAGEMENT_API_RULE_INSTANCE_FUNCTION_NAME: getResourceNameForTarpon(
    'PublicManagementApiRuleInstanceFunction'
  ),
  CONSOLE_API_RULE_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiRuleTemplateFunction'
  ),
  CONSOLE_API_RULE_INSTANCE_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiRuleInstanceFunction'
  ),
  CONSOLE_API_TRANSACTIONS_VIEW_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiTransactionsViewFunction'
  ),
  CONSOLE_API_DASHBOARD_STATS_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiDashboardStatsFunction'
  ),
  TRANSACTION_COMMENTS_FUNCTION_NAME: getResourceNameForTarpon(
    'TransactionsCommentsFunction'
  ),
  CONSOLE_API_BUSINESS_USERS_VIEW_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiBusinessUsersViewFunction'
  ),
  CONSOLE_API_CONSUMER_USERS_VIEW_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiConsumersUsersViewFunction'
  ),
  CONSOLE_API_ALL_USERS_VIEW_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiAllUsersViewFunction'
  ),
  CONSOLE_API_FILE_IMPORT_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiFileImportFunction'
  ),
  CONSOLE_API_GET_PRESIGNED_URL_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiGetPresignedUrlFunction'
  ),
  CONSOLE_API_LISTS_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiListsFunction'
  ),
  TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME:
    getResourceNameForTarpon('TarponChangeCaptureKinesisConsumerFunction'),
  TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_RETRY_FUNCTION_NAME:
    getResourceNameForTarpon('TarponChangeCaptureKinesisConsumerRetryFunction'),
  SLACK_APP_FUNCTION_NAME: getResourceNameForTarpon('SlackAppFunction'),
  SLACK_ALERT_FUNCTION_NAME: getResourceNameForTarpon('SlackAlertFunction'),
  CONSOLE_API_WEBHOOK_CONFIGURATION_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiWebhookConfigurationFunction'
  ),
  WEBHOOK_DELIVERER_FUNCTION_NAME: getResourceNameForTarpon(
    'WebhookDelivererFunction'
  ),
  WEBHOOK_TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME:
    getResourceNameForTarpon('WebhookTarponChangeCaptureFunction'),
  WEBHOOK_TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_RETRY_FUNCTION_NAME:
    getResourceNameForTarpon('WebhookTarponChangeCaptureRetryFunction'),
  SANCTIONS_FUNCTION_NAME: getResourceNameForTarpon('SanctionsFunction'),
  LAMBDA_LATEST_ALIAS_NAME: 'LATEST',
  JWT_AUTHORIZER_CACHE_TTL_SECONDS: 3600,
  API_KEY_AUTHORIZER_CACHE_TTL_SECONDS: 3600,
  AUDIT_LOG_CONSUMER_FUNCTION_NAME: getResourceNameForTarpon(
    'AuditLogConsumerFunction'
  ),
  AUDIT_LOG_TOPIC_NAME: getResourceName('AuditLogTopic'),
  BETTER_UPTIME_CLOUD_WATCH_TOPIC_NAME: getResourceName(
    'BetterUptimeCloudWatchTopic'
  ),
  BETTER_UPTIME_SUBSCRIPTION_NAME: getResourceName('Subscription'),
  FAST_GEOIP_LAYER_NAME: getResourceName('fast-geoip-layer'),
  TARPON_API_NAME: getResourceName('TarponAPI'),
  TARPON_API_GATEWAY_ALARM_NAME: getResourceName('TarponApiErrorPercentage'),
  TARPON_API_GATEWAY_THROTTLING_ALARM_NAME: getResourceName(
    'TarponApiThrottlingCount'
  ),
  TARPON_MANAGEMENT_API_NAME: getResourceName('TarponManagementAPI'),
  TARPON_DEVICE_DATA_API_NAME: getResourceName('TarponDeviceDataAPI'),
  TARPON_MANAGEMENT_API_GATEWAY_ALARM_NAME: getResourceName(
    'TarponManagementApiErrorPercentage'
  ),
  TARPON_MANAGEMENT_API_GATEWAY_THROTTLING_ALARM_NAME: getResourceName(
    'TarponManagementApiThrottlingCount'
  ),
  CONSOLE_API_NAME: getResourceName('TarponAPI-console'),
  CONSOLE_API_GATEWAY_ALARM_NAME: getResourceName(
    'ConsoleTarponApiErrorPercentage'
  ),
  CONSOLE_API_GATEWAY_THROTTLING_ALARM_NAME: getResourceName(
    'ConsoleApiThrottlingCount'
  ),
  HAMMERHEAD_DYNAMODB_TABLE_NAME: 'Hammerhead',
  HAMMERHEAD_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME:
    getResourceNameForHammerhead('ChangeCaptureKinesisConsumer'),
  HAMMERHEAD_CHANGE_CAPTURE_KINESIS_CONSUMER_RETRY_FUNCTION_NAME:
    getResourceNameForHammerhead('ChangeCaptureKinesisConsumerRetry'),
  CONSOLE_API_RISK_CLASSIFICATION_FUNCTION_NAME: getResourceNameForHammerhead(
    'ConsoleApiRiskClassificationFunction'
  ),
  CONSOLE_API_MANUAL_USER_RISK_ASSIGNMENT_FUNCTION_NAME:
    getResourceNameForHammerhead('ConsoleApiManualUserRiskAssignmentFunction'),
  CONSOLE_API_PARAMETER_RISK_ASSIGNMENT_FUNCTION_NAME:
    getResourceNameForHammerhead('ConsoleApiParameterRiskAssignmentFunction'),
  CONSOLE_API_RISK_LEVEL_AND_SCORE_FUNCTION_NAME: getResourceNameForHammerhead(
    'ConsoleApiRiskLevelAndScoreFunction'
  ),
  CONSOLE_API_SIMULATION_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiSimulationFunction'
  ),
  AUDIT_LOG_FUNCTION_NAME: getResourceNameForHammerhead('AuditLogFunction'),
  NUMBER_OF_RISK_LEVELS: 5,
  TARPON_STREAM_ID: 'tarponStream',
  TARPON_STREAM_NAME: 'tarponDynamoChangeCaptureStream',
  HAMMERHEAD_STREAM_ID: 'hammerheadStream',
  HAMMERHEAD_STREAM_NAME: 'hammerheadDynamoChangeCaptureStream',
  DATA_MIGRATION_CODEBUILD_PROJECT_NAME: 'DataMigration',
  CONSOLE_API_CASE_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiCaseFunction'
  ),
  BATCH_JOB_TRIGGER_CONSUMER_FUNCTION_NAME: getResourceNameForTarpon(
    'BatchJobTriggerConsumerFunction'
  ),
  BATCH_JOB_DECISION_FUNCTION_NAME: getResourceNameForTarpon(
    'BatchJobDecisionFunction'
  ),
  BATCH_JOB_RUNNER_FUNCTION_NAME: getResourceNameForTarpon(
    'BatchJobRunnerFunction'
  ),
}

export const SQSQueues = {
  AUDIT_LOG_QUEUE_NAME: getResourceName('AuditLogQueue'),
  SLACK_ALERT_QUEUE_NAME: getResourceName('SlackAlertQueue'),
  WEBHOOK_DELIVERY_QUEUE_NAME: getResourceName('WebhookDeliveryQueue'),
  BATCH_JOB_QUEUE_NAME: getResourceName('BatchJobQueue'),
  TARPON_CHANGE_CAPTURE_RETRY_QUEUE_NAME: getResourceName(
    'TarponChangeCaptureRetryQueue'
  ),
  WEBHOOK_TARPON_CHANGE_CAPTURE_RETRY_QUEUE_NAME: getResourceName(
    'WebhookTarponChangeCaptureRetryQueue'
  ),
  HAMMERHEAD_CHANGE_CAPTURE_RETRY_QUEUE_NAME: getResourceName(
    'HammerheadChangeCaptureRetryQueue'
  ),
}

export function getDeadLetterQueueName(queueName: string) {
  return `DeadLetter${queueName}`
}
