import { XMLBuilder } from 'fast-xml-parser'
import { BadRequest } from 'http-errors'
import { schema } from './schema'
import { Account } from '@/@types/openapi-internal/Account'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { ReportParameters } from '@/@types/openapi-internal/ReportParameters'
import {
  GenerateResult,
  InternalReportType,
  ReportGenerator,
} from '@/services/sar/generators'
import {
  account,
  ajvLithuaniaValidator,
  subject,
} from '@/services/sar/generators/LT/common'
import { ReportSchema } from '@/@types/openapi-internal/ReportSchema'
import { Report } from '@/@types/openapi-internal/Report'
import dayjs from '@/utils/dayjs'
import { DAY_DATE_FORMAT_JS } from '@/core/constants'
import { traceable } from '@/core/xray'

@traceable
export class LithuaniaSTRReportGenerator implements ReportGenerator {
  getType(): InternalReportType {
    return {
      type: 'STR',
      countryCode: 'LT',
      directSubmission: false,
      subjectTypes: ['CASE'],
    }
  }
  public async getUserPopulatedParameters(): Promise<ReportParameters> {
    throw new Error(`User subject is not supported`)
  }
  async getPopulatedParameters(
    _c: Case,
    transactions: InternalTransaction[],
    _reporter: Account
  ): Promise<ReportParameters> {
    return {
      transactions: transactions.map((t) => {
        return {
          id: t.transactionId,
          transaction: {
            StrData: {
              ReportNumber: t.transactionId,
              TransactionDate: t.timestamp
                ? new Date(t.timestamp).toISOString()
                : undefined,
              Description: t.reference,
              TransactionValue: [
                {
                  Sum: t.originAmountDetails?.transactionAmount,
                  Currency: t.originAmountDetails?.transactionCurrency,
                },
                {
                  Sum: t.destinationAmountDetails?.transactionAmount,
                  Currency: t.destinationAmountDetails?.transactionCurrency,
                },
              ],
              TransactionSubject: [
                subject(t.originUser),
                subject(t.destinationUser),
              ],
              Account: [
                account(t.originPaymentDetails),
                account(t.destinationPaymentDetails),
              ],
            },
          },
        }
      }),
    }
  }

  public getSchema(): ReportSchema {
    delete (schema as any).definitions.StrDataType.properties.StrFiles

    return {
      reportSchema: {
        definitions: schema.definitions,
        type: 'object',
        properties: {
          Provider: schema.properties.ProviderType,
        },
        required: ['Provider'],
      },
      transactionSchema: {
        definitions: schema.definitions,
        type: 'object',
        properties: {
          StrData: schema.properties.StrDataType,
        },
        required: ['StrData'],
      },
      settings: {
        propertyNameStyle: 'CAMEL_CASE',
      },
    }
  }
  public getAugmentedReportParams(report: Report): ReportParameters {
    return report.parameters
  }
  public async generate(
    reportParams: ReportParameters
  ): Promise<GenerateResult> {
    const builder = new XMLBuilder({
      attributeNamePrefix: '@_',
      ignoreAttributes: false,
    })
    const strData = reportParams.transactions?.map((t) => {
      const transactionDate = t?.transaction?.StrData?.TransactionDate

      const data = {
        TransactionDate: transactionDate
          ? dayjs(transactionDate).format(DAY_DATE_FORMAT_JS)
          : undefined,
        ReportNumber: t?.transaction?.StrData?.ReportNumber,
        RelatedReports: t?.transaction?.StrData?.RelatedReports,
        ReportType: t?.transaction?.StrData?.ReportType,
        OperationType: t?.transaction?.StrData?.OperationType,
        StopDate: t?.transaction?.StrData?.StopDate,
        NonStopReason: t?.transaction?.StrData?.NonStopReason,
        Description: t?.transaction?.StrData?.Description,
        Suspicion: t?.transaction?.StrData?.Suspicion?.map((s) => ({
          SuspicionCode: s?.SuspicionCode,
          SuspicionTitle: s?.SuspicionTitle,
        })),
        TransactionValue: t?.transaction?.StrData?.TransactionValue?.map(
          (v) => {
            const stoppingDate = v?.StoppingDate

            return {
              Sum: v?.Sum,
              Currency: v?.Currency,
              StoppingDate: stoppingDate
                ? dayjs(stoppingDate).format(DAY_DATE_FORMAT_JS)
                : undefined,
            }
          }
        ),
        TransactionSubject: t?.transaction?.StrData?.TransactionSubject?.map(
          (s) => {
            const birthDate = s?.BirthDate
            const documentIssueDate = s?.DocumentIssueDate

            return {
              SubjectType: s?.SubjectType,
              Country: s?.Country,
              Citizenship: s?.Citizenship,
              Code: s?.Code,
              BirthDate: birthDate
                ? dayjs(birthDate).format(DAY_DATE_FORMAT_JS)
                : undefined,
              Title: s.Title,
              FirstName: s?.FirstName,
              LastName: s?.LastName,
              DocumentType: s?.DocumentType,
              DocumentNumber: s?.DocumentNumber,
              DocumentIssueDate: documentIssueDate
                ? dayjs(documentIssueDate).format(DAY_DATE_FORMAT_JS)
                : undefined,
              Address: s?.Address,
              PhoneNumber: s?.PhoneNumber,
              MainActivity: s?.MainActivity,
            }
          }
        ),
        Account: t?.transaction?.StrData?.Account?.map((a) => {
          const openingDate = a?.OpeningDate
          const closingDate = a?.ClosingDate

          return {
            Bank: a?.Bank,
            IBAN: a?.IBAN,
            AccountOwner: a?.AccountOwner,
            OpeningDate: openingDate
              ? dayjs(openingDate).format(DAY_DATE_FORMAT_JS)
              : undefined,
            ClosingDate: closingDate
              ? dayjs(closingDate).format(DAY_DATE_FORMAT_JS)
              : undefined,
            OtherInformation: a.OtherInformation,
            SubjectCode: a?.SubjectCode,
          }
        }),
      }

      return data
    })

    const Provider = {
      Code: reportParams?.report?.Provider?.Code,
    }

    const strSchema = schema

    const validate = ajvLithuaniaValidator.compile(strSchema)

    const valid = validate({
      SuspiciousTransactionReport: {
        Provider: Provider,
        StrData: strData,
      },
    })

    if (!valid) {
      throw new BadRequest(
        `Invalid report parameters: ${JSON.stringify(
          validate.errors?.map((error) => error.message)
        )}`
      )
    }

    const xmlContent = builder.build({
      SuspiciousTransactionReport: {
        '@_xmlns': 'urn:lt:fntt:exchange:model:str',
        Provider: Provider,
        StrData: strData,
      },
    })

    const xmlRawData = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${xmlContent}`

    return {
      type: 'STRING',
      value: xmlRawData,
    }
  }
}
