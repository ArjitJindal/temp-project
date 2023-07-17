import { UserService } from '../services/user-service'
import {
  businessUsersViewHandler,
  consumerUsersViewHandler,
  allUsersViewHandler,
} from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'

const testApiEndPoints = new TestApiEndpoint(
  UserService,
  businessUsersViewHandler
)

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/business/users', methodName: 'getBusinessUsers' },
  {
    method: 'GET',
    path: '/business/users/{userId}',
    methodName: 'getBusinessUser',
    payload: { userId: '123' },
  },
  {
    method: 'POST',
    path: '/business/users/{userId}',
    methodName: 'updateBusinessUser',
    payload: { userId: '123' },
  },
  { method: 'GET', path: '/users/uniques', methodName: 'getUniques' },
])('Business Users API', ({ method, path, methodName, payload }) => {
  testApiEndPoints.testApi({ method, path, payload }, methodName)
})

const userApiEndPoints = new TestApiEndpoint(
  UserService,
  consumerUsersViewHandler
)

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/consumer/users', methodName: 'getConsumerUsers' },
  {
    method: 'GET',
    path: '/consumer/users/{userId}',
    methodName: 'getConsumerUser',
    payload: { userId: '123' },
  },
  {
    method: 'POST',
    path: '/consumer/users/{userId}',
    methodName: 'updateConsumerUser',
    payload: { userId: '123' },
  },
  {
    method: 'POST',
    path: '/users/{userId}/comments',
    methodName: 'saveUserComment',
    payload: { userId: '123' },
  },
  {
    method: 'DELETE',
    path: '/users/{userId}/comments/{commentId}',
    methodName: 'deleteUserComment',
    payload: { userId: '123', commentId: '456' },
  },
])('Consumer Users API', ({ method, path, methodName, payload }) => {
  userApiEndPoints.testApi({ method, path, payload }, methodName)
})

withFeatureHook(['SALESFORCE'])

const allUsersApiEndPoints = new TestApiEndpoint(
  UserService,
  allUsersViewHandler
)

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/users', methodName: 'getUsers' },
  {
    method: 'GET',
    path: '/users/{userId}/salesforce',
    methodName: 'getUser',
  },
  {
    method: 'GET',
    path: '/users/{userId}/screening-status',
    methodName: 'getUser',
  },
])('All Users API', ({ method, path, methodName, payload }) => {
  allUsersApiEndPoints.testApi({ method, path, payload }, methodName)
})
