import { ClickHouseClient } from '@clickhouse/client'
import { compact } from 'lodash'
import { traceable } from '../../../core/xray'
import { offsetPaginateClickhouse } from '../../../utils/pagination'
import { DefaultApiGetTransactionsV2ListRequest } from '@/@types/openapi-internal/RequestParameters'
import { DEFAULT_PAGE_SIZE, OptionalPagination } from '@/utils/pagination'
import { TransactionsResponseOffsetPaginated } from '@/@types/openapi-internal/TransactionsResponseOffsetPaginated'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { getSortedData } from '@/utils/clickhouse/utils'
import { CurrencyCode } from '@/@types/openapi-internal/CurrencyCode'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { Tag } from '@/@types/openapi-public/Tag'
import { CountryCode } from '@/@types/openapi-public/CountryCode'
import {
  PaymentDetails,
  PaymentMethod,
} from '@/@types/tranasction/payment-type'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { TransactionState } from '@/@types/openapi-internal/TransactionState'
import { OriginFundsInfo } from '@/@types/openapi-internal/OriginFundsInfo'
import { TransactionTableItem } from '@/@types/openapi-internal/TransactionTableItem'
import { TableListViewEnum } from '@/@types/openapi-internal/TableListViewEnum'

@traceable
export class ClickhouseTransactionsRepository {
  private tenantId: string
  private clickhouseClient: ClickHouseClient

  constructor(tenantId: string, clickhouseClient: ClickHouseClient) {
    this.tenantId = tenantId
    this.clickhouseClient = clickhouseClient
  }

  private async getTransactionsWhereConditions(
    params: OptionalPagination<DefaultApiGetTransactionsV2ListRequest>
  ): Promise<string> {
    const whereConditions: string[] = []

    if (params.filterId) {
      whereConditions.push(`id = '${params.filterId}'`)
    }

    if (params.filterIdList?.length) {
      whereConditions.push(`id IN ('${params.filterIdList.join("','")}')`)
    }

    if (params.filterUserId) {
      whereConditions.push(
        `(originUserId = '${params.filterUserId}' OR destinationUserId = '${params.filterUserId}')`
      )
    }

    if (params.filterTagKey || params.filterTagValue) {
      if (!params.filterTagValue) {
        whereConditions.push(
          `arrayExists(x -> x.key = '${params.filterTagKey}', tags)`
        )
      } else {
        whereConditions.push(
          `arrayExists(x -> x.key = '${params.filterTagKey}' AND x.value = '${params.filterTagValue}', tags)`
        )
      }
    }

    if (params.afterTimestamp != null) {
      whereConditions.push(`timestamp >= ${params.afterTimestamp}`)
    }

    if (params.beforeTimestamp != null) {
      whereConditions.push(`timestamp <= ${params.beforeTimestamp}`)
    }

    if (params.filterOriginCountries?.length) {
      whereConditions.push(
        `originAmountDetails_country IN ('${params.filterOriginCountries.join(
          "' , '"
        )}')`
      )
    }

    if (params.filterDestinationCountries?.length) {
      whereConditions.push(
        `destinationAmountDetails_country IN ('${params.filterDestinationCountries.join(
          "' , '"
        )}')`
      )
    }

    if (params.filterProductType?.length) {
      whereConditions.push(
        `productType IN ('${params.filterProductType.join("','")}')`
      )
    }

    if (params.filterTransactionState?.length) {
      whereConditions.push(
        `transactionState IN ('${params.filterTransactionState.join("','")}')`
      )
    }

    if (params.filterOriginUserId) {
      whereConditions.push(`originUserId = '${params.filterOriginUserId}'`)
    }

    if (params.filterDestinationUserId) {
      whereConditions.push(
        `destinationUserId = '${params.filterDestinationUserId}'`
      )
    }

    if (params.transactionType) {
      whereConditions.push(`type = '${params.transactionType}'`)
    }

    if (params.filterStatus?.length) {
      whereConditions.push(`status = '${params.filterStatus}'`)
    }

    if (params.filterDestinationCurrencies?.length) {
      whereConditions.push(
        `destinationAmountDetails_transactionCurrency IN ('${params.filterDestinationCurrencies.join(
          "' , '"
        )}')`
      )
    }

    if (params.filterOriginCurrencies?.length) {
      whereConditions.push(
        `originAmountDetails_transactionCurrency IN ('${params.filterOriginCurrencies.join(
          "' , '"
        )}')`
      )
    }

    if (params.filterOriginPaymentMethodId) {
      whereConditions.push(
        `originPaymentMethodId = '${params.filterOriginPaymentMethodId}'`
      )
    }

    if (params.filterDestinationPaymentMethodId) {
      whereConditions.push(
        `destinationPaymentMethodId = '${params.filterDestinationPaymentMethodId}'`
      )
    }

    if (params.filterRuleInstancesHit?.length) {
      whereConditions.push(
        `arrayExists(x -> has([${params.filterRuleInstancesHit
          .map((ruleInstanceHit) => `'${ruleInstanceHit}'`)
          .join(',')}], x), ruleInstancesHit)`
      )
    }

    if (params.filterRuleInstancesExecuted?.length) {
      whereConditions.push(
        `arrayExists(x -> has([
        ${params.filterRuleInstancesExecuted
          .map((ruleInstanceExecuted) => `'${ruleInstanceExecuted}'`)
          .join(',')}], x), ruleInstancesExecuted)`
      )
    }

    if (params.filterOriginPaymentMethods?.length) {
      whereConditions.push(
        `originPaymentMethod IN ('${params.filterOriginPaymentMethods.join(
          "' , '"
        )}')`
      )
    }

    if (params.filterDestinationPaymentMethods?.length) {
      whereConditions.push(
        `destinationPaymentMethod IN ('${params.filterDestinationPaymentMethods.join(
          "' , '"
        )}')`
      )
    }

    return whereConditions.length ? `${whereConditions.join(' AND ')}` : ''
  }

  async getTransactions(
    params: OptionalPagination<DefaultApiGetTransactionsV2ListRequest>
  ): Promise<TransactionsResponseOffsetPaginated> {
    const whereClause = await this.getTransactionsWhereConditions(params)

    const sortField = params.sortField ?? 'timestamp'
    const sortOrder = params.sortOrder ?? 'ascend'
    const page = params.page ?? 1
    const pageSize = (params.pageSize || DEFAULT_PAGE_SIZE) as number

    const columnsProjection = {
      transactionId: 'id',
      timestamp: "JSONExtractFloat(data, 'timestamp')",
      updatedAt: "JSONExtractFloat(data, 'updatedAt')",
      arsScore: "JSONExtractFloat(data, 'arsScore', 'arsScore')",
      destinationPaymentMethodId:
        "JSONExtractString(data, 'destinationPaymentMethodId')",
      originPaymentMethodId: "JSONExtractString(data, 'originPaymentMethodId')",
      destinationAmountDetails_amount:
        "JSONExtractFloat(data, 'destinationAmountDetails', 'transactionAmount')",
      destinationAmountDetails_transactionCurrency:
        "JSONExtractString(data, 'destinationAmountDetails', 'transactionCurrency')",
      originAmountDetails_amount:
        "JSONExtractFloat(data, 'originAmountDetails', 'transactionAmount')",
      originAmountDetails_transactionCurrency:
        "JSONExtractString(data, 'originAmountDetails', 'transactionCurrency')",
      destinationUserId: "JSONExtractString(data, 'destinationUserId')",
      originUserId: "JSONExtractString(data, 'originUserId')",
      type: "JSONExtractString(data, 'type')",
      tags: "JSONExtractRaw(data, 'tags')",
      originPaymentMethod:
        "JSONExtractString(data, 'originPaymentDetails', 'method')",
      destinationPaymentMethod:
        "JSONExtractString(data, 'destinationPaymentDetails', 'method')",
      originCountry:
        "JSONExtractString(data, 'originAmountDetails', 'country')",
      destinationCountry:
        "JSONExtractString(data, 'destinationAmountDetails', 'country')",
      ...(params.includePaymentDetails
        ? {
            originPaymentDetails:
              "JSONExtractRaw(data, 'originPaymentDetails')",
            destinationPaymentDetails:
              "JSONExtractRaw(data, 'destinationPaymentDetails')",
          }
        : {}),
      productType: "JSONExtractString(data, 'productType')",
      state: "JSONExtractString(data, 'transactionState')",
      status: "JSONExtractString(data, 'status')",
      reference: "JSONExtractString(data, 'reference')",
      ...(params.includeRuleHitDetails &&
      params.view === ('TABLE' as TableListViewEnum)
        ? {
            hitRules:
              "toJSONString(JSONExtract(data, 'hitRules', 'Array(Tuple(ruleName String, ruleDescription String))'))",
          }
        : {}),
      isAnySanctionsExecutedRules:
        "length(flatten(arrayMap(y -> y.searchId, arrayMap(x -> x.ruleHitMeta.sanctionsDetails, JSONExtract(data, 'executedRules', 'Array(Tuple(ruleHitMeta Tuple(sanctionsDetails Array(Tuple(searchId String)))))'))))) > 0",
      originFundsInfo:
        "JSONExtract(data, 'originFundsInfo', 'Tuple(sourceOfFunds String, sourceOfWealth String)')",
    }

    const sortFieldMapper: Record<string, string> = {
      'originPayment.amount': 'originAmountDetails.transactionAmount',
      'destinationPayment.amount': 'destinationAmountDetails.transactionAmount',
      'ars.score': 'arsScore.arsScore',
    }

    const newSortField = sortFieldMapper[sortField] ?? sortField

    const data = await offsetPaginateClickhouse<TransactionTableItem>(
      this.clickhouseClient,
      CLICKHOUSE_DEFINITIONS.TRANSACTIONS.materializedViews.BY_ID.table,
      CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName,
      { page, pageSize, sortField: newSortField, sortOrder },
      whereClause,
      columnsProjection,
      (item) => {
        const destinationPaymentDetails = item.destinationPaymentDetails
          ? (JSON.parse(
              item.destinationPaymentDetails as string
            ) as PaymentDetails)
          : undefined

        const originPaymentDetails = item.originPaymentDetails
          ? (JSON.parse(item.originPaymentDetails as string) as PaymentDetails)
          : undefined

        return {
          transactionId: item.transactionId as string,
          timestamp: item.timestamp as number,
          updatedAt: item.updatedAt as number,
          ars: { score: item.arsScore as number },
          destinationPayment: {
            paymentMethodId: item.destinationPaymentMethodId as string,
            amount: item.destinationAmountDetails_amount as number,
            currency:
              item.destinationAmountDetails_transactionCurrency as CurrencyCode,
            country: item.destinationCountry as CountryCode,
            paymentDetails: params.includePaymentDetails
              ? destinationPaymentDetails
              : ({
                  method: item.destinationPaymentMethod as PaymentMethod,
                } as PaymentDetails),
          },
          originPayment: {
            paymentMethodId: item.originPaymentMethodId as string,
            amount: item.originAmountDetails_amount as number,
            currency:
              item.originAmountDetails_transactionCurrency as CurrencyCode,
            country: item.originCountry as CountryCode,
            paymentDetails: params.includePaymentDetails
              ? originPaymentDetails
              : ({
                  method: item.originPaymentMethod as PaymentMethod,
                } as PaymentDetails),
          },
          destinationUser: { id: item.destinationUserId as string },
          originUser: { id: item.originUserId as string },
          type: item.type as TransactionType,
          tags: (item.tags as string)?.length
            ? (JSON.parse(item.tags as string) as Tag[])
            : undefined,
          productType: item.productType as string,
          status: item.status as RuleAction,
          transactionState: item.state as TransactionState,
          reference: item.reference as string,
          isAnySanctionsExecutedRules: Boolean(
            item.isAnySanctionsExecutedRules
          ),
          hitRules: item.hitRules
            ? (JSON.parse(item.hitRules as string) as {
                ruleName: string
                ruleDescription: string
              }[])
            : undefined,
          originFundsInfo: item.originFundsInfo as OriginFundsInfo,
        }
      }
    )

    const sortedTransactions = getSortedData<TransactionTableItem>({
      data: data.items,
      sortField,
      sortOrder,
      groupByField: 'transactionId',
      groupBySortField: 'updatedAt',
    })

    return {
      items: compact(sortedTransactions),
      count: data.count,
    }
  }
}
