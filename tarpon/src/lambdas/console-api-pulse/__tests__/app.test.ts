import * as riskHandler from '../app'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'

withFeatureHook(['RISK_SCORING', 'RISK_LEVELS'])

const classificationEndpoints = new TestApiEndpoint(
  riskHandler.riskClassificationHandler
)

describe.each<TestApiEndpointOptions>([
  {
    method: 'GET',
    path: '/pulse/risk-classification',
  },
  {
    method: 'POST',
    path: '/pulse/risk-classification',
  },
])('Risk Classification API', ({ method, path, payload }) => {
  classificationEndpoints.testApi({ method, path, payload })
})

const parametersEndpoints = new TestApiEndpoint(
  riskHandler.parameterRiskAssignmentHandler
)

describe.each<TestApiEndpointOptions>([
  {
    method: 'POST',
    path: '/pulse/risk-parameter',
    payload: { parameterAttributeRiskValues: 'parameterAttributeRiskValues' },
  },
  {
    method: 'GET',
    path: '/pulse/risk-parameter',
    payload: { parameter: 'parameter', entityType: 'entityType' },
  },
])('Risk Parameter API', ({ method, path, payload }) => {
  parametersEndpoints.testApi({ method, path, payload })
})

const manualRiskAssignmentEndpoints = new TestApiEndpoint(
  riskHandler.manualRiskAssignmentHandler
)

describe.each<TestApiEndpointOptions>([
  {
    method: 'POST',
    path: '/pulse/risk-assignment',
    payload: { riskLevel: 'riskLevel', entityType: 'entityType' },
  },
  {
    method: 'GET',
    path: '/pulse/risk-assignment',
  },
])('Manual Risk Assignment API', ({ method, path, payload }) => {
  manualRiskAssignmentEndpoints.testApi({ method, path, payload })
})

const riskLevelAndScoreHandler = new TestApiEndpoint(
  riskHandler.riskLevelAndScoreHandler
)

describe.each<TestApiEndpointOptions>([
  {
    method: 'GET',
    path: '/pulse/krs-value',
    payload: { userId: 'userId' },
  },
  {
    method: 'GET',
    path: '/pulse/ars-value',
    payload: { transactionId: 'transactionId' },
  },
  {
    method: 'GET',
    path: '/pulse/drs-value',
    payload: { userId: 'userId' },
  },
])('Risk Level and Score API', ({ method, path, payload }) => {
  riskLevelAndScoreHandler.testApi({ method, path, payload })
})
