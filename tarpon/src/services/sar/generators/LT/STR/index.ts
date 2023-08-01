import { XMLBuilder } from 'fast-xml-parser'
import { schema } from './schema'
import { Account } from '@/@types/openapi-internal/Account'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { ReportParameters } from '@/@types/openapi-internal/ReportParameters'
import {
  InternalReportType,
  PopulatedSchema,
  ReportGenerator,
} from '@/services/sar/generators'
import { account, subject } from '@/services/sar/generators/LT/common'

export class LithuaniaSTRReportGenerator implements ReportGenerator {
  getType(): InternalReportType {
    return { type: 'STR', countryCode: 'LT' }
  }
  async getPopulatedSchema(
    _reportId: string,
    _c: Case,
    transactions: InternalTransaction[],
    _reporter: Account
  ): Promise<PopulatedSchema> {
    return {
      schema: {
        reportSchema:
          schema.properties.SuspiciousTransactionReport.properties.Provider,
        transactionSchema:
          schema.properties.SuspiciousTransactionReport.properties.StrData
            .items,
        settings: {
          propertyNameStyle: 'CAMEL_CASE',
        },
      },
      params: {
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
      },
    }
  }

  public generate(reportParams: ReportParameters): string {
    const builder = new XMLBuilder()
    const xmlContent = builder.build({
      SuspiciousTransactionReport: {
        Provider: [{ Code: '' }],
        StrData: reportParams.transactions,
      },
    })
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${xmlContent}`
  }
}
