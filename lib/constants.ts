import { Config } from './configs/config'

function getSuffix(): string {
  let suffix = ''
  if (process.env.ENV === 'dev:user' && process.env.GITHUB_USER) {
    suffix = process.env.GITHUB_USER
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
  TRANSIENT_DYNAMODB_TABLE_NAME: 'Transient',
  DYNAMODB_TTL_ATTRIBUTE_NAME: '_ttl',
  MONGO_DB_DATABASE_NAME: 'tarpon',
  MONGO_DB_USERNAME_NAME: 'tarponUser',
  MONGO_DB_SECURITY_GROUP_NAME: 'atlas-lambda-sg',
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
  ACCOUNT_FUNCTION_NAME: getResourceNameForTarpon('AccountFunction'),
  TENANT_FUNCTION_NAME: getResourceNameForTarpon('TenantFunction'),
  API_KEY_AUTHORIZER_FUNCTION_NAME: getResourceNameForTarpon(
    'ApiKeyAuthorizerFunction'
  ),
  JWT_AUTHORIZER_FUNCTION_NAME: getResourceNameForTarpon(
    'JWTAuthorizerFunction'
  ),
  TRANSACTION_FUNCTION_NAME: getResourceNameForTarpon('TransactionFunction'),
  TRANSACTION_EVENT_FUNCTION_NAME: getResourceNameForTarpon(
    'TransactionEventFunction'
  ),
  USER_FUNCTION_NAME: getResourceNameForTarpon('UserFunction'),
  USER_EVENT_FUNCTION_NAME: getResourceNameForTarpon('UserEventFunction'),
  API_KEY_GENERATOR_FUNCTION_NAME: getResourceNameForTarpon(
    'ApiKeyGeneratorFunction'
  ),
  RULE_FUNCTION_NAME: getResourceNameForTarpon('RuleTemplateFunction'),
  RULE_INSTANCE_FUNCTION_NAME: getResourceNameForTarpon('RuleInstanceFunction'),
  TRANSACTIONS_VIEW_FUNCTION_NAME: getResourceNameForTarpon(
    'TransactionsViewFunction'
  ),
  DASHBOARD_STATS_TRANSACTIONS_FUNCTION_NAME: getResourceNameForTarpon(
    'DashboardStatsTransactionsFunction'
  ),
  TRANSACTION_COMMENTS_FUNCTION_NAME: getResourceNameForTarpon(
    'TransactionsCommentsFunction'
  ),
  BUSINESS_USERS_VIEW_FUNCTION_NAME: getResourceNameForTarpon(
    'BusinessUsersViewFunction'
  ),
  CONSUMER_USERS_VIEW_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsumersUsersViewFunction'
  ),
  FILE_IMPORT_FUNCTION_NAME: getResourceNameForTarpon('FileImportFunction'),
  GET_PRESIGNED_URL_FUNCTION_NAME: getResourceNameForTarpon(
    'GetPresignedUrlFunction'
  ),
  LISTS_FUNCTION_NAME: getResourceNameForTarpon('ListsFunction'),
  TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME:
    getResourceNameForTarpon('TarponChangeCaptureKinesisConsumerFunction'),
  SLACK_APP_FUNCTION_NAME: getResourceNameForTarpon('SlackAppFunction'),
  SLACK_ALERT_FUNCTION_NAME: getResourceNameForTarpon('SlackAlertFunction'),
  WEBHOOK_CONFIGURATION_FUNCTION_NAME: getResourceNameForTarpon(
    'WebhookConfigurationFunction'
  ),
  WEBHOOK_DELIVERER_FUNCTION_NAME: getResourceNameForTarpon(
    'WebhookDelivererFunction'
  ),
  WEBHOOK_TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME:
    getResourceNameForTarpon(
      'WebhookTarponChangeCaptureKinesisConsumerFunction'
    ),
  LAMBDA_LATEST_ALIAS_NAME: 'LATEST',
  JWT_AUTHORIZER_CACHE_TTL_SECONDS: 3600,
  API_KEY_AUTHORIZER_CACHE_TTL_SECONDS: 3600,
  BETTER_UPTIME_CLOUD_WATCH_TOPIC_NAME: getResourceName(
    'BetterUptimeCloudWatchTopic'
  ),
  BETTER_UPTIME_SUBSCRIPTION_NAME: getResourceName('Subscription'),
  SLACK_ALERT_QUEUE_NAME: getResourceName('SlackAlertQueue'),
  WEBHOOK_DELIVERY_DLQ_NAME: getResourceName('webhookDeliveryDeadLetterQueue'),
  WEBHOOK_DELIVERY_QUEUE_NAME: getResourceName('WebhookDeliveryQueue'),
  FAST_GEOIP_LAYER_NAME: getResourceName('fast-geoip-layer'),
  PUBLIC_OPENAPI_ASSET_NAME: getResourceName('PublicOpenApiAsset'),
  LOG_GROUP_PUBLIC_API_NAME: getResourceName('LogGroupPublicApi'),
  TARPON_API_NAME: getResourceName('TarponAPI'),
  TARPON_API_GATEWAY_ALARM_NAME: getResourceName('TarponApiErrorPercentage'),
  TARPON_API_GATEWAY_THROTTLING_ALARM_NAME: getResourceName(
    'TarponApiThrottlingCount'
  ),
  CONSOLE_OPENAPI_ASSET_NAME: getResourceName('InternalOpenApiAsset'),
  LOG_GROUP_CONSOLE_API_NAME: getResourceName('LogGroupConsoleApi'),
  CONSOLE_API_NAME: getResourceName('TarponAPI-console'),
  CONSOLE_API_GATEWAY_ALARM_NAME: getResourceName(
    'ConsoleTarponApiErrorPercentage'
  ),
  CONSOLE_API_GATEWAY_THROTTLING_ALARM_NAME: getResourceName(
    'ConsoleApiThrottlingCount'
  ),
  TARPON_API_LOG_GROUP_NAME: getResourceName(
    `API-Gateway-Execution-Logs_TarponAPI`
  ),
  CONSOLE_API_LOG_GROUP_NAME: getResourceName(
    `API-Gateway-Execution-Logs_ConsoleTarponAPI`
  ),
  HAMMERHEAD_DYNAMODB_TABLE_NAME: 'Hammerhead',
  HAMMERHEAD_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME:
    getResourceNameForHammerhead('ChangeCaptureKinesisConsumer'),
  RISK_CLASSIFICATION_FUNCTION_NAME: getResourceNameForHammerhead(
    'RiskClassificationFunction'
  ),
  MANUAL_USER_RISK_ASSIGNMENT_FUNCTION_NAME: getResourceNameForHammerhead(
    'ManualUserRiskAssignmentFunction'
  ),
  PARAMETER_RISK_ASSIGNMENT_FUNCTION_NAME: getResourceNameForHammerhead(
    'ParameterRiskAssignmentFunction'
  ),
  NUMBER_OF_RISK_LEVELS: 5,
  TARPON_STREAM_ID: 'tarponStream',
  TARPON_STREAM_NAME: 'tarponDynamoChangeCaptureStream',
  TARPON_MONGODB_RETRY_STREAM_ID: 'tarponMongoDbRetryStream',
  TARPON_WEBHOOK_RETRY_STREAM_ID: 'tarponWebhookRetryStream',
  HAMMERHEAD_STREAM_ID: 'hammerheadStream',
  HAMMERHEAD_STREAM_NAME: 'hammerheadDynamoChangeCaptureStream',
  HAMMERHEAD_RETRY_STREAM_ID: 'hammerheadRetryStream',
  DATA_MIGRATION_CODEBUILD_PROJECT_NAME: 'DataMigration',
}
