import { StackConstants } from './constants'

export const LAMBDAS: {
  [key: string]: {
    codePath: string
    handlerName: string
  }
} = {
  [StackConstants.API_KEY_GENERATOR_FUNCTION_NAME]: {
    codePath: 'api-key-generator',
    handlerName: 'apiKeyGeneratorHandler',
  },
  [StackConstants.API_KEY_AUTHORIZER_FUNCTION_NAME]: {
    codePath: 'api-key-authorizer',
    handlerName: 'apiKeyAuthorizer',
  },
  [StackConstants.JWT_AUTHORIZER_FUNCTION_NAME]: {
    codePath: 'jwt-authorizer',
    handlerName: 'jwtAuthorizer',
  },
  [StackConstants.PUBLIC_API_TRANSACTION_FUNCTION_NAME]: {
    codePath: 'public-api-rules-engine',
    handlerName: 'transactionHandler',
  },
  [StackConstants.PUBLIC_API_TRANSACTION_EVENT_FUNCTION_NAME]: {
    codePath: 'public-api-rules-engine',
    handlerName: 'transactionEventHandler',
  },
  [StackConstants.PUBLIC_API_USER_EVENT_FUNCTION_NAME]: {
    codePath: 'public-api-rules-engine',
    handlerName: 'userEventsHandler',
  },
  [StackConstants.CONSOLE_API_FILE_IMPORT_FUNCTION_NAME]: {
    codePath: 'console-api-file-import',
    handlerName: 'fileImportHandler',
  },
  [StackConstants.CONSOLE_API_GET_PRESIGNED_URL_FUNCTION_NAME]: {
    codePath: 'console-api-file-import',
    handlerName: 'getPresignedUrlHandler',
  },
  [StackConstants.CONSOLE_API_RULE_FUNCTION_NAME]: {
    codePath: 'console-api-rule',
    handlerName: 'ruleHandler',
  },
  [StackConstants.CONSOLE_API_RULE_INSTANCE_FUNCTION_NAME]: {
    codePath: 'console-api-rule',
    handlerName: 'ruleInstanceHandler',
  },
  [StackConstants.PUBLIC_MANAGEMENT_API_RULE_FUNCTION_NAME]: {
    codePath: 'public-management-api-rule',
    handlerName: 'ruleHandler',
  },
  [StackConstants.PUBLIC_MANAGEMENT_API_RULE_INSTANCE_FUNCTION_NAME]: {
    codePath: 'public-management-api-rule',
    handlerName: 'ruleInstanceHandler',
  },
  [StackConstants.CONSOLE_API_TRANSACTIONS_VIEW_FUNCTION_NAME]: {
    codePath: 'console-api-transaction',
    handlerName: 'transactionsViewHandler',
  },
  [StackConstants.CONSOLE_API_ACCOUNT_FUNCTION_NAME]: {
    codePath: 'console-api-account',
    handlerName: 'accountsHandler',
  },
  [StackConstants.CONSOLE_API_TENANT_FUNCTION_NAME]: {
    codePath: 'console-api-tenant',
    handlerName: 'tenantsHandler',
  },
  [StackConstants.CONSOLE_API_BUSINESS_USERS_VIEW_FUNCTION_NAME]: {
    codePath: 'console-api-user',
    handlerName: 'businessUsersViewHandler',
  },
  [StackConstants.CONSOLE_API_CONSUMER_USERS_VIEW_FUNCTION_NAME]: {
    codePath: 'console-api-user',
    handlerName: 'consumerUsersViewHandler',
  },
  [StackConstants.CONSOLE_API_DASHBOARD_STATS_TRANSACTIONS_FUNCTION_NAME]: {
    codePath: 'console-api-dashboard',
    handlerName: 'dashboardStatsHandler',
  },
  [StackConstants.PUBLIC_API_USER_FUNCTION_NAME]: {
    codePath: 'public-api-user-management',
    handlerName: 'userHandler',
  },
  [StackConstants.CONSOLE_API_LISTS_FUNCTION_NAME]: {
    codePath: 'console-api-list-importer',
    handlerName: 'listsHandler',
  },
  [StackConstants.CONSOLE_API_CASE_FUNCTION_NAME]: {
    codePath: 'console-api-case',
    handlerName: 'casesHandler',
  },
  [StackConstants.SLACK_APP_FUNCTION_NAME]: {
    codePath: 'slack-app',
    handlerName: 'slackAppHandler',
  },
  [StackConstants.SLACK_ALERT_FUNCTION_NAME]: {
    codePath: 'slack-app',
    handlerName: 'slackAlertHandler',
  },
  [StackConstants.WEBHOOK_DELIVERER_FUNCTION_NAME]: {
    codePath: 'webhook-deliverer',
    handlerName: 'webhookDeliveryHandler',
  },
  [StackConstants.CONSOLE_API_WEBHOOK_CONFIGURATION_FUNCTION_NAME]: {
    codePath: 'console-api-webhook',
    handlerName: 'webhookConfigurationHandler',
  },
  [StackConstants.CONSOLE_API_RISK_CLASSIFICATION_FUNCTION_NAME]: {
    codePath: 'console-api-pulse',
    handlerName: 'riskClassificationHandler',
  },
  [StackConstants.CONSOLE_API_MANUAL_USER_RISK_ASSIGNMENT_FUNCTION_NAME]: {
    codePath: 'console-api-pulse',
    handlerName: 'manualRiskAssignmentHandler',
  },
  [StackConstants.CONSOLE_API_PARAMETER_RISK_ASSIGNMENT_FUNCTION_NAME]: {
    codePath: 'console-api-pulse',
    handlerName: 'parameterRiskAssignmentHandler',
  },
  [StackConstants.CONSOLE_API_RISK_LEVEL_AND_SCORE_FUNCTION_NAME]: {
    codePath: 'console-api-pulse',
    handlerName: 'riskLevelAndScoreHandler',
  },
  [StackConstants.TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME]: {
    codePath: 'tarpon-change-mongodb-consumer',
    handlerName: 'tarponChangeMongodbHandler',
  },
  [StackConstants.WEBHOOK_TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME]:
    {
      codePath: 'tarpon-change-webhook-consumer',
      handlerName: 'tarponChangeWebhookHandler',
    },
  [StackConstants.SANCTIONS_FUNCTION_NAME]: {
    codePath: 'sanctions',
    handlerName: 'sanctionsHandler',
  },
  [StackConstants.HAMMERHEAD_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME]: {
    codePath: 'hammerhead-change-capture-kinesis-consumer',
    handlerName: 'hammerheadChangeCaptureHandler',
  },
}
