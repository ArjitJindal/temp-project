import { readFileSync } from 'fs'
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

export class LithuaniaCTRReportGenerator implements ReportGenerator {
  getType(): InternalReportType {
    return { type: 'CTR', countryCode: 'LT', directSubmission: false }
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
            TransactionDate: t.timestamp
              ? new Date(t.timestamp).toISOString()
              : undefined,
            TransactionValue: {
              Sum: t.originAmountDetails?.transactionAmount,
              Currency: t.originAmountDetails?.transactionCurrency,
            },
            OperationDataItem: {
              ItemDirection:
                _c.caseUsers?.origin?.userId === t.originUser?.userId
                  ? 'GIVER'
                  : 'RECEIVER',
              ...subject(t.originUser),
              OperationValue: {
                Sum: t.originAmountDetails?.transactionAmount,
                Currency: t.originAmountDetails?.transactionCurrency,
              },
              Account: account(t.originPaymentDetails),
            },
            Comments: t.reference,
          },
        }
      }),
    }
  }

  public getSchema(): ReportSchema {
    return {
      reportSchema: schema.properties.CashTransactionReport.properties.Provider,
      transactionSchema:
        schema.properties.CashTransactionReport.properties.CtrData.items,
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
      CashTransactionReport: {
        '@_xmlns': 'urn:lt:fntt:exchange:model:ctr',
        Provider: reportParams?.report?.Code?.map((code: string) => ({
          Code: code,
        })),
        CtrData: reportParams?.transactions?.map((t) => {
          const transactionDate = t?.transaction?.TransactionDate
          const documentIssueDate =
            t?.transaction?.OperationDataItem?.DocumentIssueDate

          return {
            TransactionDate: transactionDate
              ? dayjs(transactionDate).format(DAY_DATE_FORMAT_JS)
              : undefined,
            TransactionType: t?.transaction?.TransactionType,
            RegistrationNumber: t?.transaction?.RegistrationNumber,
            TransactionValue: {
              Sum: t?.transaction?.TransactionValue?.Sum,
              Currency: t?.transaction?.TransactionValue?.Currency,
            },
            OperationType: t?.transaction?.OperationType,
            OperationDataItem: {
              ItemDirection: t?.transaction?.OperationDataItem?.ItemDirection,
              PersonClass: t?.transaction?.OperationDataItem?.PersonClass,
              Title: t?.transaction?.OperationDataItem?.Title,
              FirstName: t?.transaction?.OperationDataItem?.FirstName,
              LastName: t?.transaction?.OperationDataItem?.LastName,
              Code: t?.transaction?.OperationDataItem?.Code,
              Address: t?.transaction?.OperationDataItem?.Address,
              Country: t?.transaction?.OperationDataItem?.Country,
              DocumentNumber: t?.transaction?.OperationDataItem?.DocumentNumber,
              DocumentIssueDate: documentIssueDate
                ? dayjs(documentIssueDate).format(DAY_DATE_FORMAT_JS)
                : undefined,
              Delegate: {
                FirstName:
                  t?.transaction?.OperationDataItem?.Delegate?.FirstName,
                LastName: t?.transaction?.OperationDataItem?.Delegate?.LastName,
                Code: t?.transaction?.OperationDataItem?.Delegate?.Code,
                Address: t?.transaction?.OperationDataItem?.Delegate?.Address,
                Country: t?.transaction?.OperationDataItem?.Delegate?.Country,
                Mandate: t?.transaction?.OperationDataItem?.Delegate?.Mandate,
              },
              OperationValue: {
                Sum: t?.transaction?.OperationDataItem?.OperationValue?.Sum,
                Currency:
                  t?.transaction?.OperationDataItem?.OperationValue?.Currency,
              },
              Account: {
                Bank: t?.transaction?.OperationDataItem?.Account?.Bank,
                IBAN: t?.transaction?.OperationDataItem?.Account?.IBAN,
                AccountOwner:
                  t?.transaction?.OperationDataItem?.Account?.AccountOwner,
              },
            },
          }
        }),
      },
    })

    const xmlRawData = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${xmlContent}`
    const xsdRawData = readFileSync(`${__dirname}/resources/schema.xsd`, 'utf8')

    const xsd = parseXml(xsdRawData)
    const xml = parseXml(xmlRawData)

    const isValid = xml.validate(xsd)

    if (!isValid) {
      console.error(xml.validationErrors)
      throw new createError.BadRequest(`Invalid XML: ${xml.validationErrors}`)
    }

    return xmlRawData
  }
}
