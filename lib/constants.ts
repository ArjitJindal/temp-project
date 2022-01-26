export function getResourceName(resourceName: string) {
  return `tarpon-${resourceName}`
}

export const TarponStackConstants = {
  DYNAMODB_TABLE_NAME: 'Tarpon',
  API_KEY_AUTHORIZER_BASE_ROLE_NAME: getResourceName(
    'ApiKeyAuthorizerBaseRole'
  ),
}
