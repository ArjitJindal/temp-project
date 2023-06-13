import { KenyaSARReportGenerator, KenyaSarReportSchema } from './KE/SAR'
import { Account } from '@/@types/openapi-internal/Account'
import { Case } from '@/@types/openapi-internal/Case'
import { ReportSchema } from '@/@types/openapi-internal/ReportSchema'

export interface ReportGenerator<T> {
  // Prepare the report data with what we already know about the suspicious user
  prepopulate(c: Case, transactionIds: string[], reporter: Account): T

  // Generate the report (XML)
  generate(data: T): string
}

export const REPORT_SCHEMAS: ReportSchema[] = [KenyaSarReportSchema]
export const REPORT_GENERATORS = new Map([
  [KenyaSarReportSchema, KenyaSARReportGenerator],
])
