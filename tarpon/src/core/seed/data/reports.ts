import { memoize } from 'lodash'
import { ReportSampler } from '../samplers/report'
import { getCases } from './cases'
import { Report } from '@/@types/openapi-internal/Report'

export const getReports: () => Report[] = memoize(() => {
  const rData: Report[] = []
  const reportSampler = new ReportSampler()
  rData.push(
    // Create a report every case
    ...getCases().map((c, i) => {
      const reportId = `RP-${i + 3}`
      return reportSampler.getSample(
        undefined,
        reportId,
        c.caseId || '',
        c.caseUsers?.destination?.userId || c.caseUsers?.origin?.userId || ''
      )
    })
  )

  return rData
})
