import { listsHandler } from '../app'
import { ListRepository } from '@/services/list/repositories/list-repository'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'

withFeatureHook(['LISTS'])

const testApiEndPoints = new TestApiEndpoint(ListRepository, listsHandler)

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/lists', methodName: 'getListHeaders' },
  { method: 'POST', path: '/lists', methodName: 'createList' },
  { method: 'GET', path: '/lists/{listId}', methodName: 'getListHeader' },
  { method: 'PATCH', path: '/lists/{listId}', methodName: 'getListHeader' },
  { method: 'DELETE', path: '/lists/{listId}', methodName: 'deleteList' },
  { method: 'GET', path: '/lists/{listId}/items', methodName: 'getListItems' },
  { method: 'POST', path: '/lists/{listId}/items', methodName: 'setListItem' },
  {
    method: 'DELETE',
    path: '/lists/{listId}/items/{key}',
    methodName: 'deleteListItem',
  },
])('List API', ({ method, path, payload, methodName }) => {
  testApiEndPoints.testApi({ method, path, payload }, methodName)
})
