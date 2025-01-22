import { memoize } from 'lodash'
import { SampleFincenReport, SampleKenyaReport } from '../samplers/report'
import { getCases } from './cases'
import { Report } from '@/@types/openapi-internal/Report'
import { FincenReportValidStatus } from '@/@types/openapi-internal/FincenReportValidStatus'
import { NonFincenReportValidStatus } from '@/@types/openapi-internal/NonFincenReportValidStatus'
import { FINCEN_REPORT_VALID_STATUSS } from '@/@types/openapi-internal-custom/FincenReportValidStatus'
import { NON_FINCEN_REPORT_VALID_STATUSS } from '@/@types/openapi-internal-custom/NonFincenReportValidStatus'

export const getReports: () => Report[] = memoize(() => {
  const rData: Report[] = []
  const countryCodes = ['KE', 'US', 'LT', 'MY']

  rData.push(
    SampleKenyaReport('RP-1', 'C-10', '2'),
    SampleFincenReport('RP-2.1', 'C-17', '1', 'DRAFT', 'KE', 'RP-2'),
    // Create a report every case
    ...getCases().map((c, i) => {
      const jurisdiction = countryCodes[i % countryCodes.length]
      let reportStatuses:
        | FincenReportValidStatus[]
        | NonFincenReportValidStatus[] = []
      if (jurisdiction === 'US') {
        reportStatuses = FINCEN_REPORT_VALID_STATUSS
      } else {
        reportStatuses = NON_FINCEN_REPORT_VALID_STATUSS
      }
      const reportStatus =
        reportStatuses[Math.floor(Math.random() * reportStatuses.length)]
      return SampleFincenReport(
        `RP-${i + 3}`,
        c.caseId || '',
        c.caseUsers?.destination?.userId || c.caseUsers?.origin?.userId || '',
        reportStatus,
        jurisdiction
      )
    })
  )

  return rData
})
