import { CaseService } from '../services/case-service'
import { casesHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { AlertsService } from '@/services/alerts'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { setSkipRoleCheck } from '@/test-utils/user-test-utils'
import { setSkipAuditLogs } from '@/test-utils/auditlog-test-utils'

const testApiEndPointsCases = new TestApiEndpoint(CaseService, casesHandler)
const testApiEndPointsAlerts = new TestApiEndpoint(AlertsService, casesHandler)

dynamoDbSetupHook()
withFeatureHook(['ESCALATION'])
setSkipRoleCheck()
setSkipAuditLogs()

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/cases', methodName: 'getCases' },
  {
    method: 'GET',
    path: '/cases/{caseId}',
    methodName: 'getCase',
    payload: {
      caseId: '1',
    },
  },
  {
    method: 'PATCH',
    path: '/cases/statusChange',
    methodName: 'updateCasesStatus',
  },
  {
    method: 'PATCH',
    path: '/cases/assignments',
    methodName: 'updateCasesAssignments',
  },
  {
    method: 'PATCH',
    path: '/cases/reviewAssignments',
    methodName: 'updateCasesReviewAssignments',
  },
  {
    method: 'POST',
    path: '/cases/{caseId}/comments',
    methodName: 'saveCaseComment',
    payload: {
      caseId: 'caseId',
      comment: 'comment',
    },
  },
  {
    method: 'DELETE',
    path: '/cases/{caseId}/comments/{commentId}',
    methodName: 'deleteCaseComment',
    payload: {
      caseId: 'caseId',
      commentId: 'commentId',
    },
  },
  {
    method: 'POST',
    path: '/cases/{caseId}/escalate',
    methodName: 'escalateCase',
    payload: {
      caseId: 'caseId',
      caseUpdateRequest: {},
    },
  },
  {
    method: 'POST',
    path: '/alerts/new-case',
    methodName: 'getCase',
  },
])('Test casesHandler', ({ method, path, methodName, payload }) => {
  testApiEndPointsCases.testApi({ method, path, payload }, methodName)
})

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/alerts', methodName: 'getAlerts' },
  { method: 'GET', path: '/alerts/{alertId}', methodName: 'getAlert' },
  {
    method: 'DELETE',
    path: '/alerts/{alertId}/comments/{commentId}',
    methodName: 'deleteAlertComment',
  },
  {
    method: 'PATCH',
    path: '/alerts/statusChange',
    methodName: 'updateAlertsStatus',
  },
  {
    method: 'PATCH',
    path: '/alerts/assignments',
    methodName: 'updateAssigneeToAlerts',
  },
  {
    method: 'PATCH',
    path: '/alerts/reviewAssignments',
    methodName: 'updateReviewAssigneeToAlerts',
  },
])('Test alertsHandler', ({ method, path, methodName }) => {
  testApiEndPointsAlerts.testApi({ method, path }, methodName)
})
