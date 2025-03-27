import { SFTP_CONNECTION_ERROR_PREFIX } from '@lib/constants'
import { ReportRepository } from '../sar/repositories/report-repository'
import { UsSarReportGenerator } from '../sar/generators/US/SAR'
import { BatchJobRunner } from './batch-job-runner-base'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { FinCenReportStatusRefreshBatchJob } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { logger } from '@/core/logger'
import { FincenReportStatus } from '@/@types/openapi-internal/FincenReportStatus'
import { ReportStatus } from '@/@types/openapi-internal/ReportStatus'
import { ask } from '@/utils/openai'

export function fincenStatusMapper(
  fincenReportStatus: FincenReportStatus
): ReportStatus {
  switch (fincenReportStatus) {
    case 'RECEIVED':
      return 'SUBMISSION_ACCEPTED'
    case 'ACCEPTED':
      return 'SUBMISSION_ACCEPTED'
    case 'TRANSMITTED':
      return 'SUBMISSION_ACCEPTED'
    case 'ACKNOWLEDGED':
      return 'SUBMISSION_SUCCESSFUL'
    case 'ACCEPTED_WITH_WARNINGS':
      return 'SUBMISSION_ACCEPTED'
    case 'TRANSMITTED_WITH_WARNINGS':
      return 'SUBMISSION_ACCEPTED'
    case 'REJECTED':
      return 'SUBMISSION_ACCEPTED'
    case 'ACKNOWLEDGE_FAILED':
      return 'SUBMISSION_REJECTED'
    case 'HOLD':
      return 'SUBMISSION_REJECTED'
    default:
      return 'SUBMITTING'
  }
}

export async function parseReportXMLResponse(xmlAcknowlegment: string) {
  const result = await ask(
    `Please transform the following error messages in XML format into a human-readable format. Please only return the transformed output. And the output includes two sections - 1. Batch Status 2. Error Messages.\n---\n${xmlAcknowlegment}`
  )
  return {
    statusInfo: result.substring(result.indexOf('Batch Status')),
    result,
  }
}

export class FinCenReportStatusFetchBatchJobRunner extends BatchJobRunner {
  FINCEN_BATCH_JOB_LOG_PREFIX = 'FINCEN_BATCH_JOBB'
  async run(job: FinCenReportStatusRefreshBatchJob) {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const reportRepository = new ReportRepository(
      // 1. get all sla reports that have submitting and submit accept status
      job.tenantId,
      mongoDb,
      dynamoDb
    )
    const timeNow = Date.now()
    const filteredUsaReports = await reportRepository.getReportsByStatus(
      ['SUBMITTING', 'SUBMISSION_ACCEPTED'],
      'US',
      timeNow - 1000 * 60 * 10 // TODO: need to update this to 60 minutes
    )
    logger.info(
      'USA Pending report',
      filteredUsaReports.map((report) => report.id)
    )
    const sarGenerator = UsSarReportGenerator.getInstance(job.tenantId)
    logger.info('USA Pending report', filteredUsaReports.length)
    // 2. fetch result from sftp server

    const batchSize = 5
    let currentIndex = 0

    try {
      // Process reports in batches
      while (currentIndex < filteredUsaReports.length) {
        const endIndex = Math.min(
          currentIndex + batchSize,
          filteredUsaReports.length
        )
        const filteredUsaReportBatch = filteredUsaReports.slice(
          currentIndex,
          endIndex
        )

        logger.info(
          `${this.FINCEN_BATCH_JOB_LOG_PREFIX} Processing batch ${
            currentIndex / batchSize + 1
          }, reports ${currentIndex} to ${endIndex - 1}`
        )

        const promises = filteredUsaReportBatch.map((report) => {
          return new Promise((resolve) => {
            sarGenerator
              .getAckFileContent(report)
              .then((status) => {
                if (status && report.id) {
                  return parseReportXMLResponse(status).then(
                    ({ result, statusInfo }) => {
                      const currentStatus =
                        fincenStatusMapper(statusInfo as FincenReportStatus) ??
                        report.status
                      logger.info(
                        ` ${this.FINCEN_BATCH_JOB_LOG_PREFIX} Tenant Id,
                          ${job.tenantId}
                          ${report.id},
                          'Current status',
                          ${report.status},
                          'New status',
                          ${currentStatus}`
                      )
                      if (currentStatus !== report.status && report.id) {
                        return reportRepository
                          .updateReportAck(
                            report.id,
                            currentStatus,
                            status,
                            result,
                            timeNow
                          )
                          .then(() => resolve(true))
                      }
                      resolve(true)
                    }
                  )
                }
                resolve(false)
              })
              .catch((error) => {
                if (
                  typeof error === 'object' &&
                  error !== null &&
                  (('code' in error && error.code === 'ERR_GENERIC_CLIENT') ||
                    ('message' in error &&
                      error.message ===
                        'Connection attempt timed out after 15 seconds'))
                ) {
                  logger.error(`${SFTP_CONNECTION_ERROR_PREFIX} ${error}`)
                }
                logger.error(
                  `${this.FINCEN_BATCH_JOB_LOG_PREFIX} Error processing report ID: ${report.id}, Tenant ID: ${job.tenantId}, Error: ${error}`
                )
                resolve(false)
              })
          })
        })

        await Promise.all(promises)
        currentIndex = endIndex
      }
    } catch (error) {
      logger.error(
        `${this.FINCEN_BATCH_JOB_LOG_PREFIX} Batch processing error for Tenant ID: ${job.tenantId}, Error: ${error}`
      )
    }
  }
}
