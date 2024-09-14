import { XMLBuilder } from 'fast-xml-parser'
import { InternalReportType, ReportGenerator } from '../..'
import { indicators, KenyaReportSchema, KenyaTransactionSchema } from './schema'
import { Report } from '@/@types/openapi-internal/Report'
import { Case } from '@/@types/openapi-internal/Case'
import { Account } from '@/@types/openapi-internal/Account'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { CardDetails } from '@/@types/openapi-public/CardDetails'
import { GenericBankAccountDetails } from '@/@types/openapi-public/GenericBankAccountDetails'
import { IBANDetails } from '@/@types/openapi-public/IBANDetails'
import { ACHDetails } from '@/@types/openapi-public/ACHDetails'
import { SWIFTDetails } from '@/@types/openapi-public/SWIFTDetails'
import { MpesaDetails } from '@/@types/openapi-public/MpesaDetails'
import { UPIDetails } from '@/@types/openapi-public/UPIDetails'
import { WalletDetails } from '@/@types/openapi-public/WalletDetails'
import { CheckDetails } from '@/@types/openapi-public/CheckDetails'
import { CashDetails } from '@/@types/openapi-public/CashDetails'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { ReportParameters } from '@/@types/openapi-internal/ReportParameters'
import { Address } from '@/@types/openapi-internal/Address'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { ReportSchema } from '@/@types/openapi-internal/ReportSchema'
import { traceable } from '@/core/xray'

@traceable
export class KenyaSARReportGenerator implements ReportGenerator {
  tenantId!: string
  getType(): InternalReportType {
    return {
      countryCode: 'KE',
      type: 'SAR',
      directSubmission: false,
    }
  }

  public async getPopulatedParameters(
    _c: Case,
    transactions: InternalTransaction[],
    _reporter: Account
  ): Promise<ReportParameters> {
    const firstTxn =
      transactions && transactions.length > 0 ? transactions[0] : undefined

    let firstName, lastName

    if (_reporter && _reporter.name) {
      ;[firstName, lastName] = _reporter ? _reporter.name.split(' ') : ['', '']
    }

    const params = {
      indicators: [],
      report: {
        submission_code: 'E',
        report_code: 'SAR',
        submission_date: new Date().toISOString(),
        currency_code_local:
          firstTxn && firstTxn?.originAmountDetails?.transactionCurrency,
        reporting_person: {
          first_name: firstName,
          last_name: lastName,
          email: _reporter.email,
        },
      },
      transactions:
        transactions?.map((t) => {
          return {
            id: t.transactionId,
            transaction: {
              transaction_number: t.transactionId,
              internal_ref_number: t.transactionId,
              transaction_description: t.reference,
              date_transaction:
                t.timestamp && new Date(t.timestamp).toISOString(),
              transmode_comment: `${t.originPaymentDetails?.method} to ${t.destinationPaymentDetails?.method}`,
              amount_local: t.originAmountDetails?.transactionAmount,
              t_from_my_client: {
                from_account: this.account(
                  t,
                  t.originUser,
                  t.originPaymentDetails
                ),
                from_funds_code: 'E',
                from_country: t.originAmountDetails?.country,
              },
              t_to_my_client: {
                to_account: this.account(
                  t,
                  t.destinationUser,
                  t.destinationPaymentDetails
                ),
                to_funds_code: 'E',
                to_country: t.destinationAmountDetails?.country,
              },
            },
          }
        }) || [],
    }
    return params
  }

  public getSchema(): ReportSchema {
    return {
      transactionSchema: KenyaTransactionSchema,
      reportSchema: KenyaReportSchema,
      indicators,
    }
  }
  public getAugmentedReportParams(report: Report): ReportParameters {
    return report.parameters
  }

  public async generate(
    reportParams: ReportParameters,
    report: Report
  ): Promise<string> {
    const builder = new XMLBuilder()
    const xmlContent = builder.build({
      reentity_id: reportParams.report.reentity_id,
      reentity_branch: reportParams.report.reentity_branch,
      submission_code: reportParams.report.submission_code,
      report_code: 'SAR',
      entity_reference: report.id,
      fiu_ref_number: reportParams.report.fiu_ref_number,
      submission_date: reportParams.report.submission_date,
      currency_code_local: reportParams.report.currency_code_local,
      reporting_person: reportParams.report.reporting_person,
      location: reportParams.report.location,
      reason: reportParams.report.reason,
      action: reportParams.report.action,
      transaction: reportParams.transactions?.map((t) => t.transaction),
      report_indicators:
        reportParams?.indicators?.map((indicator) => ({
          indicator,
        })) ?? [],
    })
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><report>${xmlContent}</report>`
  }

  private address(a: Address): object | undefined {
    if (a.addressLines.length === 0) {
      return
    }
    return {
      address_type: 'B',
      address: a.addressLines[0],
      zip: a.postcode,
      country_code: a.country,
      state: a.state,
    }
  }
  private account(
    t: InternalTransaction | undefined,
    u: InternalBusinessUser | InternalConsumerUser | undefined,
    pd:
      | CardDetails
      | GenericBankAccountDetails
      | IBANDetails
      | ACHDetails
      | SWIFTDetails
      | MpesaDetails
      | UPIDetails
      | WalletDetails
      | CheckDetails
      | CashDetails
      | undefined
  ) {
    if (!u || u?.type === 'CONSUMER') {
      return
    }
    let paymentDetails = {}
    if (pd?.method === 'SWIFT') {
      paymentDetails = {
        institution_name: pd.bankName,
        swift_code: pd.swiftCode,
        account: pd.accountNumber,
        account_name: pd.name,
      }
    } else if (pd?.method === 'IBAN') {
      paymentDetails = {
        institution_name: pd.bankName,
        branch: pd.bankBranchCode,
        iban: pd.IBAN,
        account_name: pd.name,
      }
    } else if (pd?.method === 'CHECK') {
      paymentDetails = {
        account_name: `${pd.name}`,
      }
    }
    return {
      t_entity: this.userToEntity(u),
      personal_account_type: 'KeB',
      opened: new Date(u.createdTimestamp).toISOString(),
      status_code: 'A',
      comments: u.comments
        ? `Comments from case management system: \n\n${u.comments?.join(
            '\n\n'
          )}`
        : '',
      currency_code: t?.originAmountDetails?.transactionCurrency,
      ...paymentDetails,
    }
  }

  private userToEntity(user: InternalBusinessUser) {
    return {
      phones:
        user.legalEntity.contactDetails?.contactNumbers?.map((c) => ({
          tph_contact_type: 'B',
          tph_communication_type: 'L',
          tph_number: c,
        })) || [],
      addresses:
        user.legalEntity.contactDetails?.addresses?.map(this.address) || [],
      director_id:
        user.directors?.map((d) => {
          const passport = d.legalDocuments?.find(
            (l) => l.documentType.toLowerCase() === 'passport'
          )
          const email = d.contactDetails?.emailIds?.slice(0, -1)
          return {
            gender: d.generalDetails.gender,
            first_name: d.generalDetails.name?.firstName,
            last_name: d.generalDetails.name?.lastName,
            nationality1: d.generalDetails.countryOfNationality,
            residence: d.generalDetails.countryOfResidence,
            birthdate: d.generalDetails.dateOfBirth,
            passport_number: passport?.documentNumber,
            passport_country: passport?.documentIssuedCountry,
            email: email,
            addresses: d.contactDetails?.addresses?.map(this.address),
          }
        }) || [],
      incorporation_date:
        user.legalEntity.companyRegistrationDetails?.dateOfRegistration,
      name: user.legalEntity.companyGeneralDetails.legalName,
      commercial_name: user.legalEntity.companyGeneralDetails.legalName,
      incorporation_legal_form:
        user.legalEntity.companyGeneralDetails.legalName,
      incorporation_number:
        user.legalEntity.companyRegistrationDetails?.registrationIdentifier,
      business: user.legalEntity.companyGeneralDetails.businessIndustry?.slice(
        0,
        -1
      ),
      email: user.legalEntity.contactDetails?.emailIds?.slice(0, -1),
      tax_number: user.legalEntity.companyRegistrationDetails?.taxIdentifier,
      tax_registration_number:
        user.legalEntity.companyRegistrationDetails?.registrationIdentifier,
    }
  }
}
