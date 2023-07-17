import { dashboardStatsHandler } from '../app'
import { DashboardStatsRepository } from '../repositories/dashboard-stats-repository'
import { AccountsService } from '@/services/accounts'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
  mockServiceMethod,
} from '@/test-utils/apigateway-test-utils'

const testApiEndPointsCases = new TestApiEndpoint(
  DashboardStatsRepository,
  dashboardStatsHandler
)

const defaultPayload = {
  startTimestamp: '1626105600000',
  endTimestamp: '1626192000000',
  granularity: 'DAY',
}

describe.each<TestApiEndpointOptions>([
  {
    method: 'GET',
    path: '/dashboard_stats/transactions',
    methodName: 'getTransactionCountStats',
    payload: defaultPayload,
  },
  {
    method: 'GET',
    path: '/dashboard_stats/hits_per_user',
    methodName: 'getHitsByUserStats',
    payload: defaultPayload,
  },
  {
    method: 'GET',
    path: '/dashboard_stats/rule_hit',
    methodName: 'getRuleHitCountStats',
    payload: defaultPayload,
  },
  {
    method: 'GET',
    path: '/dashboard_stats/drs-distribution',
    methodName: 'getDRSDistributionStats',
    payload: defaultPayload,
  },
  {
    method: 'GET',
    path: '/dashboard_stats/team',
    methodName: 'refreshTeamStats',
    payload: defaultPayload,
  },
])('Test dashboardStatsHandler', ({ method, path, methodName, payload }) => {
  beforeAll(() => {
    mockServiceMethod(DashboardStatsRepository, 'refreshAllStats', {})
    mockServiceMethod(AccountsService, 'getAccountTenant', {})
    mockServiceMethod(AccountsService, 'getTenantAccounts', [])
  })
  testApiEndPointsCases.testApi({ method, path, payload }, methodName)
})
