import { SampleFincenReport, SampleKenyaReport } from '../samplers/report'
import { data as cases } from './cases'
import { Report } from '@/@types/openapi-internal/Report'

const data: Report[] = []

const init = () => {
  data.push(
    SampleKenyaReport('RP-1', 'C-10', '2'),
    SampleFincenReport('RP-2', 'C-17', '1', 'COMPLETE', undefined, ['RP-2.1']),
    SampleFincenReport('RP-2.1', 'C-17', '1', 'DRAFT', 'RP-2'),
    // Create a report every case
    ...cases.map((c, i) => {
      return SampleFincenReport(
        `RP-${i + 3}`,
        c.caseId || '',
        c.caseUsers?.destination?.userId || c.caseUsers?.origin?.userId || '',
        'COMPLETE'
      )
    })
  )
}

export { init, data }
