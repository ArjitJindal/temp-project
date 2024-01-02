import { copilotHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'

const testApiEndPointsCases = new TestApiEndpoint(copilotHandler)

withFeatureHook(['NARRATIVE_COPILOT'])

describe.each<TestApiEndpointOptions>([
  {
    method: 'POST',
    path: '/copilot/narrative',
    payload: { caseId: 'caseId' },
  },
])('Test copilotHandler', ({ method, path, payload }) => {
  testApiEndPointsCases.testApi({ method, path, payload })
})
