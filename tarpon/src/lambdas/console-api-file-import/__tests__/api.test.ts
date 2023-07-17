import { ImportRepository } from '../import-repository'
import { fileImportHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'

const testApiEndPoints = new TestApiEndpoint(
  ImportRepository,
  fileImportHandler
)

describe.each<TestApiEndpointOptions>([
  {
    method: 'GET',
    path: '/',
    methodName: 'getFileImport',
    payload: { importId: 'importId' },
  },
  { method: 'POST', path: '/', methodName: 'postFileImport' },
])('File Import API', ({ method, path, payload, methodName }) => {
  testApiEndPoints.testApi({ method, path, payload }, methodName)
})
