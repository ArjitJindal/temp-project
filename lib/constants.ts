export function getResourceName(resourceName: string, dash = false) {
  return `tarpon${dash ? '-' : ''}${resourceName}`
}

export function getS3BucketName(name: string, stage?: string) {
  return name + (stage ? `-${stage}` : '')
}

export const TarponStackConstants = {
  DYNAMODB_TABLE_NAME: 'Tarpon',
  DOCUMENT_DB_DATABASE_NAME: 'tarpon',
  DOCUMENT_DB_USERNAME_NAME: 'tarponUser',
  DOCUMENT_DB_SECURITY_GROUP_NAME: 'docdb-lambda-sg',
  API_KEY_AUTHORIZER_BASE_ROLE_NAME: getResourceName(
    'ApiKeyAuthorizerBaseRole'
  ),
  JWT_AUTHORIZER_BASE_ROLE_NAME: getResourceName('JwtAuthorizerBaseRole'),
  S3_IMPORT_BUCKET_PREFIX: getResourceName('import', true),
  S3_DOCUMENT_BUCKET_PREFIX: getResourceName('document', true),
  S3_TMP_BUCKET_PREFIX: getResourceName('tmp', true),

  // Lambda names
  API_KEY_AUTHORIZER_FUNCTION_NAME: getResourceName('ApiKeyAuthorizerFunction'),
  JWT_AUTHORIZER_FUNCTION_NAME: getResourceName('JWTAuthorizerFunction'),
  TRANSACTION_FUNCTION_NAME: getResourceName('TransactionFunction'),
  USER_FUNCTION_NAME: getResourceName('UserFunction'),
  API_KEY_GENERATOR_FUNCTION_NAME: getResourceName('ApiKeyGeneratorFunction'),
  RULE_INSTANCE_FUNCTION_NAME: getResourceName('RuleInstanceFunction'),
  TRANSACTIONS_VIEW_FUNCTION_NAME: getResourceName('TransactionsViewFunction'),
  TRANSACTIONS_PER_USER_VIEW_FUNCTION_NAME: getResourceName(
    'TransactionsPerUserViewFunction'
  ),
  DASHBOARD_STATS_TRANSACTIONS_FUNCTION_NAME: getResourceName(
    'DashboardStatsTransactionsFunction'
  ),
  TRANSACTION_COMMENTS_FUNCTION_NAME: getResourceName(
    'TransactionsCommentsFunction'
  ),
  BUSINESS_USERS_VIEW_FUNCTION_NAME: getResourceName(
    'BusinessUsersViewFunction'
  ),
  CONSUMER_USERS_VIEW_FUNCTION_NAME: getResourceName(
    'ConsumersUsersViewFunction'
  ),
  FILE_IMPORT_FUNCTION_NAME: getResourceName('FileImportFunction'),
  GET_PRESIGNED_URL_FUNCTION_NAME: getResourceName('GetPresignedUrlFunction'),
  LIST_IMPORTER_FUNCTION_NAME: getResourceName('ListImporterFunction'),
  TARPON_CHANGE_CAPTURE_KINESIS_CONSUMER_FUNCTION_NAME: getResourceName(
    'TarponChangeCaptureKinesisConsumer'
  ),
}
