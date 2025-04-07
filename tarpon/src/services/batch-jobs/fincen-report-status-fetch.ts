import { SFTP_CONNECTION_ERROR_PREFIX } from '@lib/constants'
import SftpClient from 'ssh2-sftp-client'
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
import { connectToSFTP } from '@/utils/sar'
import { getSecretByName } from '@/utils/secrets-manager'

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
      timeNow - 1000 * 60 * 60 // 1 hour report update
    )
    const sarGenerator = UsSarReportGenerator.getInstance(job.tenantId)
    // 2. fetch result from sftp server
    const batchSize = 5
    let currentIndex = 0

    let sftp: SftpClient | undefined = undefined
    try {
      sftp = await connectToSFTP()
      const creds = await getSecretByName('fincenCreds')
      if (!sftp) {
        return
      }
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

        const promises = filteredUsaReportBatch.map((report) => {
          return new Promise((resolve, reject) => {
            if (!sftp) {
              return resolve(false)
            }
            sarGenerator
              .getAckFileContent(sftp, report, creds)
              .then(async (status) => {
                try {
                  if (!status && report.id) {
                    // handling report which were never on fincen
                    await reportRepository.updateReportAck(
                      report.id,
                      'SUBMISSION_REJECTED',
                      '',
                      '',
                      timeNow
                    )
                  }
                  if (status && report.id) {
                    const { result, statusInfo } = await parseReportXMLResponse(
                      status
                    )
                    if (!statusInfo) {
                      return resolve(false)
                    }

                    const currentStatus =
                      fincenStatusMapper(statusInfo as FincenReportStatus) ??
                      report.status
                    if (currentStatus !== report.status && report.id) {
                      await reportRepository.updateReportAck(
                        report.id,
                        currentStatus,
                        status,
                        result,
                        timeNow
                      )
                    }
                  }
                  return resolve(true)
                } catch (error) {
                  logger.error(`Error processing report ${report.id}: ${error}`)
                }
              })
              .catch((error) => {
                reject(error)
              })
          })
        })
        await Promise.all(promises)
        currentIndex = endIndex
      }
      if (sftp) {
        await sftp.end()
      }
    } catch (error) {
      if (sftp) {
        await sftp.end()
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        (('code' in error && error.code === 'ERR_GENERIC_CLIENT') ||
          ('message' in error &&
            error.message === 'Connection attempt timed out after 30 seconds'))
      ) {
        logger.error(`${SFTP_CONNECTION_ERROR_PREFIX} ${error}`)
        return
      }
      logger.error(
        `${this.FINCEN_BATCH_JOB_LOG_PREFIX} Batch processing error for Tenant ID: ${job.tenantId}, Error: ${error}`
      )
      return
    }
  }
}
