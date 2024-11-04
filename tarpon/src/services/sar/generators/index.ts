import { KenyaSARReportGenerator } from './KE/SAR'
import { UsSarReportGenerator } from './US/SAR'
import { Report } from '@/@types/openapi-internal/Report'
import { Account } from '@/@types/openapi-internal/Account'
import { Case } from '@/@types/openapi-internal/Case'
import { ReportParameters } from '@/@types/openapi-internal/ReportParameters'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { CountryCode } from '@/@types/openapi-internal/CountryCode'
import { LithuaniaSTRReportGenerator } from '@/services/sar/generators/LT/STR'
import { LithuaniaCTRReportGenerator } from '@/services/sar/generators/LT/CTR'
import { MalaysianSTRReportGenerator } from '@/services/sar/generators/MY/STR'
import { ReportSchema } from '@/@types/openapi-internal/ReportSchema'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { ReportSubjectType } from '@/@types/openapi-internal/ReportSubjectType'

export type InternalReportType = {
  type: string
  subjectTypes: ReportSubjectType[]
  countryCode: CountryCode
  directSubmission: boolean
}

export type GenerateResult =
  | {
      type: 'STRING'
      value: string
    }
  | {
      type: 'STREAM'
      contentType: 'PDF'
      stream: NodeJS.ReadableStream
    }

export interface ReportGenerator {
  tenantId?: string
  // Metadata about the report type that this generates
  getType(): InternalReportType

  // Prepare the report data with what we already know about the suspicious user
  getPopulatedParameters(
    c: Case,
    transactions: InternalTransaction[],
    reporter: Account
  ): Promise<ReportParameters>
  getUserPopulatedParameters(
    user: InternalConsumerUser | InternalBusinessUser,
    transactions: InternalTransaction[],
    reporter: Account
  ): Promise<ReportParameters>
  getSchema(): ReportSchema

  getAugmentedReportParams(report?: Report): ReportParameters

  // Generate the report (XML)
  generate(
    reportParams: ReportParameters,
    report: Report
  ): Promise<GenerateResult>
  submit?(report: Report): Promise<string>
}

const reportGenerators = [
  KenyaSARReportGenerator,
  LithuaniaSTRReportGenerator,
  LithuaniaCTRReportGenerator,
  UsSarReportGenerator,
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

export const UNIMPLEMENTED_GENERATORS: [CountryCode, string][] = [['KE', 'STR']]
