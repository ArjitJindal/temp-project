import { Config } from './configs/config'

export function getResourceNameForTarpon(resourceName: string, dash = false) {
  return `tarpon${dash ? '-' : ''}${resourceName}`
}

export function getResourceNameForHammerhead(
  resourceName: string,
  dash = false
) {
  return `hammerhead${dash ? '-' : ''}${resourceName}`
}

export function getNameForGlobalResource(name: string, config: Config) {
  return `${name + (config.stage ? `-${config.stage}` : '')}-${
    config.env.region ? config.env.region : 'eu-central-1'
  }`
}

export const TarponStackConstants = {
  DYNAMODB_TABLE_NAME: 'Tarpon',
  MONGO_DB_DATABASE_NAME: 'tarpon',
  MONGO_DB_USERNAME_NAME: 'tarponUser',
  MONGO_DB_SECURITY_GROUP_NAME: 'atlas-lambda-sg',
  API_KEY_AUTHORIZER_BASE_ROLE_NAME: getResourceNameForTarpon(
    'ApiKeyAuthorizerBaseRole'
  ),
  JWT_AUTHORIZER_BASE_ROLE_NAME: getResourceNameForTarpon(
    'JwtAuthorizerBaseRole'
  ),
  S3_IMPORT_BUCKET_PREFIX: getResourceNameForTarpon('import', true),
  S3_DOCUMENT_BUCKET_PREFIX: getResourceNameForTarpon('document', true),
  S3_TMP_BUCKET_PREFIX: getResourceNameForTarpon('tmp', true),

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
  LIST_IMPORTER_FUNCTION_NAME: getResourceNameForTarpon('ListImporterFunction'),
  TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME:
    getResourceNameForTarpon('TarponChangeCaptureKinesisConsumer'),
  SLACK_APP_FUNCTION_NAME: getResourceNameForTarpon('SlackAppFunction'),
  LAMBDA_LATEST_ALIAS_NAME: 'LATEST',
}

export const HammerheadStackConstants = {
  DYNAMODB_TABLE_NAME: 'Hammerhead',
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
}
