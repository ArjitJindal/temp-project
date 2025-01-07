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

function isMoreThanOneHour(timeNow: number, lastTime?: number) {
  if (!lastTime) {
    return true
  }
  // TODO: 10 min for testing change it to 1 hour
  return timeNow - lastTime >= 10 * 60 * 1000 // 1 hour
}

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
  async run(job: FinCenReportStatusRefreshBatchJob) {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const reportRepository = new ReportRepository(
      // 1. get all sla reports that have submitting and submit accept status
      job.tenantId,
      mongoDb,
      dynamoDb
    )
    const usaPendingReports = await reportRepository.getReportsByStatus(
      ['SUBMITTING', 'SUBMISSION_ACCEPTED'],
      'US'
    )
    logger.info('USA Pending report', usaPendingReports)
    const timeNow = Date.now()
    const filteredUsaReports = usaPendingReports.filter(
      (report) =>
        report.id && isMoreThanOneHour(timeNow, report.lastAckFetchTime)
    )
    logger.info('USA report to fetch', filteredUsaReports.length)
    // 2. fetch result from sftp server
    filteredUsaReports.forEach(async (report) => {
      const sarGenerator = new UsSarReportGenerator()
      const status = await sarGenerator.getAckFileContent(report)
      if (status && report.id) {
        // 3. parse the xml and check if is different from previous status
        const { result, statusInfo } = await parseReportXMLResponse(status)
        const currentStatus =
          fincenStatusMapper(statusInfo as FincenReportStatus) ?? report.status
        logger.info(report.id, 'new status', currentStatus)
        if (currentStatus !== report.status) {
          // 4. if the result differ then update the report status and store the parsed xml in mongodb
          logger.info(
            report.id,
            'updating status',
            report.status,
            '->',
            currentStatus
          )
          await reportRepository.updateReportAck(
            report.id,
            currentStatus,
            status,
            result,
            timeNow
          )
        }
      }
    })
  }
}
