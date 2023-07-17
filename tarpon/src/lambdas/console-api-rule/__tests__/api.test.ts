import { ruleHandler, ruleInstanceHandler } from '../app'
import { RuleService } from '@/services/rules-engine'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
  mockServiceMethod,
} from '@/test-utils/apigateway-test-utils'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'

const testApiEndPoints = new TestApiEndpoint(RuleService, ruleHandler)

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/rules', methodName: 'getAllRules' },
  { method: 'GET', path: '/rule-filters', methodName: 'getAllRuleFilters' },
  { method: 'POST', path: '/rules', methodName: 'createOrUpdateRule' },
  {
    method: 'PUT',
    path: '/rules/{ruleId}',
    methodName: 'createOrUpdateRule',
    payload: { ruleId: 'ruleId' },
  },
  {
    method: 'DELETE',
    path: '/rules/{ruleId}',
    methodName: 'deleteRule',
    payload: { ruleId: 'ruleId' },
  },
])('Rule API', ({ method, path, methodName, payload }) => {
  testApiEndPoints.testApi({ method, path, payload }, methodName)
})

const ruleInstanceTestApiEndPoints = new TestApiEndpoint(
  RuleService,
  ruleInstanceHandler
)

describe.each<TestApiEndpointOptions>([
  {
    method: 'PUT',
    path: '/{ruleInstanceId}',
    methodName: 'createOrUpdateRuleInstance',
    payload: { ruleInstanceId: 'ruleInstanceId' },
  },
  {
    method: 'DELETE',
    path: '/{ruleInstanceId}',
    methodName: 'deleteRuleInstance',
    payload: { ruleInstanceId: 'ruleInstanceId' },
  },
  {
    method: 'POST',
    path: '/rule_instances',
    methodName: 'createOrUpdateRuleInstance',
  },
  { method: 'GET', path: '/rule_instances', methodName: 'getAllRuleInstances' },
])('Rule Instance API', ({ method, path, methodName, payload }) => {
  beforeAll(() => {
    mockServiceMethod(RuleInstanceRepository, 'getRuleInstanceById', {})
  })
  ruleInstanceTestApiEndPoints.testApi({ method, path, payload }, methodName)
})
