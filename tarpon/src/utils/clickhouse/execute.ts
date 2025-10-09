import { NodeClickHouseClient as ClickHouseClient } from '@clickhouse/client/dist/client'
import { envIs } from '../env'
import {
  getClickhouseClient,
  getClickhouseClientConfig,
  getLocalConfig,
  createAndExecuteWithClient,
} from './client'
import { addNewSubsegment } from '@/core/xray'
import { logger } from '@/core/logger'

/**
 * Safely executes a Clickhouse query with error handling
 * @param clientOrTenantId Either a Clickhouse client instance or tenant ID string
 * @param queryOrParams Query string or query parameters object
 * @param options Optional configuration
 * @returns Query result or null on error (if throwOnError is false)
 */

export async function executeClickhouseQuery<T extends object>(
  clientOrTenantId: ClickHouseClient | string,
  queryOrParams: string | Parameters<ClickHouseClient['query']>[0],
  params: Record<string, any> = {},
  options: { throwOnError?: boolean; logError?: boolean } = {
    throwOnError: false,
    logError: true,
  }
): Promise<T> {
  const [segment, segment2] = await Promise.all([
    addNewSubsegment('Query time for clickhouse', 'Query'),
    addNewSubsegment('Query time for clickhouse', 'Overall'),
  ])
  const start = Date.now()
  let client: ClickHouseClient
  let queryParams: Parameters<ClickHouseClient['query']>[0]
  if (typeof queryOrParams === 'string') {
    let formattedQuery = queryOrParams
    for (const [key, value] of Object.entries(params)) {
      formattedQuery = formattedQuery.replace(
        new RegExp(`{{ ${key} }}`, 'g'),
        value
      )
    }
    queryParams = {
      query: `${formattedQuery} SETTINGS output_format_json_quote_64bit_integers=0`,
      format: 'JSONEachRow',
    }
  } else {
    queryParams = queryOrParams
  }

  try {
    if (typeof clientOrTenantId === 'string') {
      client = await getClickhouseClient(clientOrTenantId)
    } else {
      client = clientOrTenantId
    }
    logger.info('Running clickhouse query', { query: queryParams.query })

    const result = await client.query(queryParams)
    const end = Date.now()

    const clickHouseSummary = result.response_headers['x-clickhouse-summary']
      ? JSON.parse(result.response_headers['x-clickhouse-summary'] as string)
      : {}

    const clickhouseQueryExecutionTime = clickHouseSummary['elapsed_ns']
      ? clickHouseSummary['elapsed_ns'] / 1000000
      : 0

    const queryTimeData = {
      ...clickHouseSummary,
      networkLatency: `${end - start - clickhouseQueryExecutionTime}ms`,
      clickhouseQueryExecutionTime: `${clickhouseQueryExecutionTime}ms`,
      totalLatency: `${end - start}ms`,
    }

    logger.info('Query time data', queryTimeData)
    segment?.addMetadata('Query time data', queryTimeData)
    segment?.close()
    const jsonResult = await result.json()
    const end2 = Date.now()

    const overallStats = {
      ...clickHouseSummary,
      overallTime: `${end2 - start}ms`,
      networkLatency: `${end - start - clickhouseQueryExecutionTime}ms`,
      systemLatency: `${end2 - end}ms`,
      clickhouseQueryExecutionTime: `${clickhouseQueryExecutionTime}ms`,
    }

    segment2?.addMetadata('Overall stats', overallStats)
    segment2?.close()

    logger.info('Overall stats', overallStats)

    return jsonResult as T
  } catch (error) {
    if (options.logError) {
      logger.error('Error executing Clickhouse query', {
        query: queryParams.query,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        executionTime: `${Date.now() - start}ms`,
      })
    }

    if (envIs('local')) {
      throw error
    }

    if (options.throwOnError) {
      throw error
    } else {
      throw new Error('Failed to fetch data')
    }
  } finally {
    segment?.close()
    segment2?.close()
  }
}
export const executeClickhouseDefaultClientQuery = async <T>(
  callback: (client: ClickHouseClient) => Promise<T>
) => {
  if (envIs('local') || envIs('test')) {
    return createAndExecuteWithClient(getLocalConfig('default'), callback)
  }

  const config = await getClickhouseClientConfig('default')
  return createAndExecuteWithClient(config, callback)
}
