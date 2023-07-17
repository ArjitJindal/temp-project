import { auditLogHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'
import { AuditLogRepository } from '@/services/audit-log/repositories/auditlog-repository'

const testApiEndpoint = new TestApiEndpoint(AuditLogRepository, auditLogHandler)

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/auditlog', methodName: 'getAllAuditLogs' },
])('API Gateway event', ({ method, path, methodName }) => {
  testApiEndpoint.testApi({ method, path }, methodName)
})
