import { KenyaSARReportGenerator } from './KE/SAR'
import { UsSarReportGenerator } from './US/SAR'
import { Account } from '@/@types/openapi-internal/Account'
import { Case } from '@/@types/openapi-internal/Case'
import { ReportSchema } from '@/@types/openapi-internal/ReportSchema'
import { ReportParameters } from '@/@types/openapi-internal/ReportParameters'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { CountryCode } from '@/@types/openapi-internal/CountryCode'
import { LithuaniaSTRReportGenerator } from '@/services/sar/generators/LT/STR'
import { LithuaniaCTRReportGenerator } from '@/services/sar/generators/LT/CTR'

export type PopulatedSchema = { params: ReportParameters; schema: ReportSchema }
export type InternalReportType = { type: string; countryCode: CountryCode }
export interface ReportGenerator {
  tenantId?: string
  // Metadata about the report type that this generates
  getType(): InternalReportType

  // Prepare the report data with what we already know about the suspicious user
  getPopulatedSchema(
    reportId: string,
    c: Case,
    transactions: InternalTransaction[],
    reporter: Account
  ): Promise<PopulatedSchema>

  // Generate the report (XML)
  generate(reportParams: ReportParameters): string
}

const reportGenerators = [
  KenyaSARReportGenerator,
  LithuaniaSTRReportGenerator,
  LithuaniaCTRReportGenerator,
  UsSarReportGenerator,
]
export const REPORT_GENERATORS = new Map<string, ReportGenerator>(
  reportGenerators.map((rg) => {
    const generator = new rg()
    const type = generator.getType()
    const id = `${type.countryCode}-${type.type}`
    return [id, generator]
  })
)

export const UNIMPLEMENTED_GENERATORS: [CountryCode, string][] = [['KE', 'STR']]
