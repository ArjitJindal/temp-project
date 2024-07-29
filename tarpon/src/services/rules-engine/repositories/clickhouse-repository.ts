import { ClickHouseClient } from '@clickhouse/client'
import { traceable } from '../../../core/xray'
import { offsetPaginateClickhouse } from '../../../utils/pagination'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { DefaultApiGetTransactionsV2ListRequest } from '@/@types/openapi-internal/RequestParameters'
import { sanitizeTableName } from '@/utils/clickhouse-utils'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { DEFAULT_PAGE_SIZE, OptionalPagination } from '@/utils/pagination'
import { TransactionsResponseOffsetPaginated } from '@/@types/openapi-internal/TransactionsResponseOffsetPaginated'

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

    const data = await offsetPaginateClickhouse<InternalTransaction>(
      this.clickhouseClient,
      sanitizeTableName(TRANSACTIONS_COLLECTION(this.tenantId)),
      {
        page: params.page,
        pageSize: (params.pageSize || DEFAULT_PAGE_SIZE) as number,
        sortField: params.sortField ?? 'timestamp',
        sortOrder: params.sortOrder,
      },
      whereClause
    )

    return {
      items: data.items,
      count: data.count,
    }
  }
}
