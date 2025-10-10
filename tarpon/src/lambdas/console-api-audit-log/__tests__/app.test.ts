import { auditLogHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'

const testApiEndpoint = new TestApiEndpoint(auditLogHandler)

describe.each<TestApiEndpointOptions>([{ method: 'GET', path: '/auditlog' }])(
  'API Gateway event',
  ({ method, path }) => {
    testApiEndpoint.testApi({ method, path })
  }
)
