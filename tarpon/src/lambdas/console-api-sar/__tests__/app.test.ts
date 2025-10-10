import { sarHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'

const testApiEndPoints = new TestApiEndpoint(sarHandler)

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/report-types' },
  { method: 'POST', path: '/reports/draft' },
  { method: 'GET', path: '/reports' },
  {
    method: 'GET',
    path: '/reports/{reportId}',
    payload: { reportId: 'reportId' },
  },
  { method: 'POST', path: '/reports' },
  {
    method: 'POST',
    path: '/reports/{reportId}/draft',
    payload: { reportId: 'reportId' },
  },
])('SAR API', ({ method, path, payload }) => {
  testApiEndPoints.testApi({ method, path, payload })
})
