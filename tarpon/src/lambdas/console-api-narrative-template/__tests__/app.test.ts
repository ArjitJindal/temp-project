import { narrativeTemplateHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'

const testApiEndPoints = new TestApiEndpoint(narrativeTemplateHandler)

describe.each<TestApiEndpointOptions>([
  {
    method: 'GET',
    path: '/narrative-templates',
  },
  {
    method: 'GET',
    path: '/narrative-template/{narrativeTemplateId}',
    payload: { narrativeTemplateId: 'narrativeTemplateId' },
  },
  {
    method: 'PUT',
    path: '/narrative-template/{narrativeTemplateId}',
    payload: { narrativeTemplateId: 'narrativeTemplateId' },
  },
  {
    method: 'DELETE',
    path: '/narrative-template/{narrativeTemplateId}',
    payload: { narrativeTemplateId: 'narrativeTemplateId' },
  },
  {
    method: 'POST',
    path: '/narrative-template',
  },
])('Narrative Template API', ({ method, path, payload }) => {
  testApiEndPoints.testApi({ method, path, payload })
})
