import { Config } from '@flagright/lib/config/config'
import { siloDataTenants } from '@flagright/lib/constants/silo-data-tenants'
import { stageAndRegion } from '@flagright/lib/utils/env'
import { envIs } from '@/utils/env'

export function getSuffix(): string {
  let suffix = ''
  if (process.env.ENV === 'dev:user' || process.env.DEV_ENV === 'true') {
    suffix = process.env.QA_SUBDOMAIN || ''
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

export function getNameForGlobalResource(
  name: string,
  config: Config,
  region?: string
) {
  const regionToUse = region ? region : config.env.region || 'eu-central-1'
  return `${
    name + (config.stage === 'local' ? '-dev' : `-${config.stage}`)
  }-${regionToUse}`
}

export const DEMO_DATA_PREFIX = 'users-attachment-demo'

export function getDemoDataS3Prefix(tenantId: string) {
  return `${tenantId}/${DEMO_DATA_PREFIX}`
}

export const DYNAMODB_TABLE_NAMES = {
  TARPON: 'Tarpon',
  TARPON_RULE: 'TarponRule',
  TRANSIENT: 'Transient',
  HAMMERHEAD: 'Hammerhead',
  AGGREGATION: 'Aggregation',
}

export const StackConstants = {
  VPC_NAME: 'vpc',
  VPC_SECURITY_GROUP_ID: 'atlas-lambda-sg',
  CLICKHOUSE_SECURITY_GROUP_ID: 'clickhouse-sg',
  S3_SERVER_ACCESS_LOGS_BUCKET_NAME: 's3-server-access-logs',
  TARPON_DYNAMODB_TABLE_NAME: (tenantId: string) => {
    let tableName = DYNAMODB_TABLE_NAMES.TARPON
    const [stage, region] = stageAndRegion()
    if (siloDataTenants[stage]?.[region]?.includes(tenantId)) {
      tableName = `${tableName}-${tenantId}`
    }
    return tableName
  },
  HAMMERHEAD_DYNAMODB_TABLE_NAME: (tenantId: string) => {
    let tableName = DYNAMODB_TABLE_NAMES.HAMMERHEAD
    const [stage, region] = stageAndRegion()
    if (siloDataTenants[stage]?.[region]?.includes(tenantId)) {
      tableName = `${tableName}-${tenantId}`
    }
    return tableName
  },
  TARPON_RULE_DYNAMODB_TABLE_NAME: DYNAMODB_TABLE_NAMES.TARPON_RULE,
  TRANSIENT_DYNAMODB_TABLE_NAME: DYNAMODB_TABLE_NAMES.TRANSIENT,
  AGGREGATION_DYNAMODB_TABLE_NAME: DYNAMODB_TABLE_NAMES.AGGREGATION,
  DYNAMODB_TTL_ATTRIBUTE_NAME: '_ttl',
  MONGO_DB_DATABASE_NAME: 'tarpon',
  MONGO_DB_USERNAME_NAME: 'tarponUser',
  S3_DEMO_MODE_BUCKET_NAME: 'demo-mode-data-files',
  PUBLIC_API_CANARY_TESTS_NAME: getResourceName('public-api-canary'),
  API_KEY_AUTHORIZER_BASE_ROLE_NAME: getResourceNameForTarpon(
    'ApiKeyAuthorizerBaseRole'
  ),
  JWT_AUTHORIZER_BASE_ROLE_NAME: getResourceNameForTarpon(
    'ConsoleApiJwtAuthorizerBaseRole'
  ),
  S3_IMPORT_BUCKET_PREFIX: getResourceNameForTarpon('import', true, true),
  S3_DOCUMENT_BUCKET_PREFIX: getResourceNameForTarpon('document', true, true),
  S3_TMP_BUCKET_PREFIX: getResourceNameForTarpon('tmp', true, true),
  S3_SHARED_ASSETS_PREFIX: getResourceNameForTarpon(
    'shared-assets',
    true,
    true
  ),

  // Lambda names
  CONSOLE_API_ACCOUNT_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiAccountFunction'
  ),
  CONSOLE_API_ROLE_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiRoleFunction'
  ),
  CONSOLE_API_TENANT_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiTenantFunction'
  ),
  API_KEY_AUTHORIZER_FUNCTION_NAME: getResourceNameForTarpon(
    'ApiKeyAuthorizerFunction'
  ),
  JWT_AUTHORIZER_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiJWTAuthorizerFunction'
  ),
  PUBLIC_API_TRANSACTION_FUNCTION_NAME: getResourceNameForTarpon(
    'PublicApiTransactionFunction'
  ),
  PUBLIC_API_TRANSACTION_EVENT_FUNCTION_NAME: getResourceNameForTarpon(
    'PublicApiTransactionEventFunction'
  ),
  BATCH_RERUN_USERS_CONSUMER_FUNCTION_NAME: getResourceNameForTarpon(
    'BatchRerunUsersConsumerFunction'
  ),
  PUBLIC_API_USER_FUNCTION_NAME: getResourceNameForTarpon(
    'PublicApiUserFunction'
  ),
  PUBLIC_API_USER_EVENT_FUNCTION_NAME: getResourceNameForTarpon(
    'PublicApiUserEventFunction'
  ),
  CONSOLE_API_API_KEY_GENERATOR_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiApiKeyGeneratorFunction'
  ),
  PUBLIC_MANAGEMENT_API_RULE_FUNCTION_NAME: getResourceNameForTarpon(
    'PublicManagementApiRuleFunction'
  ),
  PUBLIC_MANAGEMENT_API_RULE_INSTANCE_FUNCTION_NAME: getResourceNameForTarpon(
    'PublicManagementApiRuleInstanceFunction'
  ),
  PUBLIC_MANAGEMENT_API_LISTS_FUNCTION_NAME: getResourceNameForTarpon(
    'PublicManagementApiListsFunction'
  ),
  PUBLIC_MANAGEMENT_API_CASE_FUNCTION_NAME: getResourceNameForTarpon(
    'PublicManagementApiCaseFunction'
  ),
  PUBLIC_MANAGEMENT_API_ALERT_FUNCTION_NAME: getResourceNameForTarpon(
    'PublicManagementApiAlertFunction'
  ),
  PUBLIC_MANAGEMENT_API_FILE_UPLOAD_FUNCTION_NAME: getResourceNameForTarpon(
    'PublicManagementApiFileUploadFunction'
  ),
  PUBLIC_MANAGEMENT_API_USER_FUNCTION_NAME: getResourceNameForTarpon(
    'PublicManagementApiUserFunction'
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
  CONSOLE_API_FLAT_FILES_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiFlatFilesFunction'
  ),
  TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME:
    getResourceNameForTarpon('TarponChangeCaptureKinesisConsumerFunction'),
  CONSOLE_API_SLACK_APP_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiSlackAppFunction'
  ),
  SLACK_ALERT_FUNCTION_NAME: getResourceNameForTarpon('SlackAlertFunction'),
  CONSOLE_API_WEBHOOK_CONFIGURATION_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiWebhookConfigurationFunction'
  ),
  WEBHOOK_DELIVERER_FUNCTION_NAME: getResourceNameForTarpon(
    'WebhookDelivererFunction'
  ),
  TRANSACTION_AGGREGATION_FUNCTION_NAME: getResourceNameForTarpon(
    'TransactionAggregationFunction'
  ),
  USER_AGGREGATION_FUNCTION_NAME: getResourceNameForTarpon(
    'UserAggregationFunction'
  ),
  CONSOLE_API_SANCTIONS_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiSanctionsFunction'
  ),
  CONSOLE_API_INCOMING_WEBHOOKS_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiIncomingWebhooksFunction'
  ),
  CONSOLE_API_SAR_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiSarFunction'
  ),
  CONSOLE_API_NOTIFICATIONS_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiNotificationsFunction'
  ),
  LAMBDA_LATEST_ALIAS_NAME: 'LATEST',
  JWT_AUTHORIZER_CACHE_TTL_SECONDS: 3600,
  API_KEY_AUTHORIZER_CACHE_TTL_SECONDS: 3600,
  AUDIT_LOG_CONSUMER_FUNCTION_NAME: getResourceNameForTarpon(
    'AuditLogConsumerFunction'
  ),
  MONGO_UPDATE_CONSUMER_FUNCTION_NAME: getResourceNameForTarpon(
    'MongoUpdateConsumerFunction'
  ),
  AUDIT_LOG_TOPIC_NAME: getResourceName('AuditLogTopic'),
  ZENDUTY_CLOUD_WATCH_TOPIC_NAME: getResourceName('ZendutyCloudWatchTopic'),
  ZENDUTY_SUBSCRIPTION_NAME: getResourceName('ZendutySubscription'),
  TARPON_API_NAME: getResourceName('TarponAPI'),
  TARPON_API_GATEWAY_ALARM_NAME: getResourceName('TarponApiErrorPercentage'),
  TARPON_API_GATEWAY_THROTTLING_ALARM_NAME: getResourceName(
    'TarponApiThrottlingCount'
  ),
  TARPON_MANAGEMENT_API_NAME: getResourceName('TarponManagementAPI'),
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
  CONSOLE_API_FINCEN_SFTP_CONNECTION_ERROR_ALARM_NAME: getResourceName(
    'ConsoleApiFinCENSFTPConnectionError'
  ),
  CONSOLE_API_RISK_CLASSIFICATION_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiRiskClassificationFunction'
  ),
  CONSOLE_API_VERSION_HISTORY_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiVersionHistoryFunction'
  ),
  CONSOLE_API_MANUAL_USER_RISK_ASSIGNMENT_FUNCTION_NAME:
    getResourceNameForTarpon('ConsoleApiManualUserRiskAssignmentFunction'),
  CONSOLE_API_PARAMETER_RISK_ASSIGNMENT_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiParameterRiskAssignmentFunction'
  ),
  CONSOLE_API_RISK_LEVEL_AND_SCORE_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiRiskLevelAndScoreFunction'
  ),
  CONSOLE_API_SIMULATION_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiSimulationFunction'
  ),
  CONSOLE_API_AUDIT_LOG_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiAuditLogFunction'
  ),
  CONSOLE_API_WORKFLOWS_CASE_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiWorkflowsCaseFunction'
  ),
  NUMBER_OF_RISK_LEVELS: 5,
  TARPON_STREAM_ID: 'tarponStream',
  TARPON_STREAM_NAME: 'tarponDynamoChangeCaptureStream',
  DATA_MIGRATION_CODEBUILD_PROJECT_NAME: 'DataMigration',
  CONSOLE_API_CASE_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiCaseFunction'
  ),
  CONSOLE_API_COPILOT_FUNCTION_NAME: getResourceNameForTarpon(
    'ConsoleApiCopilotFunction'
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
  ASYNC_RULE_RUNNER_FUNCTION_NAME: getResourceNameForTarpon(
    'AsyncRuleRunnerFunction'
  ),
  CRON_JOB_DAILY: getResourceNameForTarpon('CronJobDailyFunction'),
  CRON_JOB_HOURLY: getResourceNameForTarpon('CronJobHourlyFunction'),
  CRON_JOB_TEN_MINUTE: getResourceNameForTarpon('CronJobTenMinuteFunction'),
  REQUEST_LOGGER_FUNCTION_NAME: getResourceNameForTarpon(
    'RequestLoggerFunction'
  ),
  CRON_JOB_MONTHLY: getResourceNameForTarpon('CronJobMonthlyFunction'),
  FARGATE_BATCH_JOB_TASK_DEFINITION_NAME: getResourceNameForTarpon(
    'FargateBatchJobTaskDefinition'
  ),
  FARGATE_BATCH_JOB_DOCKER_IMAGE_ASSET_NAME: getResourceNameForTarpon(
    'FargateBatchJobDockerImageAsset'
  ),
  FARGATE_BATCH_JOB_CLUSTER_NAME: getResourceNameForTarpon(
    'FargateBatchJobCluster'
  ),
  FARGATE_BATCH_JOB_CONTAINER_NAME: getResourceNameForTarpon(
    'FargateBatchJobContainer'
  ),
  FARGATE_BATCH_JOB_XRAY_CONTAINER_NAME: getResourceNameForTarpon(
    'FargateBatchJobXrayContainer'
  ),
  NOTIFICATIONS_CONSUMER_FUNCTION_NAME: getResourceNameForTarpon(
    'NotificationsConsumerFunction'
  ),
  TARPON_QUEUE_CONSUMER_FUNCTION_NAME: getResourceNameForTarpon(
    'TarponQueueConsumerFunction'
  ),
  DOWNSTREAM_TARPON_QUEUE_CONSUMER_FUNCTION_NAME: getResourceNameForTarpon(
    'DownstreamTarponQueueConsumerFunction'
  ),
  SECONDARY_TARPON_QUEUE_CONSUMER_FUNCTION_NAME: getResourceNameForTarpon(
    'SecondaryTarponQueueConsumerFunction'
  ),
  DOWNSTREAM_SECONDARY_TARPON_QUEUE_CONSUMER_FUNCTION_NAME:
    getResourceNameForTarpon('DownstreamSecondaryTarponQueueConsumerFunction'),
  BATCH_JOB_STATE_MACHINE_NAME: getResourceNameForTarpon(
    'BatchJobStateMachine'
  ),
  MONGO_DB_TRIGGER_QUEUE_CONSUMER_FUNCTION_NAME: getResourceNameForTarpon(
    'MongoDbChangeCaptureQueueConsumerFunction'
  ),
  DYNAMO_DB_TRIGGER_QUEUE_CONSUMER_FUNCTION_NAME: getResourceNameForTarpon(
    'DynamoDbChangeCaptureQueueConsumerFunction'
  ),
  ACTION_PROCESSING_FUNCTION_NAME: getResourceNameForTarpon(
    'ActionProcessingFunction'
  ),
  LAMBDA_PROCESS_LAMBDA_FUNCTION_NAME: getResourceNameForTarpon(
    'LambdaProcessLambda'
  ),
  PROCESSING_LAMBDA_FUNCTION_NAME: getResourceNameForTarpon('ProcessingLambda'),
  PYTHON_LAYER_NAME: getResourceNameForTarpon('PythonLayer'),
  SECONDARY_ASYNC_RULE_RUNNER_FUNCTION_NAME: getResourceName(
    'SecondaryAsyncRuleRunner'
  ),
  PRIMARY_ASYNC_RULE_MULTIPLEXER_NAME: getResourceNameForTarpon(
    'PrimaryAsyncRuleMultiplexer'
  ),

  // CloudWatch Logs Ingestion
  CLOUDWATCH_LOGS_INGESTION_FUNCTION_NAME: getResourceNameForTarpon(
    'CloudwatchLogsIngestionFunction'
  ),
  CLOUDWATCH_LOGS_FIREHOSE_STREAM_NAME: getResourceName(
    'CloudwatchLogsFirehoseStream'
  ),
  CLOUDWATCH_LOGS_S3_BUCKET_PREFIX: getResourceNameForTarpon(
    'cloudwatch-logs',
    true,
    true
  ),

  CLOUDWATCH_LOGS_PARQUET_BUCKET_PREFIX: getResourceNameForTarpon(
    'cloudwatch-logs-parquet',
    true,
    true
  ),
  CLOUDWATCH_LOGS_S3_EXPORTER_FUNCTION_NAME: getResourceNameForTarpon(
    'CloudwatchLogsS3ExporterFunction'
  ),
  POSTHOG_S3_ACCESS_KEY_SECRET_NAME: `posthog-user-s3-access-key-id`,
  POSTHOG_S3_SECRET_KEY_SECRET_NAME: `posthog-user-s3-secret-access-key`,
}

export const SQSQueues: {
  [key: string]: { name: string; oldestMsgAgeAlarmThresholdMinutes?: number }
} = {
  AUDIT_LOG_QUEUE_NAME: {
    name: getResourceName('AuditLogQueue'),
  },
  NOTIFICATIONS_QUEUE_NAME: {
    name: getResourceName('NotificationsQueue'),
  },
  TRANSACTION_AGGREGATION_QUEUE_NAME: {
    name: getResourceName('TransactionAggregationQueue') + '.fifo',
    oldestMsgAgeAlarmThresholdMinutes: 120,
  },
  USER_AGGREGATION_QUEUE_NAME: {
    name: getResourceName('UserAggregationQueue') + '.fifo',
    oldestMsgAgeAlarmThresholdMinutes: 120,
  },
  SLACK_ALERT_QUEUE_NAME: {
    name: getResourceName('SlackAlertQueue'),
  },
  WEBHOOK_DELIVERY_QUEUE_NAME: {
    name: getResourceName('WebhookDeliveryQueue'),
  },
  BATCH_JOB_QUEUE_NAME: { name: getResourceName('BatchJobQueue') },
  TARPON_QUEUE_NAME: {
    name: getResourceName('TarponQueue') + '.fifo',
    oldestMsgAgeAlarmThresholdMinutes: 45, // Lets do 45 Minutes it should not be more then that ideally
  },
  DOWNSTREAM_TARPON_QUEUE_NAME: {
    name: getResourceName('DownstreamTarponQueue'),
    oldestMsgAgeAlarmThresholdMinutes: envIs('dev') ? 60 : 45,
  },
  SECONDARY_TARPON_QUEUE_NAME: {
    name: getResourceName('SecondaryTarponQueue') + '.fifo',
    oldestMsgAgeAlarmThresholdMinutes: 120, // Lets do 2 hours it should not be more then that ideally
  },
  DOWNSTREAM_SECONDARY_TARPON_QUEUE_NAME: {
    name: getResourceName('DownstreamSecondaryTarponQueue'),
    oldestMsgAgeAlarmThresholdMinutes: 120, // Lets do 2 hours it should not be more then that ideally
  },
  REQUEST_LOGGER_QUEUE_NAME: {
    name: getResourceName('RequestLoggerQueue'),
    oldestMsgAgeAlarmThresholdMinutes: 60,
  },
  TRANSACTION_EVENT_QUEUE_NAME: {
    name: getResourceName('TransactionEventQueue') + '.fifo',
  },
  USER_EVENT_QUEUE_NAME: {
    name: getResourceName('UserEventQueue') + '.fifo',
  },
  ASYNC_RULE_QUEUE_NAME: {
    name: getResourceName('AsyncRuleQueue') + '.fifo',
    oldestMsgAgeAlarmThresholdMinutes: 360, // Lets do 6 Hours it should not be more then that ideally
  },
  BATCH_ASYNC_RULE_QUEUE_NAME: {
    name: getResourceName('BatchAsyncRuleQueue') + '.fifo',
    oldestMsgAgeAlarmThresholdMinutes: 360, // Lets do 6 Hours it should not be more then that ideally
  },
  MONGO_DB_CONSUMER_QUEUE_NAME: {
    name: getResourceName('MongoDbConsumerQueue'),
  },
  MONGO_UPDATE_CONSUMER_QUEUE_NAME: {
    name: getResourceName('MongoUpdateConsumerQueue') + '.fifo',
  },
  ACTION_PROCESSING_QUEUE_NAME: {
    name: getResourceName('ActionPostProcessingQueue'),
  },
  DYNAMO_DB_CONSUMER_QUEUE_NAME: {
    name: getResourceName('DynamoDbConsumerQueue'),
  },
  BATCH_RERUN_USERS_QUEUE_NAME: {
    name: getResourceName('BatchRerunUsersQueue'),
    oldestMsgAgeAlarmThresholdMinutes: 240, // 4 hours since there can be a lot of users to rerun
  },
  SecondaryAsyncRuleQueue: {
    name: getResourceName('SecondaryAsyncRuleQueue') + '.fifo',
    oldestMsgAgeAlarmThresholdMinutes: 360,
  },
  LOW_TRAFFIC_ASYNC_RULE_QUEUE: {
    name: getResourceName('LowTrafficAsyncRuleQueue') + '.fifo',
    oldestMsgAgeAlarmThresholdMinutes: 360,
  },
  HIGH_TRAFFIC_ASYNC_RULE_QUEUE: {
    name: getResourceName('HighTrafficAsyncRuleQueue') + '.fifo',
    oldestMsgAgeAlarmThresholdMinutes: 360,
  },
  ASYNC_RULE_PROCESSOR_QUEUE: {
    name: getResourceName('AsyncRuleProcessorQueue') + '.fifo',
    oldestMsgAgeAlarmThresholdMinutes: 360,
  },
}

export function getDeadLetterQueueName(queueName: string) {
  return `DeadLetter${queueName}`
}

export const SFTP_CONNECTION_ERROR_PREFIX = 'SFTPConnectionError'
