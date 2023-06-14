import * as xml2js from 'xml2js'
import { ReportGenerator } from '../..'
import { indicators, KenyaReportSchema, KenyaTransactionSchema } from './schema'
import { Case } from '@/@types/openapi-internal/Case'
import { ReportSchema } from '@/@types/openapi-internal/ReportSchema'
import { Account } from '@/@types/openapi-internal/Account'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
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
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { ReportParameters } from '@/@types/openapi-internal/ReportParameters'

export class KenyaSARReportGenerator implements ReportGenerator {
  getSchema(): ReportSchema {
    return {
      id: 'KE-SAR',
      type: 'SAR',
      country: 'KE',
      transactionSchema: KenyaTransactionSchema,
      reportSchema: KenyaReportSchema,
      indicators,
    }
  }

  public prepopulate(
    c: Case,
    transactionIds: string[],
    _reporter: Account
  ): ReportParameters {
    const transactions = c.caseTransactions?.filter(
      (t) => transactionIds.indexOf(t.transactionId) > -1
    )
    const firstTxn =
      transactions && transactions.length > 0 ? transactions[0] : undefined

    let firstName, lastName

    if (_reporter && _reporter.name) {
      ;[firstName, lastName] = _reporter ? _reporter.name.split(' ') : ['', '']
    }

    return {
      indicators: [],
      report: {
        submission_code: 'E',
        report_code: 'SAR',
        entity_reference: c.caseId,
        submission_date: new Date().toISOString(),
        currency_code_local:
          firstTxn && firstTxn?.originAmountDetails?.transactionCurrency,
        reporting_person: [
          {
            first_name: firstName,
            last_name: lastName,
            email: _reporter.email,
          },
        ],
        location: [],
      },
      transactions:
        transactions?.map((t) => {
          return {
            id: t.transactionId,
            transaction: {
              t_from_my_client: {
                from_account: this.account(
                  t,
                  t.originUser,
                  t.originPaymentDetails
                ),
                from_person: this.person(t.originUser),
              },
              t_to_my_client: {
                to_account: this.account(
                  t,
                  t.destinationUser,
                  t.destinationPaymentDetails
                ),
                to_person: this.person(t.originUser),
              },
              amount_local: t.originAmountDetails?.transactionAmount,
              date_transaction:
                t.createdAt && new Date(t.createdAt as number).toISOString(),
              goods_services: [],
              internal_ref_number: t.transactionId,

              transaction_location: t.originAmountDetails?.country,
              transaction_number: t.transactionId,
            },
          }
        }) || [],
    }
  }

  public generate(reportParams: ReportParameters): string {
    const builder = new xml2js.Builder()
    return builder.buildObject({
      ...reportParams.report,
      transaction: reportParams.transactions.map((t) => t.transaction),
      indicators: reportParams.indicators,
    })
  }

  private account(
    t: InternalTransaction | undefined,
    u: InternalConsumerUser | InternalBusinessUser | undefined,
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
      | undefined
  ) {
    let paymentDetails = {}
    if (pd?.method === 'SWIFT') {
      paymentDetails = {
        institution_name: pd.bankName,
        swift_code: pd.swiftCode,
        account: pd.accountNumber,
        currency_code: t?.originAmountDetails?.transactionCurrency,
        account_name: pd.name,
      }
    }
    if (pd?.method === 'IBAN') {
      paymentDetails = {
        institution_name: pd.bankName,
        branch: pd.bankBranchCode,
        iban: pd.IBAN,
        currency_code: t?.originAmountDetails?.transactionCurrency,
        account_name: pd.name,
      }
    }
    if (u?.type === 'BUSINESS') {
      return paymentDetails
    }
  }

  private person(u: InternalConsumerUser | InternalBusinessUser | undefined) {
    if (u?.type === 'CONSUMER') {
      return [
        {
          first_name: u?.userDetails?.name.firstName,
          middle_name: u?.userDetails?.name.middleName,
          last_name: u?.userDetails?.name.lastName,
          addresses: u?.contactDetails?.addresses?.map((a) => {
            return {
              address_type: '',
              address: a.addressLines[0],
              city: a.city,
              zip: a.postcode,
              state: a.state,
            }
          }),
          nationality1: u?.userDetails?.countryOfNationality,
        },
      ]
    }
  }
}
