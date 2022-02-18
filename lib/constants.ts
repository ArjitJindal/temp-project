export function getResourceName(resourceName: string, dash = false) {
  return `tarpon${dash ? '-' : ''}${resourceName}`
}

export function getS3BucketName(name: string, account?: string) {
  return name + (account ? `-${account}` : '')
}

export const TarponStackConstants = {
  DYNAMODB_TABLE_NAME: 'Tarpon',
  API_KEY_AUTHORIZER_BASE_ROLE_NAME: getResourceName(
    'ApiKeyAuthorizerBaseRole'
  ),
  S3_IMPORT_BUCKET_PREFIX: getResourceName('import', true),
  S3_IMPORT_TMP_BUCKET_PREFIX: getResourceName('import-tmp', true),
}
