import { NarrativeService } from '../services/narrative-template-service'
import { narrativeTemplateHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'

const testApiEndPoints = new TestApiEndpoint(
  NarrativeService,
  narrativeTemplateHandler
)

describe.each<TestApiEndpointOptions>([
  {
    method: 'GET',
    path: '/narrative-templates',
    methodName: 'getNarrativeTemplates',
  },
  {
    method: 'GET',
    path: '/narrative-template/{narrativeTemplateId}',
    methodName: 'getNarrativeTemplate',
    payload: { narrativeTemplateId: 'narrativeTemplateId' },
  },
  {
    method: 'PUT',
    path: '/narrative-template/{narrativeTemplateId}',
    methodName: 'updateNarrativeTemplate',
    payload: { narrativeTemplateId: 'narrativeTemplateId' },
  },
  {
    method: 'DELETE',
    path: '/narrative-template/{narrativeTemplateId}',
    methodName: 'deleteNarrativeTemplate',
    payload: { narrativeTemplateId: 'narrativeTemplateId' },
  },
  {
    method: 'POST',
    path: '/narrative-template',
    methodName: 'createNarrativeTemplate',
  },
])('Narrative Template API', ({ method, path, methodName, payload }) => {
  testApiEndPoints.testApi({ method, path, payload }, methodName)
})
