import { Context } from 'aws-lambda'

export type RequestLogger = {
  context: Context
  path: string
  method: string
  userId?: string
  responseCode: number
  timestamp: number
  payload?: any
  queryStringParameters?: any
  pathParameters?: any
  domainName?: string
  stage?: string
  multiValueQueryStringParameters?: any
  error?: any
  message?: string
}
