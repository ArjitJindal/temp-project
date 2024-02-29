import { Context } from 'aws-lambda'
import { APIGatewayProxyEventHeaders } from 'aws-lambda/trigger/api-gateway-proxy'

export type ApiRequestLog = {
  context: Context
  headers: APIGatewayProxyEventHeaders
  path: string
  method: string
  userId?: string
  timestamp: number
  payload?: any
  queryStringParameters?: any
  pathParameters?: any
  domainName?: string
  stage?: string
  multiValueQueryStringParameters?: any
  tenantId: string
  requestId?: string
  traceId?: string
}
