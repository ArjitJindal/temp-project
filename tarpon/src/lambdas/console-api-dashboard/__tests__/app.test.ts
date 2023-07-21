import { dashboardStatsHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'

const testApiEndPointsCases = new TestApiEndpoint(dashboardStatsHandler)

const defaultPayload = {
  startTimestamp: '1626105600000',
  endTimestamp: '1626192000000',
  granularity: 'DAY',
}

describe.each<TestApiEndpointOptions>([
  {
    method: 'GET',
    path: '/dashboard_stats/transactions',
    payload: defaultPayload,
  },
  {
    method: 'GET',
    path: '/dashboard_stats/hits_per_user',
    payload: defaultPayload,
  },
  {
    method: 'GET',
    path: '/dashboard_stats/rule_hit',
    payload: defaultPayload,
  },
  {
    method: 'GET',
    path: '/dashboard_stats/drs-distribution',
    payload: defaultPayload,
  },
  {
    method: 'GET',
    path: '/dashboard_stats/team',

    payload: defaultPayload,
  },
])('Test dashboardStatsHandler', ({ method, path, payload }) => {
  testApiEndPointsCases.testApi({ method, path, payload })
})
