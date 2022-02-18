import { APIGatewayProxyResult } from 'aws-lambda'

export const CORS_ALLOW_ORIGIN = '*'

export function cors(lambdaResponse: APIGatewayProxyResult) {
  const headers = lambdaResponse.headers || {}
  headers['Access-Control-Allow-Origin'] = CORS_ALLOW_ORIGIN
  lambdaResponse.headers = headers
  return lambdaResponse
}
