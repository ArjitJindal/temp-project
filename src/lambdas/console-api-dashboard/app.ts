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
import { JWTAuthorizerResult } from '@/@types/jwt'
import { getMongoDbClient } from '@/utils/mongoDBUtils'

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
      if (process.env.ENV === 'local') {
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
      if (process.env.ENV === 'local') {
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
      if (process.env.ENV === 'local') {
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
      if (process.env.ENV === 'local') {
        await dashboardStatsRepository.refreshAllStats()
      }

      const data = await dashboardStatsRepository.getDRSDistributionStats()
      return {
        data,
      }
    }
    throw new BadRequest('Unsupported path')
  }
)
