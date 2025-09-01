#!/usr/bin/env ts-node

/**
 * Screening Alerts Closure Script
 *
 * This script closes "in review" screening alerts in two modes:
 *
 * 1. CSV-BASED CLOSURE: Close specific alerts with custom reasons from a CSV file
 * 2. RULE-BASED CLOSURE: Close alerts based on rule names and dates (existing functionality)
 *
 * PREREQUISITES FOR PRODUCTION/SANDBOX:
 * 1. AWS credentials configured (run 'npm run aws-login <env>' first)
 * 2. Load credentials into shell (source scripts/aws/load-credentials.sh <profile>)
 * 3. Environment variables set (ENV, AWS_REGION, etc.)
 * 4. Proper IAM permissions for Secrets Manager and DynamoDB
 *
 * Usage:
 *   # CSV-based closure (recommended for bulk operations)
 *   yarn close-screening-alerts <tenantId> --csv <path-to-csv>
 *   yarn close-screening-alerts:dry-run <tenantId> --csv <path-to-csv>
 *
 *   # Rule-based closure (existing functionality)
 *   yarn close-screening-alerts <tenantId>
 *   yarn close-screening-alerts:dry-run <tenantId>
 *
 * Example for CSV-based closure:
 *   1. npm run aws-login sandbox
 *   2. source scripts/aws/load-credentials.sh AWSAdministratorAccess-293986822825
 *   3. export ENV=sandbox
 *   4. export AWS_REGION=ap-south-1
 *   5. yarn close-screening-alerts:dry-run pnb --csv ~/Downloads/EODD_bulk_closure_pnb.csv
 *
 * IMPORTANT: You MUST run the 'source' command in the SAME shell session
 * where you run this script. The credentials are loaded into the shell
 * environment, not as process environment variables.
 */

import fs from 'fs'
import { Collection } from 'mongodb'
import { parse } from 'csv-parse'
import { initializeEnvVars, loadConfigEnv } from './migrations/utils/config'
import { AlertsService } from '@/services/alerts'
import { AlertsRepository } from '@/services/alerts/repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getS3Client } from '@/utils/s3'
import { logger } from '@/core/logger'
import { Case } from '@/@types/openapi-internal/Case'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'

loadConfigEnv()
initializeEnvVars()

// disable consumers
process.env.DISABLE_DYNAMO_CONSUMER = '1'
process.env.DISABLE_MONGO_CONSUMER = '1'
process.env.SCRIPT_MODE = '1'

// Target date: June 30, 2025 (for rule-based closure)
const TARGET_DATE = new Date('2025-06-30T23:59:59.999Z').getTime()

// Rule names to target (for rule-based closure)
const TARGET_RULE_NAMES = [
  'Adverse Media (Manual Review)',
  'Adverse Media (True Positive)',
  'PEP (Manual Review)',
  'PEP (True Positive Level 1)',
  'PEP (True Positive Level 2)',
  'Adverse Media (Manual Review) (end-to-end)',
  'Adverse Media (True Positive) (end-to-end)',
  'PEP (Manual Review) (end-to-end)',
  'PEP (True Positive Level 1) (end-to-end)',
  'PEP (True Positive Level 2) (end-to-end)',
  'Sanctions - Manual Review (end-to-end)',
  'Sanctions - True Positive (end-to-end)',
  'Sanctions (Manual Review) - MOHA (end-to-end)',
  'Sanctions (True Positive) - MOHA (end-to-end)',
]

// Default comment for rule-based closure
const DEFAULT_CLOSURE_COMMENT =
  'Case closed as no checker review is required, in accordance with the process flow'

// In review statuses
const IN_REVIEW_STATUSES = [
  'IN_REVIEW_OPEN',
  'IN_REVIEW_CLOSED',
  'IN_REVIEW_REOPENED',
  'IN_REVIEW_ESCALATED',
]

interface AlertUpdateResult {
  alertId: string
  caseId: string
  ruleName: string
  ruleNature: string
  previousStatus: string
  updated: boolean
  error?: string
  closureReason?: string
}

interface ScriptOptions {
  tenantId: string
  dryRun: boolean
  csvPath?: string
}

interface CsvAlertRecord {
  alertId: string
  reason: string
  comment: string
  [key: string]: string // Allow additional columns
}

async function parseCsvFile(csvPath: string): Promise<CsvAlertRecord[]> {
  return new Promise((resolve, reject) => {
    try {
      const fileContent = fs.readFileSync(csvPath, 'utf-8')
      parse(
        fileContent,
        {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        },
        (err, records) => {
          if (err) {
            reject(new Error(`Failed to parse CSV: ${err.message}`))
            return
          }

          const results: CsvAlertRecord[] = []

          for (const record of records) {
            const alertId = record['Alert ID']
            const closingRemark = record['Closing Remark']

            // Skip if this looks like a header row or missing data
            if (!alertId || alertId === 'Alert ID') {
              continue
            }

            // Extract Reason and Comment from the second column
            let reason = ''
            let comment = ''

            if (closingRemark) {
              const lines = closingRemark.split('\n')
              for (const line of lines) {
                const trimmedLine = line.trim()
                if (trimmedLine.startsWith('Reason: ')) {
                  reason = trimmedLine.substring(8) // Remove "Reason: " prefix
                } else if (trimmedLine.startsWith('Comment: ')) {
                  comment = trimmedLine.substring(9) // Remove "Comment: " prefix
                }
              }
            }

            if (alertId && reason && comment) {
              logger.info(
                `Parsing: Alert ID="${alertId}", Reason="${reason}", Comment="${comment}"`
              )
              results.push({
                alertId: alertId,
                reason: reason,
                comment: comment,
              })
            }
          }

          logger.info(`Parsed ${results.length} alerts from CSV`)
          resolve(results)
        }
      )
    } catch (error) {
      reject(new Error(`Failed to parse CSV: ${error}`))
    }
  })
}

async function closeAlertsFromCsv(
  tenantId: string,
  csvAlerts: CsvAlertRecord[],
  dryRun: boolean,
  alertsService: AlertsService
): Promise<AlertUpdateResult[]> {
  const results: AlertUpdateResult[] = []
  let successCount = 0
  let errorCount = 0
  const totalAlerts = csvAlerts.length

  logger.info(`Processing ${totalAlerts.toLocaleString()} alerts from CSV file`)

  for (let i = 0; i < csvAlerts.length; i++) {
    const csvAlert = csvAlerts[i]
    const currentIndex = i + 1

    // Log progress every 1000 records
    if (currentIndex % 1000 === 0) {
      logger.info(
        `Processed ${currentIndex.toLocaleString()}/${totalAlerts.toLocaleString()} alerts`
      )
    }

    try {
      if (dryRun) {
        logger.info(`[DRY RUN] Would close alert ${csvAlert.alertId}`)
        results.push({
          alertId: csvAlert.alertId,
          caseId: 'UNKNOWN',
          ruleName: 'CSV',
          ruleNature: 'UNKNOWN',
          previousStatus: 'UNKNOWN',
          updated: true,
          closureReason: csvAlert.comment,
        })
        successCount++
        continue
      }

      // Live execution: Close the specific alert
      try {
        // First, find the case ID for this alert
        const db = await getMongoDbClient()
        const collection = db.db().collection<Case>(CASES_COLLECTION(tenantId))
        const caseData = await collection.findOne(
          { 'alerts.alertId': csvAlert.alertId },
          { projection: { caseId: 1 } }
        )

        if (!caseData?.caseId) {
          results.push({
            alertId: csvAlert.alertId,
            caseId: 'UNKNOWN',
            ruleName: 'CSV',
            ruleNature: 'UNKNOWN',
            previousStatus: 'UNKNOWN',
            updated: false,
            closureReason: csvAlert.comment,
            error: 'Alert not found in any case',
          })
          logger.warn(`⚠️ Alert ${csvAlert.alertId} not found in any case`)
          continue
        }

        // Create AlertStatusUpdateRequest object for service
        const statusUpdateRequest = {
          alertStatus: 'CLOSED' as any,
          reason: [csvAlert.reason],
          comment: csvAlert.comment,
          files: [],
        }

        // Use AlertsService to ensure business logic is applied
        await alertsService.updateStatus(
          [csvAlert.alertId],
          statusUpdateRequest,
          {
            bySystem: true,
            cascadeCaseUpdates: true,
          }
        )

        results.push({
          alertId: csvAlert.alertId,
          caseId: caseData.caseId,
          ruleName: 'CSV',
          ruleNature: 'UNKNOWN',
          previousStatus: 'UNKNOWN',
          updated: true,
          closureReason: csvAlert.comment,
        })
        logger.info(
          `✅ Successfully closed alert ${csvAlert.alertId} in case ${caseData.caseId}`
        )

        // The AlertsService with cascadeCaseUpdates=true should handle case closure automatically
        // when all alerts in a case are closed, so no additional case update should be needed
        logger.info(
          `✅ AlertsService completed processing alert ${csvAlert.alertId} in case ${caseData.caseId}`
        )
      } catch (error: any) {
        logger.error(`❌ Error processing alert ${csvAlert.alertId}:`, error)

        results.push({
          alertId: csvAlert.alertId,
          caseId: 'UNKNOWN',
          ruleName: 'CSV',
          ruleNature: 'UNKNOWN',
          previousStatus: 'UNKNOWN',
          updated: false,
          closureReason: csvAlert.comment,
          error: error.message,
        })
      }
    } catch (error) {
      logger.error(`❌ Error processing alert ${csvAlert.alertId}:`, error)
      errorCount++

      results.push({
        alertId: csvAlert.alertId,
        caseId: 'UNKNOWN',
        ruleName: 'UNKNOWN',
        ruleNature: 'UNKNOWN',
        previousStatus: 'UNKNOWN',
        updated: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        closureReason: csvAlert.comment,
      })
    }
  }

  logger.info(
    `CSV Processing Complete: ${successCount.toLocaleString()} successful, ${errorCount.toLocaleString()} errors`
  )

  return results
}

async function closeAlertsByRules(
  tenantId: string,
  dryRun: boolean,
  alertsService: AlertsService,
  casesCollection: Collection<Case>
): Promise<AlertUpdateResult[]> {
  const results: AlertUpdateResult[] = []

  // Find cases with alerts that match our criteria
  const pipeline = [
    {
      $match: {
        alerts: { $exists: true, $ne: [] },
        'alerts.ruleNature': 'SCREENING',
        'alerts.alertStatus': { $in: IN_REVIEW_STATUSES },
        'alerts.createdTimestamp': { $lte: TARGET_DATE },
        'alerts.ruleName': { $in: TARGET_RULE_NAMES },
      },
    },
    {
      $unwind: '$alerts',
    },
    {
      $match: {
        'alerts.ruleNature': 'SCREENING',
        'alerts.alertStatus': { $in: IN_REVIEW_STATUSES },
        'alerts.createdTimestamp': { $lte: TARGET_DATE },
        'alerts.ruleName': { $in: TARGET_RULE_NAMES },
      },
    },
    {
      $project: {
        caseId: 1,
        alert: '$alerts',
        caseCreatedTimestamp: '$createdTimestamp',
      },
    },
  ]

  logger.info('Executing aggregation pipeline to find matching alerts...')
  const matchingAlerts = await casesCollection.aggregate(pipeline).toArray()

  logger.info(
    `Found ${matchingAlerts.length.toLocaleString()} alerts matching criteria`
  )

  if (matchingAlerts.length === 0) {
    logger.info('No alerts found to close. Exiting.')
    return results
  }

  // Group alerts by case for efficient updates
  const alertsByCase = new Map<string, { caseId: string; alerts: any[] }>()

  for (const item of matchingAlerts) {
    const caseId = item.caseId as string
    if (!alertsByCase.has(caseId)) {
      alertsByCase.set(caseId, { caseId, alerts: [] })
    }
    const caseData = alertsByCase.get(caseId)
    if (caseData) {
      caseData.alerts.push(item.alert)
    }
  }

  logger.info(
    `Grouped into ${alertsByCase.size.toLocaleString()} cases for processing`
  )

  // Process each case
  let processedCases = 0

  for (const [caseId, caseData] of alertsByCase) {
    processedCases++

    // Log progress every 1000 cases
    if (processedCases % 1000 === 0) {
      logger.info(
        `Processed ${processedCases.toLocaleString()}/${alertsByCase.size.toLocaleString()} cases`
      )
    }

    try {
      logger.info(
        `Processing case ${caseId} with ${caseData.alerts.length} alerts`
      )

      const alertIds = caseData.alerts
        .map((alert) => (alert as any).alertId)
        .filter(Boolean)
      const ruleNames = caseData.alerts
        .map((alert) => (alert as any).ruleName)
        .filter(Boolean)

      logger.info(`Alert IDs: ${alertIds.join(', ')}`)
      logger.info(`Rule names: ${ruleNames.join(', ')}`)

      if (dryRun) {
        // Dry run: just log what would be done
        logger.info(
          `[DRY RUN] Would update ${caseData.alerts.length} alerts in case ${caseId}`
        )
        logger.info(
          `[DRY RUN] Would set status to CLOSED with comment: "${DEFAULT_CLOSURE_COMMENT}"`
        )

        for (const alert of caseData.alerts) {
          results.push({
            alertId: alert.alertId,
            caseId: caseId,
            ruleName: alert.ruleName,
            ruleNature: alert.ruleNature,
            previousStatus: alert.alertStatus,
            updated: true, // In dry run, we consider it "would succeed"
            closureReason: DEFAULT_CLOSURE_COMMENT,
          })
        }
        continue
      }

      // Live execution: Use AlertsService.updateStatus()
      try {
        // Create the status update request for service
        const statusUpdateRequest = {
          alertStatus: 'CLOSED' as any,
          reason: ['Other'],
          comment: DEFAULT_CLOSURE_COMMENT,
          files: [],
        }

        // Update alerts using the service (ensures business logic is applied)
        await alertsService.updateStatus(alertIds, statusUpdateRequest, {
          bySystem: true,
          cascadeCaseUpdates: true,
        })

        // Add results for each alert
        for (const alert of caseData.alerts) {
          results.push({
            alertId: alert.alertId,
            caseId: caseId,
            ruleName: alert.ruleName,
            ruleNature: alert.ruleNature,
            previousStatus: alert.alertStatus,
            updated: true,
            closureReason: DEFAULT_CLOSURE_COMMENT,
          })
        }

        // The AlertsService with cascadeCaseUpdates=true should handle case closure automatically
        // when all alerts in a case are closed
        logger.info(
          `✅ AlertsService completed processing ${alertIds.length} alerts in case ${caseId}`
        )
      } catch (serviceError) {
        logger.error(
          `❌ Error updating alerts via AlertsService for case ${caseId}:`,
          serviceError
        )

        for (const alert of caseData.alerts) {
          results.push({
            alertId: (alert as any).alertId || 'UNKNOWN',
            caseId: caseId,
            ruleName: (alert as any).ruleName || 'UNKNOWN',
            ruleNature: (alert as any).ruleNature || 'UNKNOWN',
            previousStatus: (alert as any).alertStatus || 'UNKNOWN',
            updated: false,
            error:
              serviceError instanceof Error
                ? serviceError.message
                : 'Unknown service error',
            closureReason: DEFAULT_CLOSURE_COMMENT,
          })
        }
      }
    } catch (error) {
      logger.error(`❌ Error processing case ${caseId}:`, error)

      for (const alert of caseData.alerts) {
        results.push({
          alertId: alert.alertId,
          caseId: caseId,
          ruleName: alert.ruleName,
          ruleNature: alert.ruleNature,
          previousStatus: alert.alertStatus,
          updated: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          closureReason: DEFAULT_CLOSURE_COMMENT,
        })
      }
    }
  }

  logger.info(
    `Rule-based Processing Complete: ${results.length.toLocaleString()} alerts processed in ${alertsByCase.size.toLocaleString()} cases`
  )

  return results
}

async function closeScreeningAlerts(options: ScriptOptions): Promise<void> {
  const { tenantId, dryRun, csvPath } = options

  // Validate environment and credentials
  if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_PROFILE) {
    throw new Error(
      'AWS credentials not found. Please run:\n' +
        '1. npm run aws-login <env> (dev/sandbox/prod)\n' +
        '2. source scripts/aws/load-credentials.sh <profile>\n' +
        '3. Then run this script again'
    )
  }

  if (!process.env.ENV) {
    throw new Error(
      'ENV environment variable not set. Please set ENV=dev, ENV=sandbox, or ENV=prod'
    )
  }

  if (!process.env.AWS_REGION) {
    throw new Error(
      'AWS_REGION environment variable not set. Please set AWS_REGION (e.g., us-east-2, eu-central-1)'
    )
  }

  logger.info(`Starting to close screening alerts for tenant: ${tenantId}`)
  logger.info(`Environment: ${process.env.ENV}`)
  logger.info(`AWS Region: ${process.env.AWS_REGION}`)
  logger.info(
    `Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE EXECUTION'}`
  )
  logger.info(`Closure Type: ${csvPath ? 'CSV-based' : 'Rule-based'}`)

  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const s3 = getS3Client()
  const db = mongoDb.db()
  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))

  // Initialize Services instead of repositories to ensure business logic is applied
  const alertsRepository = new AlertsRepository(tenantId, { mongoDb, dynamoDb })

  const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env
  const s3Config = {
    documentBucketName: DOCUMENT_BUCKET || '',
    tmpBucketName: TMP_BUCKET || '',
  }

  const alertsService = new AlertsService(alertsRepository, s3, s3Config)

  // Debug: Check what environment variables are available
  logger.info(
    `Environment variables: DOCUMENT_BUCKET=${process.env.DOCUMENT_BUCKET}, TMP_BUCKET=${process.env.TMP_BUCKET}`
  )

  // Try to get AWS credentials from environment
  const awsCredentials =
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          sessionToken: process.env.AWS_SESSION_TOKEN,
        }
      : undefined

  logger.info(`AWS credentials available: ${awsCredentials ? 'Yes' : 'No'}`)

  // Try to disable webhook functionality to avoid secrets issues
  if (!process.env.WEBHOOK_DELIVERY_QUEUE_URL) {
    process.env.WEBHOOK_DELIVERY_QUEUE_URL = 'disabled'
    logger.info('Disabled webhook delivery queue to avoid secrets issues')
  }

  let results: AlertUpdateResult[] = []

  if (csvPath) {
    logger.info(`Performing CSV-based closure from file: ${csvPath}`)
    results = await closeAlertsFromCsv(
      tenantId,
      await parseCsvFile(csvPath),
      dryRun,
      alertsService
    )
  } else {
    logger.info('Performing rule-based closure...')
    results = await closeAlertsByRules(
      tenantId,
      dryRun,
      alertsService,
      casesCollection
    )
  }

  // Print summary
  logger.info('=== CLOSURE SCRIPT SUMMARY ===')
  const totalSuccess = results.filter((r) => r.updated).length
  const totalErrors = results.filter((r) => !r.updated).length

  if (csvPath) {
    logger.info(`Total alerts from CSV: ${results.length.toLocaleString()}`)
  } else {
    logger.info(`Total alerts found: ${results.length.toLocaleString()}`)
  }
  logger.info(`Successfully closed: ${totalSuccess.toLocaleString()}`)
  logger.info(`Errors: ${totalErrors.toLocaleString()}`)
  logger.info(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE EXECUTION'}`)

  // Print detailed results
  logger.info('\n=== DETAILED RESULTS ===')
  const totalResults = results.length

  if (totalResults > 100) {
    logger.info(
      `Showing first 100 results (${totalResults.toLocaleString()} total). Full results will be saved to file.`
    )
    const resultsToShow = results.slice(0, 100)

    for (const result of resultsToShow) {
      const status = result.updated ? '✅ SUCCESS' : '❌ FAILED'
      logger.info(
        `${status} - Alert ${result.alertId} (${result.ruleName || 'CSV'}) - ${
          result.previousStatus || 'UNKNOWN'
        } → CLOSED`
      )
      if (result.error) {
        logger.error(`  Error: ${result.error}`)
      }
      if (result.closureReason) {
        logger.info(`  Closure Reason: ${result.closureReason}`)
      }
    }

    if (totalResults > 100) {
      logger.info(
        `... and ${(
          totalResults - 100
        ).toLocaleString()} more results (see saved file for complete details)`
      )
    }
  } else {
    // Show all results for smaller datasets
    for (const result of results) {
      const status = result.updated ? '✅ SUCCESS' : '❌ FAILED'
      logger.info(
        `${status} - Alert ${result.alertId} (${result.ruleName || 'CSV'}) - ${
          result.previousStatus || 'UNKNOWN'
        } → CLOSED`
      )
      if (result.error) {
        logger.error(`  Error: ${result.error}`)
      }
      if (result.closureReason) {
        logger.info(`  Closure Reason: ${result.closureReason}`)
      }
    }
  }

  // Save results to file for audit purposes
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const mode = dryRun ? 'dry-run' : 'live'
  const filename = `screening-alerts-closure-${tenantId}-${mode}-${timestamp}.json`

  fs.writeFileSync(
    filename,
    JSON.stringify(
      {
        summary: {
          totalAlerts: results.length,
          successfullyClosed: totalSuccess,
          errors: totalErrors,
          executionTime: new Date().toISOString(),
          mode: mode,
          tenantId: tenantId,
          closureType: options.csvPath ? 'CSV-based' : 'Rule-based',
          csvPath: options.csvPath || undefined,
        },
        results: results,
      },
      null,
      2
    )
  )

  logger.info(`\nDetailed results saved to: ${filename}`)
}

// Main execution
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error(
      'Usage: ts-node close-screening-alerts.ts <tenantId> [--dry-run] [--csv <path-to-csv>]'
    )
    console.error('')
    console.error('Examples:')
    console.error('  # Rule-based closure (existing functionality)')
    console.error('  ts-node close-screening-alerts.ts tenant123')
    console.error('  ts-node close-screening-alerts.ts tenant123 --dry-run')
    console.error('')
    console.error('  # CSV-based closure (recommended for bulk operations)')
    console.error(
      '  ts-node close-screening-alerts.ts tenant123 --csv ~/Downloads/alerts.csv'
    )
    console.error(
      '  ts-node close-screening-alerts.ts tenant123 --dry-run --csv ~/Downloads/alerts.csv'
    )
    console.error('')
    console.error('  # Yarn scripts')
    console.error(
      '  yarn close-screening-alerts tenant123                    # Rule-based live'
    )
    console.error(
      '  yarn close-screening-alerts:dry-run tenant123           # Rule-based dry run'
    )
    console.error(
      '  yarn close-screening-alerts:csv tenant123 ~/Downloads/alerts.csv                    # CSV-based live'
    )
    console.error(
      '  yarn close-screening-alerts:csv:dry-run tenant123 ~/Downloads/alerts.csv           # CSV-based dry run'
    )
    process.exit(1)
  }

  // Parse arguments - handle both --dry-run and --csv flags
  const dryRun = args.includes('--dry-run')
  const hasCsvFlag = args.includes('--csv')

  // Find tenant ID and CSV path
  // When using yarn scripts, the remaining arguments after flags are: tenantId csvPath
  const nonFlagArgs = args.filter(
    (arg) => arg !== '--dry-run' && arg !== '--csv'
  )

  let tenantId: string | undefined
  let csvPath: string | undefined

  if (hasCsvFlag) {
    // CSV mode: expect tenantId and csvPath as arguments
    if (nonFlagArgs.length >= 2) {
      tenantId = nonFlagArgs[0]
      csvPath = nonFlagArgs[1]
    } else if (nonFlagArgs.length === 1) {
      tenantId = nonFlagArgs[0]
      // csvPath will be undefined, which will cause an error
    }
  } else {
    // Rule-based mode: expect only tenantId
    if (nonFlagArgs.length >= 1) {
      tenantId = nonFlagArgs[0]
    }
  }

  if (!tenantId) {
    console.error('Error: Tenant ID is required')
    console.error(
      'Usage: ts-node close-screening-alerts.ts <tenantId> [--dry-run] [--csv <path-to-csv>]'
    )
    console.error('')
    console.error('Examples:')
    console.error(
      '  ts-node close-screening-alerts.ts tenant123 --csv ~/Downloads/alerts.csv'
    )
    console.error(
      '  ts-node close-screening-alerts.ts tenant123 --dry-run --csv ~/Downloads/alerts.csv'
    )
    process.exit(1)
  }

  if (hasCsvFlag && !csvPath) {
    console.error('Error: CSV mode requires both tenant ID and CSV file path')
    console.error(
      'Usage: ts-node close-screening-alerts.ts <tenantId> --csv <path-to-csv>'
    )
    console.error(
      'Example: ts-node close-screening-alerts.ts tenant123 --csv ~/Downloads/alerts.csv'
    )
    process.exit(1)
  }

  try {
    await closeScreeningAlerts({ tenantId, dryRun, csvPath })
    logger.info('Script completed successfully')
    process.exit(0)
  } catch (error) {
    logger.error('Script failed:', error)
    // Add more detailed error information
    if (error instanceof Error) {
      logger.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
    }
    process.exit(1)
  }
}

// Run the script if called directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('Unhandled error in main:', error)
    process.exit(1)
  })
}

export { closeScreeningAlerts, parseCsvFile }
