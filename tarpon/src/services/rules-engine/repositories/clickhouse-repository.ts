import { ClickHouseClient } from '@clickhouse/client'
import { compact } from 'lodash'
import { traceable } from '../../../core/xray'
import { offsetPaginateClickhouse } from '../../../utils/pagination'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { DefaultApiGetTransactionsV2ListRequest } from '@/@types/openapi-internal/RequestParameters'
import { DEFAULT_PAGE_SIZE, OptionalPagination } from '@/utils/pagination'
import { TransactionsResponseOffsetPaginated } from '@/@types/openapi-internal/TransactionsResponseOffsetPaginated'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { getSortedData } from '@/utils/clickhouse/utils'

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
        `arrayExists(x -> x = '${params.filterRuleInstancesHit}', ruleInstancesHit)`
      )
    }

    if (params.filterRuleInstancesExecuted?.length) {
      whereConditions.push(
        `arrayExists(x -> x = '${params.filterRuleInstancesExecuted}', ruleInstancesExecuted)`
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

    const data = await offsetPaginateClickhouse<InternalTransaction>(
      this.clickhouseClient,
      CLICKHOUSE_DEFINITIONS.TRANSACTIONS.materializedViews.BY_ID.table,
      CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName,
      { page, pageSize, sortField, sortOrder },
      whereClause,
      {
        excludeSortField: sortField === 'timestamp' && sortOrder === 'ascend',
        bypassNestedQuery:
          sortField === 'timestamp' && sortOrder === 'ascend' && page <= 20,
      }
    )

    const sortedTransactions = getSortedData<InternalTransaction>({
      data: data.items,
      sortField,
      sortOrder,
      groupByField: 'transactionId',
      groupBySortField: 'updatedAt',
    })

    const finalTransactions = sortedTransactions.map((transaction) => {
      if (!transaction) {
        return null
      }

      delete (transaction as any)?.executedRules
      delete (transaction as any)?.arsScore?.components
      delete (transaction as any)?.originDeviceData
      delete (transaction as any)?.destinationDeviceData

      const originPaymentDetails = transaction.originPaymentDetails
      const destinationPaymentDetails = transaction.destinationPaymentDetails

      return {
        ...transaction,
        originPaymentDetails: {
          method: originPaymentDetails?.method,
        },
        destinationPaymentDetails: {
          method: destinationPaymentDetails?.method,
        },
      }
    }) as InternalTransaction[]

    return {
      items: compact(finalTransactions),
      count: data.count,
    }
  }
}
