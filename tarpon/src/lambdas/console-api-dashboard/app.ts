import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest } from 'http-errors'
import { DashboardStatsRepository } from './repositories/dashboard-stats-repository'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult, assertCurrentUserRole } from '@/@types/jwt'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { AccountsService } from '@/services/accounts'
import { Account } from '@/@types/openapi-internal/Account'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { DashboardStatsTransactionsCountItem } from '@/@types/openapi-internal/DashboardStatsTransactionsCountItem'

export function shouldRefreshAll(
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
  >
): boolean {
  if (process.env.ENV === 'local') {
    return true
  }
  if (event.queryStringParameters?.forceRefresh) {
    assertCurrentUserRole('root')
    return true
  }
  return false
}

export const dashboardStatsHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const handlers = new Handlers()

    handlers.registerGetDashboardStatsTransactions(async (ctx, request) => {
      const { tenantId } = ctx
      const { startTimestamp, endTimestamp, granularity } = request
      const client = await getMongoDbClient()
      if (!endTimestamp) {
        throw new BadRequest(`Wrong timestamp format: ${endTimestamp}`)
      }
      if (!startTimestamp) {
        throw new BadRequest(`Wrong timestamp format: ${startTimestamp}`)
      }
      const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
        mongoDb: client,
      })
      if (shouldRefreshAll(event)) {
        await dashboardStatsRepository.refreshAllStats()
      }
      const data = await dashboardStatsRepository.getTransactionCountStats(
        startTimestamp,
        endTimestamp,
        granularity
      )
      return {
        data,
      }
    })

    handlers.registerGetDashboardStatsTransactionsTotal(
      async (ctx, request) => {
        const { tenantId } = ctx
        const { startTimestamp, endTimestamp } = request
        const client = await getMongoDbClient()
        if (!endTimestamp) {
          throw new BadRequest(`Wrong timestamp format: ${endTimestamp}`)
        }
        if (!startTimestamp) {
          throw new BadRequest(`Wrong timestamp format: ${startTimestamp}`)
        }
        const dashboardStatsRepository = new DashboardStatsRepository(
          tenantId,
          {
            mongoDb: client,
          }
        )
        if (shouldRefreshAll(event)) {
          await dashboardStatsRepository.refreshAllStats()
        }
        const data = await dashboardStatsRepository.getTransactionCountStats(
          startTimestamp,
          endTimestamp,
          'DAY'
        )
        const result: { [key: string]: number } = {}
        for (const dataItem of data) {
          for (const key of Object.keys(dataItem)) {
            const itemKey = key as keyof DashboardStatsTransactionsCountItem
            const value = dataItem[itemKey]
            if (typeof value === 'number') {
              result[key] = (result[key] ?? 0) + value
            }
          }
        }
        return {
          data: {
            _id: 'TOTAL',
            ...result,
          },
        }
      }
    )

    handlers.registerGetDashboardStatsHitsPerUser(async (ctx, request) => {
      const client = await getMongoDbClient()
      const { tenantId } = ctx
      const { startTimestamp, endTimestamp, direction } = request
      if (!endTimestamp) {
        throw new BadRequest(`Wrong timestamp format: ${endTimestamp}`)
      }
      if (!startTimestamp) {
        throw new BadRequest(`Wrong timestamp format: ${startTimestamp}`)
      }
      const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
        mongoDb: client,
      })
      if (shouldRefreshAll(event)) {
        await dashboardStatsRepository.refreshAllStats()
      }
      return {
        data: await dashboardStatsRepository.getHitsByUserStats(
          startTimestamp,
          endTimestamp,
          direction
        ),
      }
    })

    handlers.registerGetDashboardStatsRuleHit(async (ctx, request) => {
      const client = await getMongoDbClient()
      const { tenantId } = ctx
      const { startTimestamp, endTimestamp } = request
      const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
        mongoDb: client,
      })
      if (shouldRefreshAll(event)) {
        await dashboardStatsRepository.refreshAllStats()
      }
      if (!endTimestamp) {
        throw new BadRequest(`Wrong timestamp format: ${endTimestamp}`)
      }
      if (!startTimestamp) {
        throw new BadRequest(`Wrong timestamp format: ${startTimestamp}`)
      }
      return {
        data: await dashboardStatsRepository.getRuleHitCountStats(
          startTimestamp,
          endTimestamp
        ),
      }
    })

    handlers.registerGetDashboardStatsDrsDistribution(async (ctx) => {
      const client = await getMongoDbClient()
      const dashboardStatsRepository = new DashboardStatsRepository(
        ctx.tenantId,
        { mongoDb: client }
      )
      if (shouldRefreshAll(event)) {
        await dashboardStatsRepository.refreshAllStats()
      }
      const data = await dashboardStatsRepository.getDRSDistributionStats()
      return {
        data,
      }
    })

    handlers.registerGetDashboardTeamStats(async (ctx, request) => {
      const client = await getMongoDbClient()
      const { auth0Domain } = event.requestContext.authorizer
      const { scope, startTimestamp, endTimestamp, caseStatus } = request
      const { tenantId, userId } = ctx
      const mongoDb = await getMongoDbClient()
      const accountsService = new AccountsService({ auth0Domain }, { mongoDb })
      const organization = await accountsService.getAccountTenant(userId)
      const accounts: Account[] = await accountsService.getTenantAccounts(
        organization
      )
      const accountIds = accounts
        .filter((account) => account.role !== 'root')
        .map((account) => account.id)
      const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
        mongoDb: client,
      })
      await dashboardStatsRepository.refreshTeamStats({
        startTimestamp: startTimestamp ? startTimestamp : 0,
        endTimestamp: endTimestamp ? endTimestamp : Number.MAX_SAFE_INTEGER,
      })
      return await dashboardStatsRepository.getTeamStatistics(
        scope,
        startTimestamp ? startTimestamp : 0,
        endTimestamp ? endTimestamp : Number.MAX_SAFE_INTEGER,
        caseStatus,
        accountIds
      )
    })

    handlers.registerGetDashboardStatsOverview(async (ctx) => {
      const client = await getMongoDbClient()
      const { tenantId } = ctx
      const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
        mongoDb: client,
      })
      const accountsService = new AccountsService(
        { auth0Domain: event.requestContext.authorizer.auth0Domain },
        { mongoDb: client }
      )
      const organization = await accountsService.getAccountTenant(ctx.userId)
      const accounts: Account[] = await accountsService.getTenantAccounts(
        organization
      )
      const accountIds = accounts
        .filter((account) => account.role !== 'root')
        .map((account) => account.id)
      if (shouldRefreshAll(event)) {
        await dashboardStatsRepository.refreshAllStats()
      }
      return await dashboardStatsRepository.getOverviewStatistics(accountIds)
    })

    handlers.registerGetDashboardStatsClosingReasonDistributionStats(
      async (ctx, request) => {
        const client = await getMongoDbClient()
        const { entity } = request
        const dashboardStatsRepository = new DashboardStatsRepository(
          ctx.tenantId,
          { mongoDb: client }
        )
        if (shouldRefreshAll(event)) {
          await dashboardStatsRepository.refreshAllStats()
        }
        return await dashboardStatsRepository.getClosingReasonDistributionStatistics(
          entity
        )
      }
    )
    handlers.registerGetDashboardStatsAlertPriorityDistributionStats(
      async (ctx) => {
        const client = await getMongoDbClient()
        const dashboardStatsRepository = new DashboardStatsRepository(
          ctx.tenantId,
          { mongoDb: client }
        )
        if (shouldRefreshAll(event)) {
          await dashboardStatsRepository.refreshAllStats()
        }
        return await dashboardStatsRepository.getAlertPriorityDistributionStatistics()
      }
    )
    return await handlers.handle(event)
  }
)
