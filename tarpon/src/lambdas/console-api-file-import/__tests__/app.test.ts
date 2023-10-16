import { fileImportHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'

const testApiEndPoints = new TestApiEndpoint(fileImportHandler)

describe.each<TestApiEndpointOptions>([
  {
    method: 'GET',
    path: '/imports/{importId}',
    payload: { importId: 'importId' },
  },
  {
    method: 'POST',
    path: '/import/users',
    payload: { importId: 'importId' },
  },
])('File Import API', ({ method, path, payload }) => {
  testApiEndPoints.testApi({ method, path, payload })
})
