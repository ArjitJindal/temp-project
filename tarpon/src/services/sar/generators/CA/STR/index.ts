import { GenerateResult, InternalReportType, ReportGenerator } from '../..'
import {
  ActionTaken,
  PersonDetails,
  DetailsOfSuspicion,
  RelatedReports,
  PersonNames,
  EntityNames,
  ReprotDetails,
  EntityDetails,
  PersonAndEmployerDetails,
  EntityAndBeneficialOwnershipDetails,
  Transactions,
} from './schema'
import { Account } from '@/@types/openapi-internal/Account'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { Report } from '@/@types/openapi-internal/Report'
import { ReportParameters } from '@/@types/openapi-internal/ReportParameters'
import { ReportSchema } from '@/@types/openapi-internal/ReportSchema'

export class CanadaStrReportGenerator implements ReportGenerator {
  public static getInstance(tenantId: string): CanadaStrReportGenerator {
    const generator = new CanadaStrReportGenerator()
    generator.setTenantId(tenantId)
    return generator
  }
  tenantId!: string

  public setTenantId(tenantId: string): void {
    this.tenantId = tenantId
  }
  getType(): InternalReportType {
    return {
      countryCode: 'CA',
      type: 'STR',
      directSubmission: false,
      subjectTypes: ['CASE'],
    }
  }
  async getPopulatedParameters(
    _c: Case,
    _transactions: InternalTransaction[],
    _reporter: Account
  ): Promise<ReportParameters> {
    const params: ReportParameters = {
      report: {},
      definitions: {},
      transactionMetadata: {},
    }
    return params
  }
  getUserPopulatedParameters(
    _user: InternalConsumerUser | InternalBusinessUser,
    _transactions: InternalTransaction[],
    _reporter: Account
  ): Promise<ReportParameters> {
    throw new Error('Method not implemented.')
  }
  getSchema(): ReportSchema {
    return {
      reportSchema: {
        type: 'object',
        properties: {
          reportDetails: ReprotDetails,
          relatedReports: RelatedReports,
          actionTaken: ActionTaken,
          detailsOfSuspicion: DetailsOfSuspicion,
        },
        required: ['reportDetails', 'relatedReports', 'detailsOfSuspicion'],
      },
      definitionsSchema: {
        type: 'object',
        properties: {
          personNames: PersonNames,
          entityNames: EntityNames,
          personDetails: PersonDetails,
          entityDetails: EntityDetails,
          personAndEmployerDetails: PersonAndEmployerDetails,
          entityAndBeneficialOwnershipDetails:
            EntityAndBeneficialOwnershipDetails,
        },
      },
      transactionMetadataSchema: {
        type: 'object',
        properties: {
          transactions: Transactions,
        },
        required: ['transactions'],
      },
    }
  }
  getAugmentedReportParams(report: Report): ReportParameters {
    return report.parameters
  }
  async generate(
    _reportParams: ReportParameters,
    _report: Report
  ): Promise<GenerateResult> {
    return {
      type: 'STRING',
      value: '',
    }
  }
  async submit(_report: Report): Promise<string> {
    return ''
  }
}
