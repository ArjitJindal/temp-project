import { Context } from 'aws-lambda'

export type ApiRequestLog = {
  context: Context
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
