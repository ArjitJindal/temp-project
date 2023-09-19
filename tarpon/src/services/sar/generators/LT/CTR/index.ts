import { XMLBuilder } from 'fast-xml-parser'
import { schema } from './schema'
import { Account } from '@/@types/openapi-internal/Account'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { ReportParameters } from '@/@types/openapi-internal/ReportParameters'
import { InternalReportType, ReportGenerator } from '@/services/sar/generators'
import { account, subject } from '@/services/sar/generators/LT/common'
import { ReportSchema } from '@/@types/openapi-internal/ReportSchema'

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
                  ? 'ORIGIN'
                  : 'DESTINATION',
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
    const builder = new XMLBuilder()
    const xmlContent = builder.build({
      CashTransactionReport: {
        Provider: [{ Code: '' }],
        CtrData: reportParams.transactions,
      },
    })
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${xmlContent}`
  }
}
