import { StackConstants } from './constants'

const DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS = 15
const PUBLIC_API_LAMBDA_EXPECTED_MAX_SECONDS = 7
const ASYNC_JOB_LAMBDA_EXPECTED_MAX_SECONDS = 885 // 900 seconds is the hard timeout, a lambda should stop gracefully before the hard timeout
const ASYNC_SHORT_JOB_LAMBDA_EXPECTED_MAX_SECONDS = 5 * 60
const KINESIS_CONSUMER_LAMBDA_EXPECTED_MAX_SECONDS = 100

export const DEFAULT_LAMBDA_TIMEOUT_SECONDS = 100
export const DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS = 15 * 60

export const LAMBDAS: {
  [key: string]: {
    codePath: string
    handlerName: string
    expectedMaxSeconds: number
    timeoutSeconds: number
  }
} = {
  [StackConstants.CONSOLE_API_API_KEY_GENERATOR_FUNCTION_NAME]: {
    codePath: 'api-key-generator',
    handlerName: 'apiKeyGeneratorHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.API_KEY_AUTHORIZER_FUNCTION_NAME]: {
    codePath: 'api-key-authorizer',
    handlerName: 'apiKeyAuthorizer',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.JWT_AUTHORIZER_FUNCTION_NAME]: {
    codePath: 'jwt-authorizer',
    handlerName: 'jwtAuthorizer',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.PUBLIC_API_TRANSACTION_FUNCTION_NAME]: {
    codePath: 'public-api-rules-engine',
    handlerName: 'transactionHandler',
    expectedMaxSeconds: PUBLIC_API_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.PUBLIC_API_TRANSACTION_EVENT_FUNCTION_NAME]: {
    codePath: 'public-api-rules-engine',
    handlerName: 'transactionEventHandler',
    expectedMaxSeconds: PUBLIC_API_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.PUBLIC_API_USER_EVENT_FUNCTION_NAME]: {
    codePath: 'public-api-rules-engine',
    handlerName: 'userEventsHandler',
    expectedMaxSeconds: PUBLIC_API_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_FILE_IMPORT_FUNCTION_NAME]: {
    codePath: 'console-api-file-import',
    handlerName: 'fileImportHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_GET_PRESIGNED_URL_FUNCTION_NAME]: {
    codePath: 'console-api-file-import',
    handlerName: 'getPresignedUrlHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_RULE_FUNCTION_NAME]: {
    codePath: 'console-api-rule',
    handlerName: 'ruleHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_RULE_INSTANCE_FUNCTION_NAME]: {
    codePath: 'console-api-rule',
    handlerName: 'ruleInstanceHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.PUBLIC_MANAGEMENT_API_RULE_FUNCTION_NAME]: {
    codePath: 'public-management-api-rule',
    handlerName: 'ruleHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.PUBLIC_MANAGEMENT_API_RULE_INSTANCE_FUNCTION_NAME]: {
    codePath: 'public-management-api-rule',
    handlerName: 'ruleInstanceHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.PUBLIC_MANAGEMENT_API_CASE_FUNCTION_NAME]: {
    codePath: 'public-management-api-case',
    handlerName: 'caseHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.PUBLIC_MANAGEMENT_API_ALERT_FUNCTION_NAME]: {
    codePath: 'public-management-api-alert',
    handlerName: 'alertHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.PUBLIC_MANAGEMENT_API_FILE_UPLOAD_FUNCTION_NAME]: {
    codePath: 'public-management-api-file-upload',
    handlerName: 'fileUploadHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.PUBLIC_MANAGEMENT_API_USER_FUNCTION_NAME]: {
    codePath: 'public-management-api-users',
    handlerName: 'userHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_TRANSACTIONS_VIEW_FUNCTION_NAME]: {
    codePath: 'console-api-transaction',
    handlerName: 'transactionsViewHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_ACCOUNT_FUNCTION_NAME]: {
    codePath: 'console-api-account',
    handlerName: 'accountsHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_ACCOUNT_FUNCTION_NAME]: {
    codePath: 'console-api-account',
    handlerName: 'accountsHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_ROLE_FUNCTION_NAME]: {
    codePath: 'console-api-role',
    handlerName: 'rolesHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_TENANT_FUNCTION_NAME]: {
    codePath: 'console-api-tenant',
    handlerName: 'tenantsHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_BUSINESS_USERS_VIEW_FUNCTION_NAME]: {
    codePath: 'console-api-user',
    handlerName: 'businessUsersViewHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_CONSUMER_USERS_VIEW_FUNCTION_NAME]: {
    codePath: 'console-api-user',
    handlerName: 'consumerUsersViewHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_ALL_USERS_VIEW_FUNCTION_NAME]: {
    codePath: 'console-api-user',
    handlerName: 'allUsersViewHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_DASHBOARD_STATS_FUNCTION_NAME]: {
    codePath: 'console-api-dashboard',
    handlerName: 'dashboardStatsHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.PUBLIC_API_USER_FUNCTION_NAME]: {
    codePath: 'public-api-user-management',
    handlerName: 'userHandler',
    expectedMaxSeconds: PUBLIC_API_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_LISTS_FUNCTION_NAME]: {
    codePath: 'console-api-list-importer',
    handlerName: 'listsHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_CASE_FUNCTION_NAME]: {
    codePath: 'console-api-case',
    handlerName: 'casesHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_COPILOT_FUNCTION_NAME]: {
    codePath: 'console-api-copilot',
    handlerName: 'copilotHandler',
    expectedMaxSeconds: 60,
    timeoutSeconds: 60,
  },
  [StackConstants.CONSOLE_API_AUDIT_LOG_FUNCTION_NAME]: {
    codePath: 'console-api-audit-log',
    handlerName: 'auditLogHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_SLACK_APP_FUNCTION_NAME]: {
    codePath: 'slack-app',
    handlerName: 'slackAppHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.SLACK_ALERT_FUNCTION_NAME]: {
    codePath: 'slack-app',
    handlerName: 'slackAlertHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.WEBHOOK_DELIVERER_FUNCTION_NAME]: {
    codePath: 'webhook-deliverer',
    handlerName: 'webhookDeliveryHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.TRANSACTION_AGGREGATION_FUNCTION_NAME]: {
    codePath: 'transaction-aggregation',
    handlerName: 'transactionAggregationHandler',
    expectedMaxSeconds: ASYNC_SHORT_JOB_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_WEBHOOK_CONFIGURATION_FUNCTION_NAME]: {
    codePath: 'console-api-webhook',
    handlerName: 'webhookConfigurationHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_RISK_CLASSIFICATION_FUNCTION_NAME]: {
    codePath: 'console-api-pulse',
    handlerName: 'riskClassificationHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_MANUAL_USER_RISK_ASSIGNMENT_FUNCTION_NAME]: {
    codePath: 'console-api-pulse',
    handlerName: 'manualRiskAssignmentHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_PARAMETER_RISK_ASSIGNMENT_FUNCTION_NAME]: {
    codePath: 'console-api-pulse',
    handlerName: 'parameterRiskAssignmentHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_RISK_LEVEL_AND_SCORE_FUNCTION_NAME]: {
    codePath: 'console-api-pulse',
    handlerName: 'riskLevelAndScoreHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_SIMULATION_FUNCTION_NAME]: {
    codePath: 'console-api-simulation',
    handlerName: 'simulationHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME]: {
    codePath: 'tarpon-change-mongodb-consumer',
    handlerName: 'tarponChangeMongoDbHandler',
    expectedMaxSeconds: KINESIS_CONSUMER_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.HAMMERHEAD_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME]: {
    codePath: 'hammerhead-change-mongodb-consumer',
    handlerName: 'hammerheadChangeMongoDbHandler',
    expectedMaxSeconds: KINESIS_CONSUMER_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_RETRY_FUNCTION_NAME]: {
    codePath: 'tarpon-change-mongodb-consumer',
    handlerName: 'tarponChangeMongoDbRetryHandler',
    expectedMaxSeconds: KINESIS_CONSUMER_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.HAMMERHEAD_CHANGE_CAPTURE_KINESIS_CONSUMER_RETRY_FUNCTION_NAME]:
    {
      codePath: 'hammerhead-change-mongodb-consumer',
      handlerName: 'hammerheadChangeMongoDbRetryHandler',
      expectedMaxSeconds: KINESIS_CONSUMER_LAMBDA_EXPECTED_MAX_SECONDS,
      timeoutSeconds: DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS,
    },
  [StackConstants.CONSOLE_API_SANCTIONS_FUNCTION_NAME]: {
    codePath: 'console-api-sanctions',
    handlerName: 'sanctionsHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_INCOMING_WEBHOOKS_FUNCTION_NAME]: {
    codePath: 'incoming-webhooks',
    handlerName: 'webhooksHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.AUDIT_LOG_CONSUMER_FUNCTION_NAME]: {
    codePath: 'audit-log-consumer',
    handlerName: 'auditLogConsumerHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_MERCHANT_MONITORING_FUNCTION_NAME]: {
    codePath: 'console-api-merchant',
    handlerName: 'merchantMonitoringHandler',
    expectedMaxSeconds: ASYNC_SHORT_JOB_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_NOTIFICATIONS_FUNCTION_NAME]: {
    codePath: 'console-api-notifications',
    handlerName: 'notificationsHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CONSOLE_API_SAR_FUNCTION_NAME]: {
    codePath: 'console-api-sar',
    handlerName: 'sarHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.BATCH_JOB_TRIGGER_CONSUMER_FUNCTION_NAME]: {
    codePath: 'batch-job',
    handlerName: 'jobTriggerHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.BATCH_JOB_DECISION_FUNCTION_NAME]: {
    codePath: 'batch-job',
    handlerName: 'jobDecisionHandler',
    expectedMaxSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.BATCH_JOB_RUNNER_FUNCTION_NAME]: {
    codePath: 'batch-job',
    handlerName: 'jobRunnerHandler',
    expectedMaxSeconds: ASYNC_JOB_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CRON_JOB_DAILY]: {
    codePath: 'cron-job-daily',
    handlerName: 'cronJobDailyHandler',
    expectedMaxSeconds: ASYNC_JOB_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CRON_JOB_TEN_MINUTE]: {
    codePath: 'cron-job-ten-minute',
    handlerName: 'cronJobTenMinuteHandler',
    expectedMaxSeconds: ASYNC_JOB_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.REQUEST_LOGGER_FUNCTION_NAME]: {
    codePath: 'request-logger',
    handlerName: 'requestLoggerHandler',
    expectedMaxSeconds: ASYNC_JOB_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.CRON_JOB_MONTHLY]: {
    codePath: 'cron-job-monthly',
    handlerName: 'cronJobMonthlyHandler',
    expectedMaxSeconds: ASYNC_JOB_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.NOTIFICATIONS_CONSUMER_FUNCTION_NAME]: {
    codePath: 'notifications-consumer',
    handlerName: 'notificationsConsumerHandler',
    expectedMaxSeconds: ASYNC_JOB_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.TRANSACTION_EVENT_QUEUE_CONSUMER_FUNCTION_NAME]: {
    codePath: 'transaction-events-consumer',
    handlerName: 'transactionEventsHandler',
    expectedMaxSeconds: ASYNC_JOB_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS,
  },
  [StackConstants.USER_EVENT_QUEUE_CONSUMER_FUNCTION_NAME]: {
    codePath: 'user-events-consumer',
    handlerName: 'userEventsHandler',
    expectedMaxSeconds: ASYNC_JOB_LAMBDA_EXPECTED_MAX_SECONDS,
    timeoutSeconds: DEFAULT_ASYNC_JOB_LAMBDA_TIMEOUT_SECONDS,
  },
}
