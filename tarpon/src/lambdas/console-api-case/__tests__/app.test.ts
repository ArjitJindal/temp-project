import { casesHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'

const testApiEndPointsCases = new TestApiEndpoint(casesHandler)
const testApiEndPointsAlerts = new TestApiEndpoint(casesHandler)

dynamoDbSetupHook()
withFeatureHook(['ADVANCED_WORKFLOWS'])

process.env.MAXIMUM_ALLOWED_EXPORT_SIZE = '1000'

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/cases' },
  {
    method: 'GET',
    path: '/cases/{caseId}',
    payload: {
      caseId: '1',
    },
  },
  {
    method: 'PATCH',
    path: '/cases/statusChange',
  },
  {
    method: 'PATCH',
    path: '/cases/assignments',
  },
  {
    method: 'PATCH',
    path: '/cases/reviewAssignments',
  },
  {
    method: 'POST',
    path: '/cases/{caseId}/comments',
    payload: {
      caseId: 'caseId',
      comment: 'comment',
    },
  },
  {
    method: 'DELETE',
    path: '/cases/{caseId}/comments/{commentId}',
    payload: {
      caseId: 'caseId',
      commentId: 'commentId',
    },
  },
  {
    method: 'POST',
    path: '/cases/{caseId}/escalate',
    payload: {
      caseId: 'caseId',
      caseUpdateRequest: {},
    },
  },
  {
    method: 'POST',
    path: '/alerts/new-case',
  },
])('Test casesHandler', ({ method, path, payload }) => {
  testApiEndPointsCases.testApi({ method, path, payload })
})

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/alerts' },
  { method: 'GET', path: '/alerts/{alertId}' },
  {
    method: 'DELETE',
    path: '/alerts/{alertId}/comments/{commentId}',
  },
  {
    method: 'PATCH',
    path: '/alerts/statusChange',
    payload: {
      alertIds: ['1'],
    },
  },
  {
    method: 'PATCH',
    path: '/alerts/assignments',
  },
  {
    method: 'PATCH',
    path: '/alerts/reviewAssignments',
  },
])('Test alertsHandler', ({ method, path, payload }) => {
  testApiEndPointsAlerts.testApi({ method, path, payload })
})
