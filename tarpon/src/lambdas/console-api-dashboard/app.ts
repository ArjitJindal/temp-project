import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest } from 'http-errors'
import {
  DashboardStatsRepository,
  GranularityValuesType,
} from './repositories/dashboard-stats-repository'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { assertRole, JWTAuthorizerResult } from '@/@types/jwt'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { AlertStatus } from '@/@types/openapi-internal/AlertStatus'
import { parseStrings } from '@/utils/lambda'
import { AccountsService } from '@/services/accounts'
import { Account } from '@/@types/openapi-internal/Account'

function shouldRefreshAll(
  event: APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
  >
): boolean {
  const { role, verifiedEmail } = event.requestContext.authorizer
  if (process.env.ENV === 'local') {
    return true
  }
  if (event.queryStringParameters?.forceRefresh) {
    assertRole({ role, verifiedEmail }, 'root')
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
    if (
      event.httpMethod === 'GET' &&
      event.path.endsWith('/dashboard_stats/transactions')
    ) {
      const client = await getMongoDbClient()
      const { principalId: tenantId } = event.requestContext.authorizer
      const { startTimestamp, endTimestamp, granularity } =
        event.queryStringParameters as {
          startTimestamp?: string
          endTimestamp?: string
          granularity?: GranularityValuesType
        }
      const endTimestampNumber = endTimestamp
        ? parseInt(endTimestamp)
        : Number.NaN
      if (Number.isNaN(endTimestampNumber)) {
        throw new BadRequest(`Wrong timestamp format: ${endTimestamp}`)
      }
      const startTimestampNumber = startTimestamp
        ? parseInt(startTimestamp)
        : Number.NaN
      if (Number.isNaN(startTimestampNumber)) {
        throw new BadRequest(`Wrong timestamp format: ${startTimestamp}`)
      }
      const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
        mongoDb: client,
      })
      if (shouldRefreshAll(event)) {
        await dashboardStatsRepository.refreshAllStats()
      }

      const data = await dashboardStatsRepository.getTransactionCountStats(
        startTimestampNumber,
        endTimestampNumber,
        granularity
      )
      return {
        data,
      }
    } else if (
      event.httpMethod === 'GET' &&
      event.path.endsWith('/dashboard_stats/hits_per_user')
    ) {
      const client = await getMongoDbClient()
      const { principalId: tenantId } = event.requestContext.authorizer
      const { startTimestamp, endTimestamp, direction } =
        event.queryStringParameters as {
          startTimestamp?: string
          endTimestamp?: string
          direction: 'ORIGIN' | 'DESTINATION'
        }
      const endTimestampNumber = endTimestamp
        ? parseInt(endTimestamp)
        : Number.NaN
      if (Number.isNaN(endTimestampNumber)) {
        throw new BadRequest(`Wrong timestamp format: ${endTimestamp}`)
      }
      const startTimestampNumber = startTimestamp
        ? parseInt(startTimestamp)
        : Number.NaN
      if (Number.isNaN(startTimestampNumber)) {
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
          startTimestampNumber,
          endTimestampNumber,
          direction
        ),
      }
    } else if (
      event.httpMethod === 'GET' &&
      event.path.endsWith('/dashboard_stats/rule_hit')
    ) {
      const client = await getMongoDbClient()
      const { principalId: tenantId } = event.requestContext.authorizer
      const { startTimestamp, endTimestamp } = event.queryStringParameters as {
        startTimestamp?: string
        endTimestamp?: string
      }
      const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
        mongoDb: client,
      })
      if (shouldRefreshAll(event)) {
        await dashboardStatsRepository.refreshAllStats()
      }

      const endTimestampNumber = endTimestamp
        ? parseInt(endTimestamp)
        : Number.NaN
      if (Number.isNaN(endTimestampNumber)) {
        throw new BadRequest(`Wrong timestamp format: ${endTimestamp}`)
      }
      const startTimestampNumber = startTimestamp
        ? parseInt(startTimestamp)
        : Number.NaN
      if (Number.isNaN(startTimestampNumber)) {
        throw new BadRequest(`Wrong timestamp format: ${startTimestamp}`)
      }

      return {
        data: await dashboardStatsRepository.getRuleHitCountStats(
          startTimestampNumber,
          endTimestampNumber
        ),
      }
    } else if (
      event.httpMethod === 'GET' &&
      event.path.endsWith('/dashboard_stats/drs-distribution')
    ) {
      const client = await getMongoDbClient()
      const { principalId: tenantId } = event.requestContext.authorizer

      const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
        mongoDb: client,
      })
      if (shouldRefreshAll(event)) {
        await dashboardStatsRepository.refreshAllStats()
      }

      const data = await dashboardStatsRepository.getDRSDistributionStats()
      return {
        data,
      }
    } else if (
      event.httpMethod === 'GET' &&
      event.path.endsWith('/dashboard_stats/team')
    ) {
      const client = await getMongoDbClient()
      const {
        principalId: tenantId,
        userId,
        auth0Domain,
      } = event.requestContext.authorizer
      const queryStringParameters = event.queryStringParameters as {
        scope: 'CASES' | 'ALERTS'
        startTimestamp: string
        endTimestamp: string
        caseStatus?: string
      }
      const mongoDb = await getMongoDbClient()
      const accountsService = new AccountsService({ auth0Domain }, { mongoDb })
      const organization = await accountsService.getAccountTenant(userId)
      const accounts: Account[] = await accountsService.getTenantAccounts(
        organization
      )
      const accountIds = accounts
        .filter((account) => account.role !== 'root')
        .map((account) => account.id)
      const { scope, startTimestamp, endTimestamp, caseStatus } =
        queryStringParameters
      const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
        mongoDb: client,
      })
      if (shouldRefreshAll(event)) {
        await dashboardStatsRepository.refreshAllStats()
      }
      return dashboardStatsRepository.getTeamStatistics(
        scope,
        startTimestamp ? parseInt(startTimestamp) : 0,
        endTimestamp ? parseInt(endTimestamp) : Number.MAX_SAFE_INTEGER,
        parseStrings<CaseStatus | AlertStatus>(caseStatus),
        accountIds
      )
    }
    throw new BadRequest('Unsupported path')
  }
)
