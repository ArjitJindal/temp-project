import { ruleHandler, ruleInstanceHandler } from '../app'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'

const testApiEndPoints = new TestApiEndpoint(ruleHandler)

dynamoDbSetupHook()

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/rules' },
  { method: 'GET', path: '/rule-filters' },
  { method: 'POST', path: '/rules' },
  {
    method: 'PUT',
    path: '/rules/{ruleId}',
    payload: { ruleId: 'ruleId' },
  },
  {
    method: 'DELETE',
    path: '/rules/{ruleId}',
    payload: { ruleId: 'ruleId' },
  },
])('Rule API', ({ method, path, payload }) => {
  testApiEndPoints.testApi({ method, path, payload })
})

const ruleInstanceTestApiEndPoints = new TestApiEndpoint(ruleInstanceHandler)

describe.each<TestApiEndpointOptions>([
  {
    method: 'PUT',
    path: '/rule_instances/{ruleInstanceId}',
    payload: { ruleInstanceId: 'ruleInstanceId' },
  },
  {
    method: 'DELETE',
    path: '/rule_instances/{ruleInstanceId}',
    payload: { ruleInstanceId: 'ruleInstanceId' },
  },
  {
    method: 'POST',
    path: '/rule_instances',
  },
  { method: 'GET', path: '/rule_instances' },
])('Rule Instance API', ({ method, path, payload }) => {
  ruleInstanceTestApiEndPoints.testApi({ method, path, payload })
})
