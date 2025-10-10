#!/usr/bin/env ts-node

import fs from 'fs'
import {
  CloudWatchLogsClient,
  StartQueryCommand,
  GetQueryResultsCommand,
  ResultField,
} from '@aws-sdk/client-cloudwatch-logs'
import { fromIni } from '@aws-sdk/credential-providers'

export interface CloudWatchQueryConfig {
  logGroupNames: string[]
  queryString: string
  startTime: Date
  endTime: Date
  region?: string
  profile?: string
  maxRecordsPerQuery?: number
}

export interface LogRecord {
  [key: string]: any
}

export interface PaginationResult {
  records: LogRecord[]
  totalQueriesExecuted: number
  totalRecordsRetrieved: number
}

export class CloudWatchPaginatedQueryUtil {
  private client: CloudWatchLogsClient

  constructor(profile: string, region?: string) {
    this.client = new CloudWatchLogsClient({
      region: region || process.env.AWS_REGION || 'eu-central-1',
      credentials: fromIni({ profile }),
    })
  }

  /**
   * Execute a single CloudWatch Logs Insights query
   */
  private async executeSingleQuery(
    config: CloudWatchQueryConfig
  ): Promise<LogRecord[]> {
    const startQueryCommand = new StartQueryCommand({
      logGroupNames: config.logGroupNames,
      queryString: config.queryString,
      startTime: Math.floor(config.startTime.getTime() / 1000),
      endTime: Math.floor(config.endTime.getTime() / 1000),
      limit: config.maxRecordsPerQuery || 10000,
    })

    const startQueryResponse = await this.client.send(startQueryCommand)
    const queryId = startQueryResponse.queryId

    if (!queryId) {
      throw new Error('No query ID returned from CloudWatch')
    }

    // Poll for query completion
    let queryStatus: string = 'Running'

    while (queryStatus === 'Running' || queryStatus === 'Scheduled') {
      await this.sleep(2000)

      const getResultsCommand = new GetQueryResultsCommand({
        queryId,
      })

      const resultsResponse = await this.client.send(getResultsCommand)
      queryStatus = resultsResponse.status || 'Unknown'

      if (queryStatus === 'Complete') {
        return resultsResponse.results
          ? this.parseResults(resultsResponse.results)
          : []
      }
    }

    if (queryStatus === 'Failed') {
      throw new Error('CloudWatch Logs Insights query failed')
    }

    if (queryStatus === 'Cancelled') {
      throw new Error('CloudWatch Logs Insights query was cancelled')
    }

    return []
  }

  /**
   * Parse CloudWatch Logs Insights results into JSON objects
   */
  private parseResults(results: ResultField[][]): LogRecord[] {
    return results.map((result) => {
      const record: LogRecord = {}

      result.forEach((field) => {
        if (field.field && field.value !== undefined) {
          if (field.field === '@message' && field.value.startsWith('{')) {
            try {
              record[field.field] = JSON.parse(field.value)
            } catch {
              record[field.field] = field.value
            }
          } else {
            record[field.field] = field.value
          }
        }
      })

      return record
    })
  }

  /**
   * Find the latest timestamp in a set of log records that's within the specified range
   */
  private findLatestTimestamp(
    records: LogRecord[],
    maxTime: Date
  ): Date | null {
    if (records.length === 0) {
      return null
    }

    let latestTimestamp: Date | null = null

    for (const record of records) {
      const timestampStr = record['@timestamp']
      console.log('timestampStr', timestampStr)
      if (timestampStr) {
        const timestamp = new Date(timestampStr.replace(' ', 'T') + 'Z')
        console.log('timestamp', timestamp)
        if (!isNaN(timestamp.getTime()) && timestamp <= maxTime) {
          if (!latestTimestamp || timestamp > latestTimestamp) {
            latestTimestamp = timestamp
          }
        }
      }
    }
    console.log('latestTimestamp', latestTimestamp)
    return latestTimestamp
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Execute a CloudWatch Logs query with automatic data-driven pagination
   * This is the main utility function that handles large datasets
   */
  async executeQueryWithPagination(
    config: CloudWatchQueryConfig
  ): Promise<PaginationResult> {
    console.log('=== CLOUDWATCH PAGINATED QUERY ===')
    console.log(`Log Groups: ${config.logGroupNames.join(', ')}`)
    console.log(
      `Time Range: ${config.startTime.toISOString()} to ${config.endTime.toISOString()}`
    )
    console.log(`Query: ${config.queryString}`)

    const maxRecordsPerQuery = Math.min(
      config.maxRecordsPerQuery || 10000,
      10000
    ) // AWS hard limit

    // Calculate time range duration
    const totalDurationMs =
      config.endTime.getTime() - config.startTime.getTime()
    const totalHours = totalDurationMs / (1000 * 60 * 60)

    console.log(`Total time range: ${totalHours.toFixed(2)} hours`)
    console.log(
      `Using data-driven pagination with max ${maxRecordsPerQuery} records per query`
    )
    console.log(
      `Will continue querying until all data is retrieved or end time is reached`
    )

    const allLogRecords: LogRecord[] = []
    let totalQueriesExecuted = 0
    let currentStartTime = new Date(config.startTime)
    let queryNumber = 1

    // Continue querying until we reach the end time or get no more results
    while (currentStartTime < config.endTime) {
      console.log(`\n--- Query ${queryNumber} ---`)
      console.log(
        `Time range: ${currentStartTime.toISOString()} to ${config.endTime.toISOString()}`
      )

      const queryConfig: CloudWatchQueryConfig = {
        ...config,
        startTime: currentStartTime,
        endTime: config.endTime,
        maxRecordsPerQuery: maxRecordsPerQuery,
      }

      try {
        const queryRecords = await this.executeSingleQuery(queryConfig)
        totalQueriesExecuted++

        console.log(
          `Query ${queryNumber}: Retrieved ${queryRecords.length} records`
        )

        if (queryRecords.length === 0) {
          console.log('No more records found. Stopping pagination.')
          break
        }

        allLogRecords.push(...queryRecords)
        console.log(`Total records so far: ${allLogRecords.length}`)

        // If we got fewer records than the maximum, we've reached the end
        if (queryRecords.length < maxRecordsPerQuery) {
          console.log(
            `Retrieved ${queryRecords.length} records (less than max ${maxRecordsPerQuery}). Reached end of data.`
          )
          break
        }

        // Find the latest timestamp in this batch to continue from (within our end time range)
        const latestTimestamp = this.findLatestTimestamp(
          queryRecords,
          config.endTime
        )
        if (!latestTimestamp) {
          console.log(
            'Could not find valid timestamp within range in results. Stopping pagination.'
          )
          break
        }

        console.log(
          `Latest timestamp in this batch: ${latestTimestamp.toISOString()}`
        )

        // Move start time to 1 millisecond after the latest timestamp to avoid duplicates
        const nextStartTime = new Date(latestTimestamp.getTime() + 1)

        // Ensure the next start time doesn't exceed our end time
        if (nextStartTime >= config.endTime) {
          console.log(
            'Next start time would exceed end time. Stopping pagination.'
          )
          break
        }

        currentStartTime = nextStartTime
        console.log(
          `Next query will start from: ${currentStartTime.toISOString()}`
        )

        // Additional safety check - ensure we're making progress
        if (currentStartTime <= new Date(config.startTime.getTime())) {
          console.log(
            'Error: Next start time is not after original start time. This should not happen.'
          )
          break
        }

        // Add a small delay between queries to be nice to AWS
        await this.sleep(1000)
        queryNumber++
      } catch (error) {
        console.error(`Error processing query ${queryNumber}:`, error)
        console.log('Stopping pagination due to error.')
        break
      }
    }

    console.log(`Completed all queries!`)
    console.log(`Total queries executed: ${totalQueriesExecuted}`)
    console.log(`Total records retrieved: ${allLogRecords.length}`)

    return {
      records: allLogRecords,
      totalQueriesExecuted,
      totalRecordsRetrieved: allLogRecords.length,
    }
  }

  /**
   * Execute a single query without pagination (for smaller datasets)
   */
  async executeSingleQueryOnly(
    config: CloudWatchQueryConfig
  ): Promise<PaginationResult> {
    console.log('=== CLOUDWATCH SINGLE QUERY ===')
    console.log(`Log Groups: ${config.logGroupNames.join(', ')}`)
    console.log(
      `Time Range: ${config.startTime.toISOString()} to ${config.endTime.toISOString()}`
    )
    console.log(`Query: ${config.queryString}`)

    try {
      const records = await this.executeSingleQuery(config)

      console.log(`Retrieved ${records.length} records`)

      return {
        records,
        totalQueriesExecuted: 1,
        totalRecordsRetrieved: records.length,
      }
    } catch (error) {
      console.error('Error executing query:', error)
      throw error
    }
  }
}

/**
 * Parse time string to Date object, treating it as UTC
 */
export function parseTimeString(timeStr: string): Date {
  if (
    timeStr.includes('Z') ||
    timeStr.includes('+') ||
    (timeStr.includes('T') && timeStr.length > 19)
  ) {
    const date = new Date(timeStr)
    if (!isNaN(date.getTime())) {
      return date
    }
  }

  // Handle common formats and treat them as UTC
  const formats = [
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, // YYYY-MM-DD HH:mm:ss
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/, // YYYY-MM-DDTHH:mm:ss
  ]

  for (const format of formats) {
    if (format.test(timeStr)) {
      // Explicitly parse as UTC by adding 'Z' suffix
      const utcTimeStr = timeStr.replace(' ', 'T') + 'Z'
      const date = new Date(utcTimeStr)
      if (!isNaN(date.getTime())) {
        console.log(`Parsed "${timeStr}" as UTC: ${date.toISOString()}`)
        return date
      }
    }
  }

  // Fallback to default parsing
  const date = new Date(timeStr)
  if (!isNaN(date.getTime())) {
    console.log(
      `Parsed "${timeStr}" with default parsing: ${date.toISOString()}`
    )
    return date
  }

  throw new Error(`Unable to parse time string: ${timeStr}`)
}

/**
 * Export utility function for JSON files
 */
export function exportToJson(records: LogRecord[], outputPath: string): void {
  const jsonContent = JSON.stringify(records, null, 2)
  fs.writeFileSync(outputPath, jsonContent)
  console.log(`Exported ${records.length} records to ${outputPath}`)
}
