import { copilotHandler } from '../app'
import { UserService } from '@/lambdas/console-api-user/services/user-service'
import { CaseService } from '@/lambdas/console-api-case/services/case-service'
import { CopilotService } from '@/services/copilot/copilot-service'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
  mockServiceMethod,
} from '@/test-utils/apigateway-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'

const testApiEndPointsCases = new TestApiEndpoint(
  CopilotService,
  copilotHandler
)

withFeatureHook(['COPILOT'])

describe.each<TestApiEndpointOptions>([
  {
    method: 'POST',
    path: '/copilot/narrative',
    methodName: 'getNarrative',
    payload: { caseId: 'caseId' },
  },
])('Test copilotHandler', ({ method, path, methodName, payload }) => {
  beforeAll(() => {
    mockServiceMethod(CaseService, 'getCase', { caseId: 'caseId' })
    mockServiceMethod(CaseService, 'getCases', { caseId: 'caseId' })
    mockServiceMethod(UserService, 'getUser', { caseId: 'caseId' })
  })
  testApiEndPointsCases.testApi({ method, path, payload }, methodName)
})
