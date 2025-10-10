#!/usr/bin/env ts-node

import fs from 'fs'
import {
  CloudWatchPaginatedQueryUtil,
  CloudWatchQueryConfig,
  LogRecord,
  parseTimeString,
} from './cloudwatch-paginated-query-util'

interface RequestData {
  requestId: string
  duration?: number
  tenantId?: string
  timestamp: string
}

interface TenantDurationStats {
  tenantId: string
  count: number
  durations: number[]
  p50: number
  p95: number
  p99: number
  min: number
  max: number
  avg: number
}

class DurationAnalysisRunner {
  private queryUtil: CloudWatchPaginatedQueryUtil

  constructor(profile: string, region?: string) {
    this.queryUtil = new CloudWatchPaginatedQueryUtil(profile, region)
  }

  /**
   * Calculate percentiles from an array of numbers
   */
  private calculatePercentiles(values: number[]): {
    p50: number
    p95: number
    p99: number
    min: number
    max: number
    avg: number
  } {
    if (values.length === 0) {
      return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 }
    }

    const sorted = [...values].sort((a, b) => a - b)
    const len = sorted.length

    const getPercentile = (p: number) => {
      const index = Math.ceil((p / 100) * len) - 1
      return sorted[Math.max(0, index)]
    }

    return {
      p50: getPercentile(50),
      p95: getPercentile(95),
      p99: getPercentile(99),
      min: sorted[0],
      max: sorted[len - 1],
      avg:
        Math.round((values.reduce((sum, val) => sum + val, 0) / len) * 100) /
        100,
    }
  }

  /**
   * Process CloudWatch records to match durations with tenant IDs
   */
  private processRecords(records: LogRecord[]): Map<string, RequestData> {
    const requestMap = new Map<string, RequestData>()

    for (const record of records) {
      const timestamp = record['@timestamp']
      const duration = record['@duration']
        ? parseFloat(record['@duration'])
        : undefined
      const cloudwatchRequestId = record['@requestId'] // From REPORT lines
      const logRequestId = record['requestId'] // From application logs
      const tenantId = record['tenantId']

      // Determine the actual request ID
      const requestId = cloudwatchRequestId || logRequestId

      if (!requestId) {
        continue
      }

      // Get existing data or create new
      let requestData = requestMap.get(requestId)
      if (!requestData) {
        requestData = {
          requestId,
          timestamp: timestamp || '',
        }
        requestMap.set(requestId, requestData)
      }

      // Update with duration if available
      if (duration !== undefined && !isNaN(duration)) {
        requestData.duration = duration
      }

      // Update with tenant ID if available
      if (tenantId) {
        requestData.tenantId = tenantId
      }
    }

    return requestMap
  }

  /**
   * Group requests by tenant and calculate stats
   */
  private calculateTenantStats(
    requestMap: Map<string, RequestData>
  ): TenantDurationStats[] {
    const tenantGroups = new Map<string, number[]>()

    // Group durations by tenant
    for (const requestData of requestMap.values()) {
      if (requestData.tenantId && requestData.duration !== undefined) {
        if (!tenantGroups.has(requestData.tenantId)) {
          tenantGroups.set(requestData.tenantId, [])
        }
        tenantGroups.get(requestData.tenantId)?.push(requestData.duration)
      }
    }

    // Calculate stats for each tenant
    const tenantStats: TenantDurationStats[] = []
    for (const [tenantId, durations] of tenantGroups.entries()) {
      const stats = this.calculatePercentiles(durations)
      tenantStats.push({
        tenantId,
        count: durations.length,
        durations,
        ...stats,
      })
    }

    // Sort by count (most requests first)
    return tenantStats.sort((a, b) => b.count - a.count)
  }

  /**
   * Run the complete analysis
   */
  async runAnalysis(
    logGroupNames: string[],
    startTime: string,
    endTime: string,
    targetTenantId?: string
  ): Promise<TenantDurationStats[]> {
    console.log('=== DURATION ANALYSIS RUNNER ===')
    console.log(`Target tenant: ${targetTenantId || 'ALL TENANTS'}`)

    const query = `
      fields @timestamp, @duration, @requestId, requestId, tenantId
      | filter @message like /REPORT RequestId/ or @message like /Verifying transaction/
      | sort @timestamp asc
    `.trim()

    const config: CloudWatchQueryConfig = {
      logGroupNames,
      queryString: query,
      startTime: parseTimeString(startTime),
      endTime: parseTimeString(endTime),
    }

    console.log('\n--- Step 1: Fetching CloudWatch data ---')
    const result = await this.queryUtil.executeQueryWithPagination(config)

    if (result.records.length === 0) {
      console.log('No records found')
      return []
    }

    console.log(`\n--- Step 2: Processing ${result.records.length} records ---`)
    const requestMap = this.processRecords(result.records)
    console.log(`Found ${requestMap.size} unique request IDs`)

    // Count requests with both duration and tenant ID
    const completeRequests = Array.from(requestMap.values()).filter(
      (req) => req.duration !== undefined && req.tenantId
    )
    console.log(
      `Found ${completeRequests.length} requests with both duration and tenant ID`
    )

    console.log('\n--- Step 3: Calculating tenant statistics ---')
    let tenantStats = this.calculateTenantStats(requestMap)

    // Filter by target tenant if specified
    if (targetTenantId) {
      tenantStats = tenantStats.filter(
        (stat) => stat.tenantId === targetTenantId
      )
    }

    // Export raw and processed data
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

    console.log('\n--- Step 4: Exporting data files ---')
    this.exportRawDataToCsv(
      result.records,
      `raw-cloudwatch-data-${timestamp}.csv`
    )
    this.exportTenantDataToCsv(
      requestMap,
      targetTenantId,
      `processed-tenant-data-${timestamp}.csv`
    )

    return tenantStats
  }

  /**
   * Export raw CloudWatch data to CSV
   */
  exportRawDataToCsv(records: LogRecord[], filename: string): void {
    if (records.length === 0) {
      console.log('No raw data to export')
      return
    }

    // Get all unique field names
    const fieldNames = new Set<string>()
    records.forEach((record) => {
      Object.keys(record).forEach((key) => fieldNames.add(key))
    })

    const fields = Array.from(fieldNames).sort()

    // Create CSV content
    const csvRows = [
      fields.join(','), // Header row
      ...records.map((record) =>
        fields
          .map((field) => {
            const value = record[field]
            if (value === undefined || value === null) {
              return ''
            }
            // Escape commas and quotes in CSV
            const stringValue = String(value)
            if (
              stringValue.includes(',') ||
              stringValue.includes('"') ||
              stringValue.includes('\n')
            ) {
              return `"${stringValue.replace(/"/g, '""')}"`
            }
            return stringValue
          })
          .join(',')
      ),
    ]

    fs.writeFileSync(filename, csvRows.join('\n'))
    console.log(`Raw CloudWatch data exported to: ${filename}`)
  }

  /**
   * Export processed tenant data to CSV
   */
  exportTenantDataToCsv(
    requestMap: Map<string, RequestData>,
    targetTenantId: string | undefined,
    filename: string
  ): void {
    const data = Array.from(requestMap.values()).filter(
      (req) =>
        req.duration !== undefined &&
        req.tenantId &&
        (!targetTenantId || req.tenantId === targetTenantId)
    )

    if (data.length === 0) {
      console.log('No tenant data to export')
      return
    }

    const csvRows = [
      'requestId,tenantId,duration,timestamp', // Header
      ...data.map(
        (req) =>
          `${req.requestId},${req.tenantId},${req.duration},${req.timestamp}`
      ),
    ]

    fs.writeFileSync(filename, csvRows.join('\n'))
    console.log(`Processed tenant data exported to: ${filename}`)
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2)

  if (args.length < 4) {
    console.error(
      'Usage: ts-node duration-analysis-runner.ts <profile> <logGroupNames> <startTime> <endTime> [targetTenantId] [region]'
    )
    console.error('')
    console.error('Parameters:')
    console.error('  profile: AWS profile name')
    console.error('  logGroupNames: Comma-separated list of log group names')
    console.error('  startTime: Start time (YYYY-MM-DD HH:mm:ss or ISO format)')
    console.error('  endTime: End time (YYYY-MM-DD HH:mm:ss or ISO format)')
    console.error('  targetTenantId: Optional - analyze only this tenant')
    console.error('  region: Optional - AWS region (defaults to eu-central-1)')
    console.error('')
    console.error('Example:')
    console.error('  ts-node duration-analysis-runner.ts \\')
    console.error('    "AWSAdministratorAccess-<account-id>" \\')
    console.error('    "/aws/lambda/<lambda-function-name>" \\')
    console.error('    "2025-08-20 11:00:00" \\')
    console.error('    "2025-08-20 12:00:00" \\')
    console.error('    "<tenant-id> (optional)" \\')
    console.error('    "<region> (optional, defaults to eu-central-1)"')
    process.exit(1)
  }

  const [
    profile,
    logGroupNamesStr,
    startTime,
    endTime,
    targetTenantId,
    region,
  ] = args

  try {
    const logGroupNames = logGroupNamesStr.split(',').map((name) => name.trim())

    const runner = new DurationAnalysisRunner(profile, region)
    const tenantStats = await runner.runAnalysis(
      logGroupNames,
      startTime,
      endTime,
      targetTenantId
    )

    if (tenantStats.length === 0) {
      console.log('\n No tenant duration data found')
      return
    }

    console.log('\n  === RESULTS ===')

    tenantStats.forEach((stat, index) => {
      console.log(`\n${index + 1}. Tenant: ${stat.tenantId}`)
      console.log(`   Requests: ${stat.count}`)
      console.log(`   Min: ${stat.min}ms`)
      console.log(`   Max: ${stat.max}ms`)
      console.log(`   Avg: ${stat.avg}ms`)
      console.log(`   P50: ${stat.p50}ms`)
      console.log(`   P95: ${stat.p95}ms`)
      console.log(`   P99: ${stat.p99}ms`)
    })

    // Export summary to CSV
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const csvFilename = `duration-analysis-${timestamp}.csv`

    const csvContent = [
      'tenantId,count,min,max,avg,p50,p95,p99',
      ...tenantStats.map(
        (stat) =>
          `${stat.tenantId},${stat.count},${stat.min},${stat.max},${stat.avg},${stat.p50},${stat.p95},${stat.p99}`
      ),
    ].join('\n')

    fs.writeFileSync(csvFilename, csvContent)
    console.log(`\n Summary exported to: ${csvFilename}`)

    if (targetTenantId && tenantStats.length > 0) {
      console.log(`\n Analysis for tenant ${targetTenantId}:`)
      const targetStats = tenantStats[0]
      console.log(`    ${targetStats.count} requests analyzed`)
      console.log(`    P50 (median): ${targetStats.p50}ms`)
      console.log(`    P95: ${targetStats.p95}ms`)
      console.log(`    P99: ${targetStats.p99}ms`)
    }
  } catch (error) {
    console.error('Error during analysis:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { DurationAnalysisRunner, TenantDurationStats }
