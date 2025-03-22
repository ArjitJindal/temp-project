import { GenerateResult, InternalReportType, ReportGenerator } from '../..'
import {
  ContactOffice,
  CurrencyTransactionActivity,
  FilingInstitution,
  PersonsInvolvedInTransactions,
  TransactionLocations,
  Transmitter,
  TransmitterContact,
} from './schema'
import { FincenJsonSchema } from './resources/EFL_CTRXBatchSchema'
import { ReportParameters } from '@/@types/openapi-internal/ReportParameters'
import { ReportSchema } from '@/@types/openapi-internal/ReportSchema'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { Account } from '@/@types/openapi-internal/Account'
import { Case } from '@/@types/openapi-internal/Case'

export class UsCtrReportGenerator implements ReportGenerator {
  public static getInstance(tenantId: string): UsCtrReportGenerator {
    const generator = new UsCtrReportGenerator()
    generator.setTenantId(tenantId)
    return generator
  }
  tenantId!: string
  getType(): InternalReportType {
    return {
      countryCode: 'US',
      type: 'CTR',
      directSubmission: true,
      subjectTypes: ['CASE'],
    }
  }
  public setTenantId(tenantId: string): void {
    this.tenantId = tenantId
  }
  // TODO
  async getPopulatedParameters(
    _c: Case,
    _transactions: InternalTransaction[],
    _reporter: Account
  ): Promise<ReportParameters> {
    const params: ReportParameters = {
      report: {},
      currencyTransaction: {},
    }
    return params
  }
  // TODO
  getUserPopulatedParameters(): Promise<ReportParameters> {
    throw new Error('Method not implemented.')
  }
  getSchema(): ReportSchema {
    return {
      reportSchema: {
        type: 'object',
        properties: {
          transmitter: Transmitter,
          transmitterContact: TransmitterContact,
          filingInstitution: FilingInstitution,
          contactOffice: ContactOffice,
        },
        required: [
          'transmitter',
          'transmitterContact',
          'filingInstitution',
          'contactOffice',
        ],
        definitions: FincenJsonSchema.definitions,
      },
      currencyTransactionSchema: {
        type: 'object',
        properties: {
          transactionLocations: TransactionLocations,
          personsInvolvedInTransactions: PersonsInvolvedInTransactions,
          currencyTransactionActivity: CurrencyTransactionActivity,
        },
        required: ['transactionLocations', 'personsInvolvedInTransactions'],
        definitions: FincenJsonSchema.definitions,
      },
    }
  }
  getAugmentedReportParams(): ReportParameters {
    throw new Error('Method not implemented.')
  }
  generate(): Promise<GenerateResult> {
    throw new Error('Method Generate not implemented.')
  }
  submit?(): Promise<string> {
    throw new Error('Method not implemented.')
  }
}
