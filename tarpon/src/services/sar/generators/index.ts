import { KenyaSARReportGenerator } from './KE/SAR'
import { Account } from '@/@types/openapi-internal/Account'
import { Case } from '@/@types/openapi-internal/Case'
import { ReportSchema } from '@/@types/openapi-internal/ReportSchema'
import { ReportParameters } from '@/@types/openapi-internal/ReportParameters'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

export interface ReportGenerator {
  getSchema(): ReportSchema

  // Prepare the report data with what we already know about the suspicious user
  prepopulate(
    reportId: string,
    c: Case,
    transactions: InternalTransaction[],
    reporter: Account
  ): ReportParameters

  // Generate the report (XML)
  generate(reportParams: ReportParameters): string
}

const reportGenerators = [KenyaSARReportGenerator]
export const REPORT_GENERATORS = new Map<string, ReportGenerator>(
  reportGenerators.map((rg) => [new rg().getSchema().id, new rg()])
)
