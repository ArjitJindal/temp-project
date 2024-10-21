import { XMLBuilder } from 'fast-xml-parser'
import * as createError from 'http-errors'
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
import { DAY_DATE_FORMAT_JS } from '@/utils/mongodb-utils'
import { traceable } from '@/core/xray'

@traceable
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
            CtrData: {
              TransactionDate: t.timestamp
                ? new Date(t.timestamp).toISOString()
                : undefined,
              TransactionValue: {
                Sum: t.originAmountDetails?.transactionAmount,
                Currency: t.originAmountDetails?.transactionCurrency,
              },
              OperationDataItem: [
                {
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
              ],
              Comments: t.reference,
            },
          },
        }
      }),
    }
  }

  public getSchema(): ReportSchema {
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
          CtrData: schema.properties.CtrDataType,
        },
        required: ['CtrData'],
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

    const provider = {
      Code: reportParams?.report?.Provider?.Code,
    }

    const ctrData = reportParams?.transactions?.map((t) => {
      const transactionDate = t?.transaction?.CtrData?.TransactionDate

      return {
        TransactionDate: transactionDate
          ? dayjs(transactionDate).format(DAY_DATE_FORMAT_JS)
          : undefined,
        TransactionType: t?.transaction?.CtrData?.TransactionType,
        RegistrationNumber: t?.transaction?.CtrData?.RegistrationNumber,
        TransactionValue: {
          Sum: t?.transaction?.CtrData?.TransactionValue?.Sum,
          Currency: t?.transaction?.CtrData?.TransactionValue?.Currency,
        },
        OperationType: t?.transaction?.CtrData?.OperationType,
        OperationDataItem: t.transaction?.CtrData?.OperationDataItem?.map(
          (o) => {
            const documentIssueDate = o?.DocumentIssueDate

            return {
              ItemDirection: o?.ItemDirection,
              PersonClass: String(o?.PersonClass),
              Title: o?.Title,
              FirstName: o?.FirstName,
              LastName: o?.LastName,
              Code: o?.Code,
              Address: o?.Address,
              Country: o?.Country,
              DocumentNumber: o?.DocumentNumber,
              DocumentIssueDate: documentIssueDate
                ? dayjs(documentIssueDate).format(DAY_DATE_FORMAT_JS)
                : undefined,
              Delegate: {
                FirstName: o?.Delegate?.FirstName,
                LastName: o?.Delegate?.LastName,
                Code: o?.Delegate?.Code,
                Address: o?.Delegate?.Address,
                Country: o?.Delegate?.Country,
                Mandate: o?.Delegate?.Mandate,
              },
              OperationValue: {
                Sum: o?.OperationValue?.Sum,
                Currency: o?.OperationValue?.Currency,
              },
              Account: {
                Bank: o?.Account?.Bank,
                IBAN: o?.Account?.IBAN,
                AccountOwner: o?.Account?.AccountOwner,
              },
            }
          }
        ),
      }
    })

    const ctrSchema = schema
    const validate = ajvLithuaniaValidator.compile(ctrSchema)
    const valid = validate({
      CashTransactionReport: {
        Provider: provider,
        CtrData: ctrData,
      },
    })

    if (!valid) {
      console.error('validate.errors', JSON.stringify(validate.errors, null, 2))
      throw new createError.BadRequest(
        `Invalid parameters: ${validate.errors
          ?.map((error) => error.message)
          .join(', ')}`
      )
    }

    const xmlContent = builder.build({
      CashTransactionReport: {
        '@_xmlns': 'urn:lt:fntt:exchange:model:ctr',
        Provider: provider,
        CtrData: ctrData,
      },
    })

    const xmlRawData = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${xmlContent}`

    return {
      type: 'STRING',
      value: xmlRawData,
    }
  }
}
