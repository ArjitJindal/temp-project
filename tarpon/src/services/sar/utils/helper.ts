import { ReportGenerator } from '../generators'
import { KenyaSARReportGenerator } from '@/services/sar/generators/KE/SAR'
import { UsSarReportGenerator } from '@/services/sar/generators/US/SAR'
import { UsCtrReportGenerator } from '@/services/sar/generators/US/CTR'
import { CanadaStrReportGenerator } from '@/services/sar/generators/CA/STR'
import { LithuaniaSTRReportGenerator } from '@/services/sar/generators/LT/STR'
import { LithuaniaCTRReportGenerator } from '@/services/sar/generators/LT/CTR'
import { MalaysianSTRReportGenerator } from '@/services/sar/generators/MY/STR'
import { CountryCode } from '@/@types/openapi-internal/CountryCode'
import { ReportSubjectType } from '@/@types/openapi-internal/ReportSubjectType'

const reportGenerators = [
  CanadaStrReportGenerator,
  KenyaSARReportGenerator,
  LithuaniaSTRReportGenerator,
  LithuaniaCTRReportGenerator,
  UsSarReportGenerator,
  UsCtrReportGenerator,
  MalaysianSTRReportGenerator,
]
export const REPORT_GENERATORS = new Map<string, ReportGenerator>(
  reportGenerators.map((rg) => {
    const generator = new rg()
    const type = generator.getType()
    const id = `${type.countryCode}-${type.type}`
    return [id, generator]
  })
)

export const UNIMPLEMENTED_GENERATORS: [
  CountryCode,
  string,
  ReportSubjectType[]
][] = [
  ['KE', 'STR', []],
  ['CA', 'LCTR', ['CASE']],
  ['CA', 'AMF', ['CASE']],
  ['CA', 'Terrorist Property Report', ['CASE']],
]
