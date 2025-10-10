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

const testApiEndPoints = new TestApiEndpoint(businessUsersViewHandler)

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/business/users' },
  {
    method: 'GET',
    path: '/business/users/{userId}',
    payload: { userId: '123' },
  },
  {
    method: 'POST',
    path: '/business/users/{userId}',
    payload: { userId: '123' },
  },
  { method: 'GET', path: '/users/uniques' },
])('Business Users API', ({ method, path, payload }) => {
  testApiEndPoints.testApi({ method, path, payload })
})

const userApiEndPoints = new TestApiEndpoint(consumerUsersViewHandler)

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/consumer/users' },
  {
    method: 'GET',
    path: '/consumer/users/{userId}',
    payload: { userId: '123' },
  },
  {
    method: 'POST',
    path: '/consumer/users/{userId}',
    payload: { userId: '123' },
  },
])('Consumer Users API', ({ method, path, payload }) => {
  userApiEndPoints.testApi({ method, path, payload })
})

withFeatureHook(['CRM'])

const allUsersApiEndPoints = new TestApiEndpoint(allUsersViewHandler)

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/users' },
  {
    method: 'GET',
    path: '/users/{userId}/crm',
  },
  {
    method: 'GET',
    path: '/users/{userId}/screening-status',
  },
  {
    method: 'POST',
    path: '/users/{userId}/comments',
    payload: { userId: '123' },
  },
  {
    method: 'DELETE',
    path: '/users/{userId}/comments/{commentId}',
    payload: { userId: '123', commentId: '456' },
  },
])('All Users API', ({ method, path, payload }) => {
  allUsersApiEndPoints.testApi({ method, path, payload })
})
