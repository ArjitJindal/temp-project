import * as riskHandler from '../app'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
  mockServiceMethod,
} from '@/test-utils/apigateway-test-utils'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'

withFeatureHook(['PULSE'])

const classificationEndpoints = new TestApiEndpoint(
  RiskRepository,
  riskHandler.riskClassificationHandler
)

describe.each<TestApiEndpointOptions>([
  {
    method: 'GET',
    path: '/pulse/risk-classification',
    methodName: 'getRiskClassificationValues',
  },
  {
    method: 'POST',
    path: '/pulse/risk-classification',
    methodName: 'createOrUpdateRiskClassificationConfig',
  },
])('Risk Classification API', ({ method, path, methodName, payload }) => {
  beforeAll(() => {
    mockServiceMethod(RiskRepository, 'getRiskClassificationValues', {
      caseId: 'caseId',
    })
    jest
      .spyOn(riskHandler, 'validateClassificationRequest')
      .mockReturnValue(void 0)
  })
  classificationEndpoints.testApi({ method, path, payload }, methodName)
})

const parametersEndpoints = new TestApiEndpoint(
  RiskRepository,
  riskHandler.parameterRiskAssignmentHandler
)

describe.each<TestApiEndpointOptions>([
  {
    method: 'POST',
    path: '/pulse/risk-parameter',
    methodName: 'createOrUpdateParameterRiskItem',
    payload: { parameterAttributeRiskValues: 'parameterAttributeRiskValues' },
  },
  {
    method: 'GET',
    path: '/pulse/risk-parameter',
    methodName: 'getParameterRiskItem',
    payload: { parameter: 'parameter', entityType: 'entityType' },
  },
])('Risk Parameter API', ({ method, path, methodName, payload }) => {
  beforeAll(() => {
    mockServiceMethod(RiskRepository, 'getParameterRiskItem', {
      caseId: 'caseId',
    })
  })
  parametersEndpoints.testApi({ method, path, payload }, methodName)
})

const manualRiskAssignmentEndpoints = new TestApiEndpoint(
  RiskRepository,
  riskHandler.manualRiskAssignmentHandler
)

describe.each<TestApiEndpointOptions>([
  {
    method: 'POST',
    path: '/pulse/risk-assignment',
    methodName: 'createOrUpdateManualDRSRiskItem',
  },
  {
    method: 'GET',
    path: '/pulse/risk-assignment',
    methodName: 'getDRSRiskItem',
  },
])('Manual Risk Assignment API', ({ method, path, methodName, payload }) => {
  beforeAll(() => {
    mockServiceMethod(RiskRepository, 'getDRSRiskItem', {
      caseId: 'caseId',
    })
  })
  manualRiskAssignmentEndpoints.testApi({ method, path, payload }, methodName)
})

const riskLevelAndScoreHandler = new TestApiEndpoint(
  RiskRepository,
  riskHandler.riskLevelAndScoreHandler
)

describe.each<TestApiEndpointOptions>([
  {
    method: 'GET',
    path: '/pulse/krs-value',
    methodName: 'getKrsValueFromMongo',
    payload: { userId: 'userId' },
  },
  {
    method: 'GET',
    path: '/pulse/ars-value',
    methodName: 'getArsValueFromMongo',
    payload: { transactionId: 'transactionId' },
  },
  {
    method: 'GET',
    path: '/pulse/drs-value',
    methodName: 'getDrsValueFromMongo',
    payload: { userId: 'userId' },
  },
])('Risk Level and Score API', ({ method, path, methodName, payload }) => {
  riskLevelAndScoreHandler.testApi({ method, path, payload }, methodName)
})
