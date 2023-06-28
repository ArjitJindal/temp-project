import { InternalReportType, PopulatedSchema, ReportGenerator } from '../..'
import { Case } from '@/@types/openapi-internal/Case'
import { Account } from '@/@types/openapi-internal/Account'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { ReportParameters } from '@/@types/openapi-internal/ReportParameters'

export class UsSarReportGenerator implements ReportGenerator {
  getType(): InternalReportType {
    return {
      countryCode: 'US',
      type: 'SAR',
    }
  }

  public getPopulatedSchema(
    _reportId: string,
    _c: Case,
    _transactions: InternalTransaction[],
    _reporter: Account
  ): PopulatedSchema {
    // TODO: Implement me
    return {
      params: null,
      schema: null,
    } as any
  }

  public generate(_reportParams: ReportParameters): string {
    // TODO: Implement me
    return ''
  }
}
