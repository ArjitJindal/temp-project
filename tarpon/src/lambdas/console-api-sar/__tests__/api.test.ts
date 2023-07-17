import { sarHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
  mockServiceMethod,
} from '@/test-utils/apigateway-test-utils'
import { ReportService } from '@/services/sar/service'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'

const testApiEndPoints = new TestApiEndpoint(ReportService, sarHandler)

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/report-types', methodName: 'getTypes' },
  { method: 'POST', path: '/reports/draft', methodName: 'getReportDraft' },
  { method: 'GET', path: '/reports', methodName: 'getReports' },
  {
    method: 'GET',
    path: '/reports/{reportId}',
    methodName: 'getReport',
    payload: { reportId: 'reportId' },
  },
  { method: 'POST', path: '/reports', methodName: 'completeReport' },
  {
    method: 'POST',
    path: '/reports/{reportId}/draft',
    methodName: 'draftReport',
    payload: { reportId: 'reportId' },
  },
])('SAR API', ({ method, path, methodName, payload }) => {
  beforeAll(() => {
    mockServiceMethod(CaseRepository, 'getCaseById', {})
    mockServiceMethod(MongoDbTransactionRepository, 'getTransactions', {})
  })
  testApiEndPoints.testApi({ method, path, payload }, methodName)
})
