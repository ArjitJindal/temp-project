import { memoize } from 'lodash'
import { ReportSampler } from '../samplers/report'
import { getCases } from './cases'
import { ID_PREFIXES } from './seeds'
import { Report } from '@/@types/openapi-internal/Report'

export const reports: Report[] = []
export const getReports: (tenantId: string) => Promise<Report[]> = memoize(
  async (tenantId: string) => {
    if (reports.length === 0) {
      const reportSampler = new ReportSampler(tenantId)
      reports.push(
        ...(await Promise.all(
          getCases().map(async (c, i) => {
            const reportId = `${ID_PREFIXES.REPORT}${i + 3}`
            return await reportSampler.getSample(
              undefined,
              reportId,
              c.caseId || '',
              c.caseUsers?.destination?.userId ||
                c.caseUsers?.origin?.userId ||
                ''
            )
          })
        ))
      )
    }
    return reports
  }
)
