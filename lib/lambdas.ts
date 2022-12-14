import { StackConstants } from './constants'

const DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS = 10

export const LAMBDAS: {
  [key: string]: {
    codePath: string
    handlerName: string
    expectedMaxDurationSeconds: number
  }
} = {
  [StackConstants.API_KEY_GENERATOR_FUNCTION_NAME]: {
    codePath: 'api-key-generator',
    handlerName: 'apiKeyGeneratorHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.API_KEY_AUTHORIZER_FUNCTION_NAME]: {
    codePath: 'api-key-authorizer',
    handlerName: 'apiKeyAuthorizer',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.JWT_AUTHORIZER_FUNCTION_NAME]: {
    codePath: 'jwt-authorizer',
    handlerName: 'jwtAuthorizer',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.PUBLIC_API_TRANSACTION_FUNCTION_NAME]: {
    codePath: 'public-api-rules-engine',
    handlerName: 'transactionHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.PUBLIC_API_TRANSACTION_EVENT_FUNCTION_NAME]: {
    codePath: 'public-api-rules-engine',
    handlerName: 'transactionEventHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.PUBLIC_API_USER_EVENT_FUNCTION_NAME]: {
    codePath: 'public-api-rules-engine',
    handlerName: 'userEventsHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.CONSOLE_API_FILE_IMPORT_FUNCTION_NAME]: {
    codePath: 'console-api-file-import',
    handlerName: 'fileImportHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.CONSOLE_API_GET_PRESIGNED_URL_FUNCTION_NAME]: {
    codePath: 'console-api-file-import',
    handlerName: 'getPresignedUrlHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.CONSOLE_API_RULE_FUNCTION_NAME]: {
    codePath: 'console-api-rule',
    handlerName: 'ruleHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.CONSOLE_API_RULE_INSTANCE_FUNCTION_NAME]: {
    codePath: 'console-api-rule',
    handlerName: 'ruleInstanceHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.PUBLIC_MANAGEMENT_API_RULE_FUNCTION_NAME]: {
    codePath: 'public-management-api-rule',
    handlerName: 'ruleHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.PUBLIC_MANAGEMENT_API_RULE_INSTANCE_FUNCTION_NAME]: {
    codePath: 'public-management-api-rule',
    handlerName: 'ruleInstanceHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.CONSOLE_API_TRANSACTIONS_VIEW_FUNCTION_NAME]: {
    codePath: 'console-api-transaction',
    handlerName: 'transactionsViewHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.CONSOLE_API_ACCOUNT_FUNCTION_NAME]: {
    codePath: 'console-api-account',
    handlerName: 'accountsHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.CONSOLE_API_TENANT_FUNCTION_NAME]: {
    codePath: 'console-api-tenant',
    handlerName: 'tenantsHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.CONSOLE_API_BUSINESS_USERS_VIEW_FUNCTION_NAME]: {
    codePath: 'console-api-user',
    handlerName: 'businessUsersViewHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.CONSOLE_API_CONSUMER_USERS_VIEW_FUNCTION_NAME]: {
    codePath: 'console-api-user',
    handlerName: 'consumerUsersViewHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.CONSOLE_API_ALL_USERS_VIEW_FUNCTION_NAME]: {
    codePath: 'console-api-user',
    handlerName: 'allUsersViewHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.CONSOLE_API_DASHBOARD_STATS_FUNCTION_NAME]: {
    codePath: 'console-api-dashboard',
    handlerName: 'dashboardStatsHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.PUBLIC_API_USER_FUNCTION_NAME]: {
    codePath: 'public-api-user-management',
    handlerName: 'userHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.CONSOLE_API_LISTS_FUNCTION_NAME]: {
    codePath: 'console-api-list-importer',
    handlerName: 'listsHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.CONSOLE_API_CASE_FUNCTION_NAME]: {
    codePath: 'console-api-case',
    handlerName: 'casesHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.AUDIT_LOG_FUNCTION_NAME]: {
    codePath: 'console-api-audit-log',
    handlerName: 'auditLogHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.SLACK_APP_FUNCTION_NAME]: {
    codePath: 'slack-app',
    handlerName: 'slackAppHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.SLACK_ALERT_FUNCTION_NAME]: {
    codePath: 'slack-app',
    handlerName: 'slackAlertHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.WEBHOOK_DELIVERER_FUNCTION_NAME]: {
    codePath: 'webhook-deliverer',
    handlerName: 'webhookDeliveryHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.CONSOLE_API_WEBHOOK_CONFIGURATION_FUNCTION_NAME]: {
    codePath: 'console-api-webhook',
    handlerName: 'webhookConfigurationHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.CONSOLE_API_RISK_CLASSIFICATION_FUNCTION_NAME]: {
    codePath: 'console-api-pulse',
    handlerName: 'riskClassificationHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.CONSOLE_API_MANUAL_USER_RISK_ASSIGNMENT_FUNCTION_NAME]: {
    codePath: 'console-api-pulse',
    handlerName: 'manualRiskAssignmentHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.CONSOLE_API_PARAMETER_RISK_ASSIGNMENT_FUNCTION_NAME]: {
    codePath: 'console-api-pulse',
    handlerName: 'parameterRiskAssignmentHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.CONSOLE_API_RISK_LEVEL_AND_SCORE_FUNCTION_NAME]: {
    codePath: 'console-api-pulse',
    handlerName: 'riskLevelAndScoreHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME]: {
    codePath: 'tarpon-change-mongodb-consumer',
    handlerName: 'tarponChangeMongodbHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_RETRY_FUNCTION_NAME]: {
    codePath: 'tarpon-change-mongodb-consumer',
    handlerName: 'tarponChangeMongodbHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.WEBHOOK_TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME]:
    {
      codePath: 'tarpon-change-webhook-consumer',
      handlerName: 'tarponChangeWebhookHandler',
      expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
    },
  [StackConstants.WEBHOOK_TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_RETRY_FUNCTION_NAME]:
    {
      codePath: 'tarpon-change-webhook-consumer',
      handlerName: 'tarponChangeWebhookHandler',
      expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
    },
  [StackConstants.SANCTIONS_FUNCTION_NAME]: {
    codePath: 'sanctions',
    handlerName: 'sanctionsHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.HAMMERHEAD_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME]: {
    codePath: 'hammerhead-change-capture-kinesis-consumer',
    handlerName: 'hammerheadChangeCaptureHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
  [StackConstants.AUDIT_LOG_CONSUMER_FUNCTION_NAME]: {
    codePath: 'audit-log-consumer',
    handlerName: 'auditLogConsumerHandler',
    expectedMaxDurationSeconds: DEFAULT_LAMBDA_EXPECTED_MAX_DURATION_SECONDS,
  },
}
