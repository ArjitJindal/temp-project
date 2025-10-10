import { Context } from 'aws-lambda'
import { ApiRequestLog } from '@/@types/request-logger'

export const mockApiRequestLog = (
  overrides?: Partial<ApiRequestLog>
): ApiRequestLog => {
  const defaultContext: Context = {
    awsRequestId: 'test-request-id',
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'test-arn',
    logGroupName: 'test-log-group',
    logStreamName: 'test-log-stream',
    memoryLimitInMB: '128',
    getRemainingTimeInMillis: () => 1000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  }

  const defaultLog: ApiRequestLog = {
    context: defaultContext,
    headers: {
      'content-type': 'application/json',
      'user-agent': 'test-agent',
    },
    path: '/api/test',
    method: 'GET',
    timestamp: Date.now(),
    tenantId: 'test-tenant',
    requestId: 'test-req-123',
    traceId: 'test-trace-123',
    stage: 'test',
    domainName: 'api.test.com',
  }

  return {
    ...defaultLog,
    ...overrides,
  }
}
