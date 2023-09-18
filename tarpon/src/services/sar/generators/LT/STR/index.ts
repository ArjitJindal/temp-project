import fs from 'fs'
import { XMLBuilder } from 'fast-xml-parser'
import { parseXml } from 'libxmljs'
import * as createError from 'http-errors'
import { schema } from './schema'
import { Account } from '@/@types/openapi-internal/Account'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { ReportParameters } from '@/@types/openapi-internal/ReportParameters'
import { InternalReportType, ReportGenerator } from '@/services/sar/generators'
import { account, subject } from '@/services/sar/generators/LT/common'
import { ReportSchema } from '@/@types/openapi-internal/ReportSchema'
import dayjs from '@/utils/dayjs'
import { DAY_DATE_FORMAT_JS } from '@/utils/mongodb-utils'

export class LithuaniaSTRReportGenerator implements ReportGenerator {
  getType(): InternalReportType {
    return { type: 'STR', countryCode: 'LT', directSubmission: false }
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
            ReportNumber: t.transactionId,
            TransactionDate: t.timestamp
              ? new Date(t.timestamp).toISOString()
              : undefined,
            Description: t.reference,
            TransactionValue: {
              Sum: t.originAmountDetails?.transactionAmount,
              Currency: t.originAmountDetails?.transactionCurrency,
            },
            TransactionSubject: subject(t.originUser),
            Account: account(t.originPaymentDetails),
          },
        }
      }),
    }
  }

  public getSchema(): ReportSchema {
    return {
      reportSchema:
        schema.properties.SuspiciousTransactionReport.properties.Provider,
      transactionSchema:
        schema.properties.SuspiciousTransactionReport.properties.StrData.items,
      settings: {
        propertyNameStyle: 'CAMEL_CASE',
      },
    }
  }

  public generate(reportParams: ReportParameters): string {
    const builder = new XMLBuilder({
      attributeNamePrefix: '@_',
      ignoreAttributes: false,
    })

    const xmlContent = builder.build({
      SuspiciousTransactionReport: {
        '@_xmlns': 'urn:lt:fntt:exchange:model:str',
        Provider: reportParams.report?.Code?.map((c: string) => ({
          Code: c,
        })),
        StrData: reportParams.transactions?.map((t) => {
          const transactionDate = t?.transaction?.TransactionDate
          const stoppingDate = t?.transaction?.TransactionValue?.StoppingDate
          const openingDate = t?.transaction?.Account?.OpeningDate
          const closingDate = t?.transaction?.Account?.ClosingDate
          const birthDate = t?.transaction?.TransactionSubject?.BirthDate
          const documentIssueDate =
            t?.transaction?.TransactionSubject?.DocumentIssueDate

          const data = {
            TransactionDate: transactionDate
              ? dayjs(transactionDate).format(DAY_DATE_FORMAT_JS)
              : undefined,
            ReportNumber: t?.transaction?.ReportNumber,
            RelatedReports: t?.transaction?.RelatedReports,
            ReportType: t?.transaction.ReportType,
            OperationType: t.transaction?.OperationType,
            StopDate: t?.transaction?.StopDate,
            NonStopReason: t?.transaction?.NonStopReason,
            Description: t?.transaction?.Description,
            Suspicion: {
              SuspicionCode: t?.transaction?.Suspicion?.SuspicionCode,
              SuspicionTitle: t?.transaction?.Suspicion?.SuspicionTitle,
            },
            TransactionValue: {
              Sum: t?.transaction?.TransactionValue?.Sum,
              Currency: t?.transaction?.TransactionValue?.Currency,
              StoppingDate: stoppingDate
                ? dayjs(stoppingDate).format(DAY_DATE_FORMAT_JS)
                : undefined,
            },
            TransactionSubject: {
              SubjectType: t?.transaction?.TransactionSubject?.SubjectType,
              Country: t?.transaction?.TransactionSubject?.Country,
              Citizenship: t?.transaction?.TransactionSubject?.Citizenship,
              Code: t?.transaction?.TransactionSubject?.Code,
              BirthDate: birthDate
                ? dayjs(birthDate).format(DAY_DATE_FORMAT_JS)
                : undefined,
              Title: t?.transaction?.TransactionSubject?.Title,
              FirstName: t?.transaction?.TransactionSubject?.FirstName,
              LastName: t?.transaction?.TransactionSubject?.LastName,
              DocumentType: t?.transaction?.TransactionSubject?.DocumentType,
              DocumentNumber:
                t?.transaction?.TransactionSubject?.DocumentNumber,
              DocumentIssueDate: documentIssueDate
                ? dayjs(documentIssueDate).format(DAY_DATE_FORMAT_JS)
                : undefined,
              Address: t?.transaction?.TransactionSubject?.Address,
              PhoneNumber: t?.transaction?.TransactionSubject?.PhoneNumber,
              MainActivity: t?.transaction?.TransactionSubject?.MainActivity,
            },
            Account: {
              Bank: t?.transaction?.Account?.Bank,
              IBAN: t?.transaction?.Account?.IBAN,
              AccountOwner: t?.transaction?.Account?.AccountOwner,
              OpeningDate: openingDate
                ? dayjs(openingDate).format(DAY_DATE_FORMAT_JS)
                : undefined,
              ClosingDate: closingDate
                ? dayjs(closingDate).format(DAY_DATE_FORMAT_JS)
                : undefined,
              OtherInformation: t?.transaction?.Account?.OtherInformation,
              SubjectCode: t?.transaction?.Account?.SubjectCode,
            },
          }

          return data
        }),
      },
    })

    const xmlRawData = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${xmlContent}`
    const xsdRawData = fs.readFileSync(
      `${__dirname}/resources/schema.xsd`,
      'utf8'
    )
    const xsd = parseXml(xsdRawData)
    const xml = parseXml(xmlRawData)

    const isValid = xml.validate(xsd)
    const validationErrors = xml.validationErrors

    if (!isValid) {
      console.error(`XML validation failed ${validationErrors}`)
      throw new createError.BadRequest(
        `XML validation failed ${validationErrors.toString()}`
      )
    }
    return xmlRawData
  }
}
