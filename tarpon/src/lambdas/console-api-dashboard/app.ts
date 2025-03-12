import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest } from 'http-errors'
import { DashboardStatsRepository } from '../../services/dashboard/repositories/dashboard-stats-repository'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { assertCurrentUserRole, JWTAuthorizerResult } from '@/@types/jwt'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { AccountsService } from '@/services/accounts'
import { Account } from '@/@types/openapi-internal/Account'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { DashboardStatsTransactionsCountItem } from '@/@types/openapi-internal/DashboardStatsTransactionsCountItem'
import dayjs from '@/utils/dayjs'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'

let localRefreshedAll = false

export function shouldRefreshAll(
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
  >
): boolean {
  if (process.env.ENV === 'local') {
    if (localRefreshedAll) {
      return false
    } else {
      localRefreshedAll = true
      return true
    }
  }
  if (event.queryStringParameters?.forceRefresh) {
    assertCurrentUserRole('root')
    return true
  }
  return false
}

function formatTimestamp(
  startTimestamp = dayjs().subtract(10, 'year').valueOf(),
  endTimestamp = dayjs().endOf('day').valueOf()
) {
  return { start: startTimestamp, end: endTimestamp }
}

export const dashboardStatsHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const handlers = new Handlers()
    const mongoDb = await getMongoDbClient()
    const tenantId = event.requestContext.authorizer.principalId
    const auth0Domain = event.requestContext.authorizer.auth0Domain
    const dynamoDb = getDynamoDbClientByEvent(event)

    const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
      mongoDb,
      dynamoDb,
    })

    handlers.registerGetDashboardStatsTransactions(async (ctx, request) => {
      const { startTimestamp, endTimestamp, granularity } = request
      const { start, end } = formatTimestamp(startTimestamp, endTimestamp)
      if (shouldRefreshAll(event)) {
        await dashboardStatsRepository.refreshAllStats()
      }
      const data = await dashboardStatsRepository.getTransactionCountStats(
        start,
        end,
        granularity,
        'DATE_RANGE'
      )
      return { data }
    })

    handlers.registerGetDashboardStatsTransactionsTotal(
      async (ctx, request) => {
        const { startTimestamp, endTimestamp } = request

        const { start, end } = formatTimestamp(startTimestamp, endTimestamp)

        if (shouldRefreshAll(event)) {
          await dashboardStatsRepository.refreshAllStats()
        }
        const data = await dashboardStatsRepository.getTransactionCountStats(
          start,
          end,
          'DAY',
          'TOTAL'
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
        return { data: { time: 'TOTAL', ...result } }
      }
    )

    handlers.registerGetDashboardStatsHitsPerUser(async (ctx, request) => {
      const { startTimestamp, endTimestamp, direction, userType } = request
      const { start, end } = formatTimestamp(startTimestamp, endTimestamp)
      if (shouldRefreshAll(event)) {
        await dashboardStatsRepository.refreshUserStats()
      }
      return {
        data: await dashboardStatsRepository.getHitsByUserStats(
          start,
          end,
          direction,
          userType
        ),
      }
    })

    handlers.registerGetDashboardStatsRuleHit(async (ctx, request) => {
      const { startTimestamp, endTimestamp, pageSize, page } = request

      if (shouldRefreshAll(event)) {
        await dashboardStatsRepository.refreshAlertsStats()
      }

      const { start, end } = formatTimestamp(startTimestamp, endTimestamp)
      return await dashboardStatsRepository.getRuleHitCountStats(
        start,
        end,
        pageSize,
        page
      )
    })

    handlers.registerGetDashboardStatsUsersByTime(async (ctx, request) => {
      const { userType, startTimestamp, endTimestamp, granularity } = request

      const { start, end } = formatTimestamp(startTimestamp, endTimestamp)

      if (shouldRefreshAll(event)) {
        await dashboardStatsRepository.refreshUserStats()
      }
      const data = await dashboardStatsRepository.getUserTimewindowStats(
        userType,
        start,
        end,
        granularity ?? 'MONTH'
      )
      return data
    })

    handlers.registerGetDashboardTeamStats(async (ctx, request) => {
      const {
        scope,
        startTimestamp,
        endTimestamp,
        caseStatus,
        pageSize,
        page,
      } = request
      const { userId } = ctx
      const dynamoDb = getDynamoDbClientByEvent(event)
      const accountsService = new AccountsService(
        { auth0Domain, useCache: true },
        { dynamoDb }
      )
      const organization = await accountsService.getAccountTenant(userId)
      const accounts: Account[] = await accountsService.getTenantAccounts(
        organization
      )
      const accountIds = accounts
        .filter((account) => account.role !== 'root')
        .map((account) => account.id)

      const { start, end } = formatTimestamp(startTimestamp, endTimestamp)
      return await dashboardStatsRepository.getTeamStatistics(
        scope,
        start,
        end,
        caseStatus,
        accountIds,
        pageSize,
        page
      )
    })

    handlers.registerGetDashboardStatsOverview(async (ctx) => {
      const accountsService = new AccountsService(
        { auth0Domain, useCache: true },
        { dynamoDb: getDynamoDbClientByEvent(event) }
      )
      const organization = await accountsService.getAccountTenant(ctx.userId)
      const accounts: Account[] = await accountsService.getTenantAccounts(
        organization
      )
      const accountIds = accounts
        .filter((account) => account.role !== 'root')
        .map((account) => account.id)

      if (shouldRefreshAll(event)) {
        await dashboardStatsRepository.refreshTeamStats(
          getDynamoDbClientByEvent(event)
        )
      }
      return await dashboardStatsRepository.getOverviewStatistics(accountIds)
    })

    handlers.registerGetDashboardStatsClosingReasonDistributionStats(
      async (ctx, request) => {
        const { entity, startTimestamp, endTimestamp } = request
        if (shouldRefreshAll(event)) {
          await dashboardStatsRepository.refreshAllStats()
        }
        return await dashboardStatsRepository.getClosingReasonDistributionStatistics(
          entity,
          { startTimestamp, endTimestamp }
        )
      }
    )

    handlers.registerGetDashboardStatsAlertPriorityDistributionStats(
      async (ctx, request) => {
        const { startTimestamp, endTimestamp } = request
        if (shouldRefreshAll(event)) {
          await dashboardStatsRepository.refreshAllStats()
        }
        return await dashboardStatsRepository.getAlertPriorityDistributionStatistics(
          { startTimestamp, endTimestamp }
        )
      }
    )

    handlers.registerGetDashboardStatsAlertAndCaseStatusDistributionStats(
      async (ctx, request) => {
        const {
          startTimestamp,
          endTimestamp,
          entity,
          granularity,
          ruleInstanceIds,
        } = request

        const { start, end } = formatTimestamp(startTimestamp, endTimestamp)
        return await dashboardStatsRepository.getAlertAndCaseStatusDistributionStatistics(
          start,
          end,
          granularity,
          entity,
          ruleInstanceIds
        )
      }
    )

    handlers.registerGetDashboardLatestTeamStats(async (ctx, request) => {
      const { scope, pageSize, page } = request
      const { userId } = ctx
      const accountsService = new AccountsService(
        { auth0Domain, useCache: true },
        { dynamoDb: getDynamoDbClientByEvent(event) }
      )
      const organization = await accountsService.getAccountTenant(userId)
      const accounts: Account[] = await accountsService.getTenantAccounts(
        organization
      )
      if (shouldRefreshAll(event)) {
        await dashboardStatsRepository.refreshLatestTeamStats()
      }
      const accountIds = accounts
        .filter((account) => account.role !== 'root')
        .map((account) => account.id)

      return await dashboardStatsRepository.getLatestTeamStatistics(
        scope,
        accountIds,
        pageSize,
        page
      )
    })

    handlers.registerGetDashboardStatsQaAlertsByRuleHit(
      async (ctx, request) => {
        const { startTimestamp, endTimestamp } = request
        if (shouldRefreshAll(event)) {
          await dashboardStatsRepository.refreshQaStats()
        }

        const { start, end } = formatTimestamp(startTimestamp, endTimestamp)
        const data = await dashboardStatsRepository.getQaAlertsByRuleHitStats(
          start,
          end
        )
        return { data }
      }
    )

    handlers.registerGetDashboardStatsQaAlertsStatsByChecklistReason(
      async (ctx, request) => {
        const {
          startTimestamp,
          endTimestamp,
          checklistCategory,
          checklistTemplateId,
        } = request
        if (shouldRefreshAll(event)) {
          await dashboardStatsRepository.refreshQaStats()
        }

        const { start, end } = formatTimestamp(startTimestamp, endTimestamp)
        if (!checklistCategory || !checklistTemplateId) {
          throw new BadRequest(
            `Wrong checklist category or template id: ${checklistCategory}, ${checklistTemplateId}`
          )
        }
        const data =
          await dashboardStatsRepository.getQaAlertsStatsByChecklistReason(
            start,
            end,
            checklistTemplateId,
            checklistCategory
          )
        return { data }
      }
    )

    handlers.registerGetDashboardStatsQaOverview(async (ctx, request) => {
      const { startTimestamp, endTimestamp } = request
      if (shouldRefreshAll(event)) {
        await dashboardStatsRepository.refreshQaStats()
      }

      const { start, end } = formatTimestamp(startTimestamp, endTimestamp)
      const data = await dashboardStatsRepository.getQaOverviewStats(start, end)
      return data
    })

    handlers.registerGetDashboardStatsQaAlertsByAssignee(
      async (ctx, request) => {
        const { startTimestamp, endTimestamp } = request
        if (shouldRefreshAll(event)) {
          await dashboardStatsRepository.refreshQaStats()
        }

        const { start, end } = formatTimestamp(startTimestamp, endTimestamp)
        const data = await dashboardStatsRepository.getQaAlertsByAssigneeStats(
          start,
          end
        )
        return { data }
      }
    )

    handlers.registerGetDashboardTeamSlaStats(async (ctx, request) => {
      const { startTimestamp, endTimestamp, pageSize, page } = request
      if (shouldRefreshAll(event)) {
        await dashboardStatsRepository.refreshSLATeamStats()
      }

      const { start, end } = formatTimestamp(startTimestamp, endTimestamp)
      return await dashboardStatsRepository.getSLATeamStatistics(
        start,
        end,
        pageSize,
        page
      )
    })
    return await handlers.handle(event)
  }
)
