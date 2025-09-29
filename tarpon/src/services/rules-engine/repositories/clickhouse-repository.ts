import { ClickHouseClient } from '@clickhouse/client'
import compact from 'lodash/compact'
import round from 'lodash/round'
import dayjsLib from '@flagright/lib/utils/dayjs'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { traceable } from '../../../core/xray'
import {
  offsetPaginateClickhouse,
  getClickhouseDataOnly,
  getClickhouseCountOnly,
} from '../../../utils/pagination'
import {
  DefaultApiGetTransactionsListRequest,
  DefaultApiGetTransactionsStatsByTimeRequest,
  DefaultApiGetTransactionsStatsByTypeRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { DEFAULT_PAGE_SIZE, OptionalPagination } from '@/utils/pagination'
import { TransactionsResponseOffsetPaginated } from '@/@types/openapi-internal/TransactionsResponseOffsetPaginated'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { executeClickhouseQuery, getSortedData } from '@/utils/clickhouse/utils'
import { CurrencyCode } from '@/@types/openapi-internal/CurrencyCode'
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
import { CurrencyService } from '@/services/currency'
import { TransactionsStatsByTimeResponse } from '@/@types/openapi-internal/TransactionsStatsByTimeResponse'
import { TransactionAmountAggregates } from '@/@types/tranasction/transaction-list'
import { PAYMENT_METHODS } from '@/@types/openapi-public-custom/PaymentMethod'

type StatsByType = {
  transactionType: string
  average: number
  count: number
  sum: number
  min: number
  max: number
  median: number
}

type MinMax = {
  min: number
  max: number
}

type StatsByTime = {
  timedata: string
  count: number
  sum: number
  aggregateBy: string
  timestamp: number
}

@traceable
export class ClickhouseTransactionsRepository {
  private clickhouseClient: ClickHouseClient
  private dynamoDb: DynamoDBDocumentClient
  private tenantId: string
  constructor(
    clickhouseClient: ClickHouseClient,
    dynamoDb: DynamoDBDocumentClient,
    tenantId: string
  ) {
    this.clickhouseClient = clickhouseClient
    this.dynamoDb = dynamoDb
    this.tenantId = tenantId
  }

  private async getTransactionsWhereConditions(
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>
  ): Promise<{ whereClause: string; countWhereClause: string }> {
    const whereConditions: string[] = []

    if (params.filterId) {
      whereConditions.push(`id ILIKE '%${params.filterId}%'`)
    }

    if (params.filterIdList?.length) {
      const ilikeClauses = params.filterIdList
        .map((id) => `id ILIKE '%${id}%'`)
        .join(' OR ')
      whereConditions.push(`(${ilikeClauses})`)
    }

    if (params.filterUserId || params.filterUserIds) {
      const userIds: string[] = []

      if (params.filterUserId != null) {
        userIds.push(params.filterUserId)
      }

      if (params.filterUserIds != null) {
        userIds.push(...params.filterUserIds)
      }
      whereConditions.push(
        `(originUserId IN ('${userIds.join(
          "','"
        )}') OR destinationUserId IN ('${userIds.join("','")}'))`
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
    let timestampFilterCount = 0

    // Add partition filtering when both timestamps are provided
    if (params.afterTimestamp != null && params.beforeTimestamp != null) {
      const afterDate = new Date(params.afterTimestamp)
      const beforeDate = new Date(params.beforeTimestamp)

      const afterPartition =
        afterDate.getFullYear() * 100 + (afterDate.getMonth() + 1)
      const beforePartition =
        beforeDate.getFullYear() * 100 + (beforeDate.getMonth() + 1)

      if (afterPartition === beforePartition) {
        whereConditions.push(
          `toYYYYMM(toDateTime(timestamp / 1000)) = ${afterPartition}`
        )
      } else {
        whereConditions.push(
          `toYYYYMM(toDateTime(timestamp / 1000)) >= ${afterPartition}`
        )
        whereConditions.push(
          `toYYYYMM(toDateTime(timestamp / 1000)) <= ${beforePartition}`
        )
      }

      whereConditions.push(`timestamp >= ${params.afterTimestamp}`)
      whereConditions.push(`timestamp <= ${params.beforeTimestamp}`)
      timestampFilterCount += 2
    } else {
      if (params.afterTimestamp != null) {
        whereConditions.push(`timestamp >= ${params.afterTimestamp}`)
        timestampFilterCount++
      }

      if (params.beforeTimestamp != null) {
        whereConditions.push(`timestamp <= ${params.beforeTimestamp}`)
        timestampFilterCount++
      }
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

    if (params.filterTransactionTypes?.length) {
      whereConditions.push(
        `type IN ('${params.filterTransactionTypes.join("','")}')`
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

    if (params.filterStatus?.length) {
      if (params.isPaymentApprovals && params.filterStatus.includes('ALLOW')) {
        whereConditions.push(
          `status IN ('${params.filterStatus.join(
            "','"
          )}') AND length(nonShadowHitRules) > 0`
        )
      } else {
        whereConditions.push(`status IN ('${params.filterStatus.join("','")}')`)
      }
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

    // Payment details name search (on both origin and destination)
    if ((params as any).filterPaymentDetailName) {
      whereConditions.push(
        `(originPaymentDetailsName ILIKE '%${
          (params as any).filterPaymentDetailName
        }%' OR destinationPaymentDetailsName ILIKE '%${
          (params as any).filterPaymentDetailName
        }%')`
      )
    }

    if (params.filterReference) {
      whereConditions.push(`reference = '${params.filterReference}'`)
    }

    const queryWhereConditions = [...whereConditions]
    if (
      queryWhereConditions.length === timestampFilterCount &&
      params.sortOrder === 'descend' &&
      (this.tenantId === 'pnb' || this.tenantId === '4c9cdf0251')
    ) {
      const page = params.page ?? 1

      const beforeTimestamp = params.beforeTimestamp ?? Date.now()

      const threeDaysInMs = 3 * 24 * 60 * 60 * 1000 // 3 days in milliseconds
      const calculatedAfterTimestamp = beforeTimestamp - threeDaysInMs * page
      const givenAfterTimestamp = params.afterTimestamp ?? 0
      const afterTimestamp = Math.max(
        calculatedAfterTimestamp,
        givenAfterTimestamp
      )

      queryWhereConditions.length = 0 // Clear the array
      if (afterTimestamp > 0) {
        queryWhereConditions.push(`timestamp >= ${afterTimestamp}`)
      }
      queryWhereConditions.push(`timestamp <= ${beforeTimestamp}`)
    }
    if (params.afterTimestamp === null) {
      whereConditions.push('timestamp != 0')
      queryWhereConditions.push('timestamp != 0')
    }

    return {
      whereClause: queryWhereConditions.length
        ? `${queryWhereConditions.join(' AND ')}`
        : '',
      countWhereClause: whereConditions.length
        ? `${whereConditions.join(' AND ')}`
        : '',
    }
  }

  async getTransactions(
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>
  ): Promise<TransactionsResponseOffsetPaginated> {
    const { whereClause, countWhereClause } =
      await this.getTransactionsWhereConditions(params)

    let sortField = params.sortField ?? 'timestamp'
    const sortOrder = params.sortOrder ?? 'ascend'
    const page = params.page ?? 1
    const pageSize = (params.pageSize || DEFAULT_PAGE_SIZE) as number

    const columnsProjection = {
      transactionId: 'id',
      timestamp: "JSONExtractFloat(data, 'timestamp')",
      updatedAt: "JSONExtractFloat(data, 'updatedAt')",
      arsScore: "JSONExtractFloat(data, 'arsScore', 'arsScore')",
      originPaymentMethod:
        "JSONExtractString(data, 'originPaymentDetails', 'method')",
      destinationPaymentMethod:
        "JSONExtractString(data, 'destinationPaymentDetails', 'method')",
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
      hasHitRules: `length(arrayFilter(hitRule -> NOT isNull(hitRule),JSONExtractArrayRaw(data, 'hitRules'))) > 0`,
      originFundsInfo:
        "JSONExtract(data, 'originFundsInfo', 'Tuple(sourceOfFunds String, sourceOfWealth String)')",
      alertIds: "toJSONString(JSONExtract(data, 'alertIds', 'Array(String)'))",
    }

    const sortFieldMapper: Record<string, string> = {
      'originPayment.amount': 'originAmountDetails.transactionAmount',
      'destinationPayment.amount': 'destinationAmountDetails.transactionAmount',
      ars_score: 'arsScore',
    }

    if (sortField in sortFieldMapper) {
      sortField = sortFieldMapper[sortField]
    }

    const data = await offsetPaginateClickhouse<TransactionTableItem>(
      this.clickhouseClient,
      CLICKHOUSE_DEFINITIONS.TRANSACTIONS.materializedViews.BY_ID.table,
      CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName,
      { page, pageSize, sortField, sortOrder },
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
          arsScore: { arsScore: item.arsScore as number },
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
          type: item.type as string,
          tags: (item.tags as string)?.length
            ? (JSON.parse(item.tags as string) as Tag[])
            : undefined,
          productType: item.productType as string,
          status: item.status as RuleAction,
          transactionState: item.state as TransactionState,
          reference: item.reference as string,
          hasHitRules: Boolean(item.hasHitRules ?? false),
          hitRules: item.hitRules
            ? (JSON.parse(item.hitRules as string) as {
                ruleName: string
                ruleDescription: string
              }[])
            : undefined,
          originFundsInfo: item.originFundsInfo as OriginFundsInfo,
          alertIds: item.alertIds
            ? (JSON.parse(item.alertIds as string) as string[])
            : [],
        }
      },
      countWhereClause
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

  /**
   * Gets only transaction data without count calculation for improved performance
   */
  async getTransactionsDataOnly(
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>
  ): Promise<TransactionTableItem[]> {
    const { whereClause } = await this.getTransactionsWhereConditions(params)

    let sortField = params.sortField ?? 'timestamp'
    const sortOrder = params.sortOrder ?? 'ascend'
    const page = params.page ?? 1
    const pageSize = (params.pageSize || DEFAULT_PAGE_SIZE) as number

    const columnsProjection = {
      transactionId: 'id',
      timestamp: "JSONExtractFloat(data, 'timestamp')",
      updatedAt: "JSONExtractFloat(data, 'updatedAt')",
      arsScore: "JSONExtractFloat(data, 'arsScore', 'arsScore')",
      originPaymentMethod:
        "JSONExtractString(data, 'originPaymentDetails', 'method')",
      destinationPaymentMethod:
        "JSONExtractString(data, 'destinationPaymentDetails', 'method')",
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
      hasHitRules: `length(arrayFilter(hitRule -> NOT isNull(hitRule),JSONExtractArrayRaw(data, 'hitRules'))) > 0`,
      originFundsInfo:
        "JSONExtract(data, 'originFundsInfo', 'Tuple(sourceOfFunds String, sourceOfWealth String)')",
      alertIds: "toJSONString(JSONExtract(data, 'alertIds', 'Array(String)'))",
    }

    const sortFieldMapper: Record<string, string> = {
      'originPayment.amount': 'originAmountDetails.transactionAmount',
      'destinationPayment.amount': 'destinationAmountDetails.transactionAmount',
      ars_score: 'arsScore',
    }

    if (sortField in sortFieldMapper) {
      sortField = sortFieldMapper[sortField]
    }

    const items = await getClickhouseDataOnly<TransactionTableItem>(
      this.clickhouseClient,
      CLICKHOUSE_DEFINITIONS.TRANSACTIONS.materializedViews.BY_ID.table,
      CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName,
      { page, pageSize, sortField, sortOrder },
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
          arsScore: { arsScore: item.arsScore as number },
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
          type: item.type as string,
          tags: (item.tags as string)?.length
            ? (JSON.parse(item.tags as string) as Tag[])
            : undefined,
          productType: item.productType as string,
          status: item.status as RuleAction,
          transactionState: item.state as TransactionState,
          reference: item.reference as string,
          hasHitRules: Boolean(item.hasHitRules ?? false),
          hitRules: item.hitRules
            ? (JSON.parse(item.hitRules as string) as {
                ruleName: string
                ruleDescription: string
              }[])
            : undefined,
          originFundsInfo: item.originFundsInfo as OriginFundsInfo,
          alertIds: item.alertIds
            ? (JSON.parse(item.alertIds as string) as string[])
            : [],
        }
      }
    )

    const sortedTransactions = getSortedData<TransactionTableItem>({
      data: items,
      sortField,
      sortOrder,
      groupByField: 'transactionId',
      groupBySortField: 'updatedAt',
    })

    return compact(sortedTransactions)
  }

  /**
   * Gets only the count of transactions for pagination metadata
   */
  async getTransactionsCountOnly(
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>
  ): Promise<number> {
    const { countWhereClause } = await this.getTransactionsWhereConditions(
      params
    )

    const count = await getClickhouseCountOnly(
      this.clickhouseClient,
      CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName,
      '1',
      countWhereClause
    )

    return count
  }

  public async getStatsByType(
    params: DefaultApiGetTransactionsStatsByTypeRequest
  ): Promise<StatsByType[]> {
    const { pageSize, sortField, sortOrder } = params

    const { whereClause } = await this.getTransactionsWhereConditions(params)

    const query = `
      WITH txn AS (
        SELECT type as transactionType, originAmountDetails_amountInUsd
        FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName} FINAL
        WHERE ${whereClause} ORDER BY ${sortField} ${
      sortOrder === 'ascend' ? 'ASC' : 'DESC'
    } LIMIT ${pageSize}
      )
      SELECT
        transactionType,
        avg(originAmountDetails_amountInUsd) as average,
        count() as count,
        sum(originAmountDetails_amountInUsd) as sum,
        min(originAmountDetails_amountInUsd) as min,
          max(originAmountDetails_amountInUsd) as max,
        median(originAmountDetails_amountInUsd) as median
      FROM txn
      WHERE transactionType != ''
      GROUP BY transactionType
    `

    const result = await executeClickhouseQuery<StatsByType[]>(
      this.clickhouseClient,
      query
    )

    return result
  }

  public async getTransactionAmountAggregates(
    params: DefaultApiGetTransactionsListRequest
  ): Promise<TransactionAmountAggregates> {
    const { whereClause } = await this.getTransactionsWhereConditions(params)

    const query = `
      SELECT 
        round(sum(originAmountDetails_amountInUsd), 2) as totalOriginAmount,
        round(sum(CASE WHEN type = 'DEPOSIT' THEN originAmountDetails_amountInUsd ELSE 0 END), 2) as totalDeposits,
        round(sum(CASE WHEN type = 'LOAN' THEN originAmountDetails_amountInUsd ELSE 0 END), 2) as totalLoans,
        round(sum(CASE WHEN type = 'LOAN' THEN originAmountDetails_amountInUsd ELSE 0 END), 2) as totalLoanBalance,
        count() as totalTransactions,
        count(DISTINCT originPaymentMethodId) as totalAccounts  
      FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName} FINAL
      WHERE ${whereClause}
    `

    const result = await executeClickhouseQuery<TransactionAmountAggregates[]>(
      this.clickhouseClient,
      query
    )

    return result[0]
  }

  public async getAverageByMethodTable(
    params: DefaultApiGetTransactionsListRequest
  ): Promise<
    { method: PaymentMethod; inLast12Months: number; average: number }[]
  > {
    const { whereClause } = await this.getTransactionsWhereConditions(params)

    // Query for average per payment method for the past 12 months
    const last12MonthsQuery = `
      SELECT
        originPaymentMethod as method,
        1 as inLast12Months,
        avg(originAmountDetails_amountInUsd) as average
      FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName} FINAL
      WHERE ${whereClause}
        AND toStartOfMonth(toDateTime(timestamp / 1000)) >= toStartOfMonth(now() - INTERVAL 12 MONTH)
      GROUP BY method
      ORDER BY method
    `

    // Query for average per payment method for the full lifespan
    const fullLifespanQuery = `
      SELECT
        originPaymentMethod as method,
        0 as inLast12Months,
        avg(originAmountDetails_amountInUsd) as average
      FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName} FINAL
      WHERE ${whereClause}
      GROUP BY method
      ORDER BY method
    `

    const [last12MonthsResult, fullLifespanResult] = await Promise.all([
      executeClickhouseQuery<{ method: PaymentMethod; average: number }[]>(
        this.clickhouseClient,
        last12MonthsQuery
      ),
      executeClickhouseQuery<{ method: PaymentMethod; average: number }[]>(
        this.clickhouseClient,
        fullLifespanQuery
      ),
    ])

    // Execute both queries and combine results

    const finalData = PAYMENT_METHODS.map((method) => {
      const last12Months = last12MonthsResult.find((x) => x.method === method)
      const fullLifespan = fullLifespanResult.find((x) => x.method === method)
      return {
        method,
        inLast12Months:
          last12Months?.average == null ? 0 : round(last12Months.average, 2),
        average:
          fullLifespan?.average == null ? 0 : round(fullLifespan.average, 2),
      }
    })

    return finalData
  }

  public async getStatsByTime(
    params: DefaultApiGetTransactionsStatsByTimeRequest,
    referenceCurrency: CurrencyCode
  ): Promise<TransactionsStatsByTimeResponse['data']> {
    const { pageSize, sortField, sortOrder } = params

    const { whereClause } = await this.getTransactionsWhereConditions(params)

    const minMaxQuery = `
      WITH txn AS (
        SELECT timestamp
        FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName} FINAL
        WHERE ${whereClause} ORDER BY ${sortField} ${
      sortOrder === 'ascend' ? 'ASC' : 'DESC'
    } LIMIT ${pageSize}
      )
      SELECT min(timestamp) as min, max(timestamp) as max
      FROM txn
    `

    const minMaxResult = await executeClickhouseQuery<MinMax[]>(
      this.clickhouseClient,
      minMaxQuery
    )

    const { min, max } = minMaxResult[0]

    const difference = max - min
    const timezone = dayjsLib.tz.guess()

    const duration = dayjsLib.duration(difference)

    let clickhouseFormat: string
    let seriesFormat: string
    let labelFormat: string

    if (duration.asMonths() > 1) {
      clickhouseFormat = 'toStartOfMonth(toDateTime(timestamp / 1000))'
      seriesFormat = 'YYYY/MM/01 00:00 Z'
      labelFormat = 'YYYY/MM'
    } else if (duration.asDays() > 1) {
      clickhouseFormat = 'toStartOfDay(toDateTime(timestamp / 1000))'
      seriesFormat = 'YYYY/MM/DD 00:00 Z'
      labelFormat = 'MM/DD'
    } else {
      clickhouseFormat = 'toStartOfHour(toDateTime(timestamp / 1000))'
      seriesFormat = 'YYYY/MM/DD HH:00 Z'
      labelFormat = 'MM/DD HH:00'
    }

    const query = `
      SELECT
        ${clickhouseFormat} as timedata,
        count() as count,
        timestamp,
        sum(originAmountDetails_amountInUsd) as sum,
        ${
          params.aggregateBy === 'status' ? 'status' : 'transactionState'
        } as aggregateBy
      FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName} FINAL
      WHERE ${whereClause}
      GROUP BY timestamp, timedata, aggregateBy
      ORDER BY timedata ${sortOrder === 'ascend' ? 'ASC' : 'DESC'}
      LIMIT ${pageSize}
    `

    const data = await executeClickhouseQuery<StatsByTime[]>(
      this.clickhouseClient,
      query
    )
    const currencyService = new CurrencyService(this.dynamoDb)
    const exchangeRateWithUsd =
      referenceCurrency !== 'USD'
        ? await currencyService.getCurrencyExchangeRate(
            'USD',
            referenceCurrency
          )
        : 1

    const result: TransactionsStatsByTimeResponse['data'] = []
    for await (const transaction of data) {
      const series = dayjsLib
        .tz(transaction.timestamp, timezone)
        .format(seriesFormat)
      const label = dayjsLib
        .tz(transaction.timestamp, timezone)
        .format(labelFormat)

      const amount = (transaction.sum ?? 0) * exchangeRateWithUsd

      let counters = result.find((x) => x.series === series)
      if (counters == null) {
        counters = {
          series,
          label,
          values: {},
        }
        result.push(counters)
      }
      const key = transaction.aggregateBy
      if (key) {
        const ruleActionCounter = counters.values[key] ?? {
          count: 0,
          amount: 0,
        }
        counters.values[key] = ruleActionCounter

        ruleActionCounter.count = ruleActionCounter.count + transaction.count
        ruleActionCounter.amount = ruleActionCounter.amount + amount
      }
    }
    return result
  }
}
