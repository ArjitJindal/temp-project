import { StackConstants } from './constants'
import {
  transactionEventHandler,
  transactionHandler,
  userEventsHandler,
} from '@/lambdas/public-api-rules-engine/app'
import { apiKeyGeneratorHandler } from '@/lambdas/api-key-generator/app'
import { apiKeyAuthorizer } from '@/lambdas/api-key-authorizer/app'
import { jwtAuthorizer } from '@/lambdas/jwt-authorizer/app'
import {
  fileImportHandler,
  getPresignedUrlHandler,
} from '@/lambdas/console-api-file-import/app'
import {
  ruleHandler,
  ruleInstanceHandler,
} from '@/lambdas/console-api-rule/app'
import {
  ruleHandler as publicRuleHandler,
  ruleInstanceHandler as publicRuleInstanceHandler,
} from '@/lambdas/public-management-api-rule/app'
import { transactionsViewHandler } from '@/lambdas/console-api-transaction/app'
import { accountsHandler } from '@/lambdas/console-api-account/app'
import { tenantsHandler } from '@/lambdas/console-api-tenant/app'
import {
  businessUsersViewHandler,
  consumerUsersViewHandler,
} from '@/lambdas/console-api-user/app'
import { dashboardStatsHandler } from '@/lambdas/console-api-dashboard/app'
import { userHandler } from '@/lambdas/public-api-user-management/app'
import { listsHandler } from '@/lambdas/console-api-list-importer/app'
import { casesHandler } from '@/lambdas/console-api-case/app'
import { slackAlertHandler, slackAppHandler } from '@/lambdas/slack-app/app'
import { webhookDeliveryHandler } from '@/lambdas/webhook-deliverer/app'
import { webhookConfigurationHandler } from '@/lambdas/console-api-webhook/app'
import {
  manualRiskAssignmentHandler,
  parameterRiskAssignmentHandler,
  riskClassificationHandler,
} from '@/lambdas/console-api-pulse/app'
import { tarponChangeMongodbHandler } from '@/lambdas/tarpon-change-mongodb-consumer/app'
import { tarponChangeWebhookHandler } from '@/lambdas/tarpon-change-webhook-consumer/app'
import { sanctionsHandler } from '@/lambdas/sanctions/app'
import { hammerheadChangeCaptureHandler } from '@/lambdas/hammerhead-change-capture-kinesis-consumer/app'

export const LAMBDAS: {
  [key: string]: {
    codePath: string
    handler: CallableFunction
    handlerName: string
  }
} = {
  [StackConstants.API_KEY_GENERATOR_FUNCTION_NAME]: {
    codePath: 'api-key-generator',
    handler: apiKeyGeneratorHandler,
    handlerName: 'apiKeyGeneratorHandler',
  },
  [StackConstants.API_KEY_AUTHORIZER_FUNCTION_NAME]: {
    codePath: 'api-key-authorizer',
    handler: apiKeyAuthorizer,
    handlerName: 'apiKeyAuthorizer',
  },
  [StackConstants.JWT_AUTHORIZER_FUNCTION_NAME]: {
    codePath: 'jwt-authorizer',
    handler: jwtAuthorizer,
    handlerName: 'jwtAuthorizer',
  },
  [StackConstants.PUBLIC_API_TRANSACTION_FUNCTION_NAME]: {
    codePath: 'public-api-rules-engine',
    handler: transactionHandler,
    handlerName: 'transactionHandler',
  },
  [StackConstants.PUBLIC_API_TRANSACTION_EVENT_FUNCTION_NAME]: {
    codePath: 'public-api-rules-engine',
    handler: transactionEventHandler,
    handlerName: 'transactionEventHandler',
  },
  [StackConstants.PUBLIC_API_USER_EVENT_FUNCTION_NAME]: {
    codePath: 'public-api-rules-engine',
    handler: userEventsHandler,
    handlerName: 'userEventsHandler',
  },
  [StackConstants.CONSOLE_API_FILE_IMPORT_FUNCTION_NAME]: {
    codePath: 'console-api-file-import',
    handler: fileImportHandler,
    handlerName: 'fileImportHandler',
  },
  [StackConstants.CONSOLE_API_GET_PRESIGNED_URL_FUNCTION_NAME]: {
    codePath: 'console-api-file-import',
    handler: getPresignedUrlHandler,
    handlerName: 'getPresignedUrlHandler',
  },
  [StackConstants.CONSOLE_API_RULE_FUNCTION_NAME]: {
    codePath: 'console-api-rule',
    handler: ruleHandler,
    handlerName: 'ruleHandler',
  },
  [StackConstants.CONSOLE_API_RULE_INSTANCE_FUNCTION_NAME]: {
    codePath: 'console-api-rule',
    handler: ruleInstanceHandler,
    handlerName: 'ruleInstanceHandler',
  },
  [StackConstants.PUBLIC_MANAGEMENT_API_RULE_FUNCTION_NAME]: {
    codePath: 'public-management-api-rule',
    handler: publicRuleHandler,
    handlerName: 'publicRuleHandler',
  },
  [StackConstants.PUBLIC_MANAGEMENT_API_RULE_INSTANCE_FUNCTION_NAME]: {
    codePath: 'public-management-api-rule',
    handler: publicRuleInstanceHandler,
    handlerName: 'publicRuleInstanceHandler',
  },
  [StackConstants.CONSOLE_API_TRANSACTIONS_VIEW_FUNCTION_NAME]: {
    codePath: 'console-api-transaction',
    handler: transactionsViewHandler,
    handlerName: 'transactionsViewHandler',
  },
  [StackConstants.CONSOLE_API_ACCOUNT_FUNCTION_NAME]: {
    codePath: 'console-api-account',
    handler: accountsHandler,
    handlerName: 'accountsHandler',
  },
  [StackConstants.CONSOLE_API_TENANT_FUNCTION_NAME]: {
    codePath: 'console-api-tenant',
    handler: tenantsHandler,
    handlerName: 'tenantsHandler',
  },
  [StackConstants.CONSOLE_API_BUSINESS_USERS_VIEW_FUNCTION_NAME]: {
    codePath: 'console-api-user',
    handler: businessUsersViewHandler,
    handlerName: 'businessUsersViewHandler',
  },
  [StackConstants.CONSOLE_API_CONSUMER_USERS_VIEW_FUNCTION_NAME]: {
    codePath: 'console-api-user',
    handler: consumerUsersViewHandler,
    handlerName: 'consumerUsersViewHandler',
  },
  [StackConstants.CONSOLE_API_DASHBOARD_STATS_TRANSACTIONS_FUNCTION_NAME]: {
    codePath: 'console-api-dashboard',
    handler: dashboardStatsHandler,
    handlerName: 'dashboardStatsHandler',
  },
  [StackConstants.PUBLIC_API_USER_FUNCTION_NAME]: {
    codePath: 'public-api-user-management',
    handler: userHandler,
    handlerName: 'userHandler',
  },
  [StackConstants.CONSOLE_API_LISTS_FUNCTION_NAME]: {
    codePath: 'console-api-list-importer',
    handler: listsHandler,
    handlerName: 'listsHandler',
  },
  [StackConstants.CONSOLE_API_CASE_FUNCTION_NAME]: {
    codePath: 'console-api-case',
    handler: casesHandler,
    handlerName: 'casesHandler',
  },
  [StackConstants.SLACK_APP_FUNCTION_NAME]: {
    codePath: 'slack-app',
    handler: slackAppHandler,
    handlerName: 'slackAppHandler',
  },
  [StackConstants.SLACK_ALERT_FUNCTION_NAME]: {
    codePath: 'slack-app',
    handler: slackAlertHandler,
    handlerName: 'slackAlertHandler',
  },
  [StackConstants.WEBHOOK_DELIVERER_FUNCTION_NAME]: {
    codePath: 'webhook-deliverer',
    handler: webhookDeliveryHandler,
    handlerName: 'webhookDeliveryHandler',
  },
  [StackConstants.CONSOLE_API_WEBHOOK_CONFIGURATION_FUNCTION_NAME]: {
    codePath: 'console-api-webhook',
    handler: webhookConfigurationHandler,
    handlerName: 'webhookConfigurationHandler',
  },
  [StackConstants.CONSOLE_API_RISK_CLASSIFICATION_FUNCTION_NAME]: {
    codePath: 'console-api-pulse',
    handler: riskClassificationHandler,
    handlerName: 'riskClassificationHandler',
  },
  [StackConstants.CONSOLE_API_MANUAL_USER_RISK_ASSIGNMENT_FUNCTION_NAME]: {
    codePath: 'console-api-pulse',
    handler: manualRiskAssignmentHandler,
    handlerName: 'manualRiskAssignmentHandler',
  },
  [StackConstants.CONSOLE_API_PARAMETER_RISK_ASSIGNMENT_FUNCTION_NAME]: {
    codePath: 'console-api-pulse',
    handler: parameterRiskAssignmentHandler,
    handlerName: 'parameterRiskAssignmentHandler',
  },
  [StackConstants.TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME]: {
    codePath: 'tarpon-change-mongodb-consumer',
    handler: tarponChangeMongodbHandler,
    handlerName: 'tarponChangeMongodbHandler',
  },
  [StackConstants.WEBHOOK_TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME]:
    {
      codePath: 'tarpon-change-webhook-consumer',
      handler: tarponChangeWebhookHandler,
      handlerName: 'tarponChangeWebhookHandler',
    },
  [StackConstants.SANCTIONS_FUNCTION_NAME]: {
    codePath: 'sanctions',
    handler: sanctionsHandler,
    handlerName: 'sanctionsHandler',
  },
  [StackConstants.HAMMERHEAD_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME]: {
    codePath: 'hammerhead-change-capture-kinesis-consumer',
    handler: hammerheadChangeCaptureHandler,
    handlerName: 'hammerheadChangeCaptureHandler',
  },
}
