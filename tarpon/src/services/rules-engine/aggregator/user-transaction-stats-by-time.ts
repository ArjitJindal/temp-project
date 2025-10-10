import { MongoDbTransactionRepository } from '../repositories/mongodb-transaction-repository'
import { UserTimeAggregationAttributes } from '../repositories/aggregation-repository'
import {
  getTransactionStatsTimeGroupLabel,
  getTransactionsTotalAmount,
} from '../utils/transaction-rule-utils'
import { Aggregator } from './aggregator'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { TransactionState } from '@/@types/openapi-internal/TransactionState'
import { PaymentMethod } from '@/@types/openapi-public/PaymentMethod'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { logger } from '@/core/logger'
import { Transaction } from '@/@types/openapi-public/Transaction'
import dayjs from '@/utils/dayjs'

const GRANULARITIES: Array<'day' | 'week' | 'month' | 'year'> = [
  'day',
  'week',
  'month',
  'year',
]

type RebuildResult = {
  day: {
    [timeLabel: string]: UserTimeAggregationAttributes
  }
  week: {
    [timeLabel: string]: UserTimeAggregationAttributes
  }
  month: {
    [timeLabel: string]: UserTimeAggregationAttributes
  }
  year: {
    [timeLabel: string]: UserTimeAggregationAttributes
  }
}

export class UserTransactionStatsTimeGroup extends Aggregator {
  public static aggregatorName = 'UserTransactionStatsTimeGroup'
  public async aggregate(transaction: Transaction): Promise<void> {
    if (transaction.originUserId && transaction.originAmountDetails) {
      await this.aggregateUser(
        transaction.originUserId,
        'origin',
        transaction.originAmountDetails,
        transaction.originPaymentDetails?.method,
        transaction.timestamp
      )
    }
    if (transaction.destinationUserId && transaction.destinationAmountDetails) {
      await this.aggregateUser(
        transaction.destinationUserId,
        'destination',
        transaction.destinationAmountDetails,
        transaction.destinationPaymentDetails?.method,
        transaction.timestamp
      )
    }
  }

  private async aggregateUser(
    userId: string,
    direction: 'origin' | 'destination',
    transactionAmount: TransactionAmountDetails,
    paymentMethod: PaymentMethod | undefined,
    timestamp: number
  ) {
    await Promise.all(
      GRANULARITIES.map((granularity) =>
        this.aggregationRepository.addUserTransactionStatsTimeGroup(
          userId,
          direction,
          transactionAmount,
          paymentMethod,
          timestamp,
          granularity
        )
      )
    )
  }

  public getTargetTransactionState(): TransactionState {
    return 'SUCCESSFUL'
  }

  public async rebuildAggregation(
    userId: string,
    options?: { now: number }
  ): Promise<RebuildResult> {
    logger.info('Starting to rebuild.')
    const mongoClient = await getMongoDbClient()
    const transactionRepository = new MongoDbTransactionRepository(
      this.tenantId,
      mongoClient,
      this.dynamoDb
    )
    const now = dayjs(options?.now)
    const cursor = transactionRepository.getTransactionsCursor({
      filterUserId: userId,
      afterTimestamp: now.startOf('year').valueOf(),
      beforeTimestamp: now.valueOf(),
      sortOrder: 'descend',
      sortField: 'timestamp',
    })

    const allAggregation = {
      day: {},
      week: {},
      month: {},
      year: {},
    }
    let processedTransactions = 0

    for await (const transaction of cursor) {
      for (const granularity of GRANULARITIES) {
        await this.updateAggregation(
          userId,
          allAggregation[granularity],
          transaction,
          granularity
        )
      }
      processedTransactions += 1
      if (processedTransactions % 10000 === 0) {
        logger.info(`Processed ${processedTransactions} transactions`)
      }
    }

    // Consider the new transactions created after the rebuilding above is done
    const cursorAfterNow = transactionRepository.getTransactionsCursor({
      filterUserId: userId,
      afterTimestamp: now.valueOf(),
    })
    for await (const transaction of cursorAfterNow) {
      for (const granularity of GRANULARITIES) {
        await this.updateAggregation(
          userId,
          allAggregation[granularity],
          transaction,
          granularity
        )
      }
    }

    // Persist the rebuilt aggregation data
    for (const granularity of GRANULARITIES) {
      await this.aggregationRepository.rebuildUserTransactionStatsTimeGroups(
        userId,
        allAggregation[granularity]
      )
    }
    logger.info('Finished rebuild.')
    return allAggregation
  }

  private async updateAggregation(
    userId: string,
    allAggregation: {
      [key: string]: UserTimeAggregationAttributes
    },
    transaction: Transaction,
    granularity: 'day' | 'week' | 'month' | 'year'
  ) {
    const timeLabel = getTransactionStatsTimeGroupLabel(
      transaction.timestamp,
      granularity
    )
    if (!allAggregation[timeLabel]) {
      allAggregation[timeLabel] = {
        sendingTransactionsCount: new Map(),
        sendingTransactionsAmount: new Map(),
        receivingTransactionsCount: new Map(),
        receivingTransactionsAmount: new Map(),
      }
    }
    const aggregation = allAggregation[timeLabel]

    if (
      transaction.originUserId === userId &&
      transaction.originAmountDetails
    ) {
      const paymentMethod = transaction.originPaymentDetails?.method
      const allAmount = await getTransactionsTotalAmount(
        [
          transaction.originAmountDetails,
          aggregation.sendingTransactionsAmount.get('ALL'),
        ],
        transaction.originAmountDetails.transactionCurrency,
        this.dynamoDb
      )

      aggregation.sendingTransactionsCount.set(
        'ALL',
        (aggregation.sendingTransactionsCount.get('ALL') ?? 0) + 1
      )
      aggregation.sendingTransactionsAmount.set('ALL', allAmount)
      if (paymentMethod) {
        const paymentMethodAmount = await getTransactionsTotalAmount(
          [
            transaction.originAmountDetails,
            aggregation.sendingTransactionsAmount.get(paymentMethod),
          ],
          transaction.originAmountDetails.transactionCurrency,
          this.dynamoDb
        )
        aggregation.sendingTransactionsCount.set(
          paymentMethod,
          (aggregation.sendingTransactionsCount.get(paymentMethod) ?? 0) + 1
        )
        aggregation.sendingTransactionsAmount.set(
          paymentMethod,
          paymentMethodAmount
        )
      }
    }
    if (
      transaction.destinationUserId === userId &&
      transaction.destinationAmountDetails
    ) {
      const paymentMethod = transaction.destinationPaymentDetails?.method
      const allAmount = await getTransactionsTotalAmount(
        [
          transaction.destinationAmountDetails,
          aggregation.receivingTransactionsAmount.get('ALL'),
        ],
        transaction.destinationAmountDetails.transactionCurrency,
        this.dynamoDb
      )

      aggregation.receivingTransactionsCount.set(
        'ALL',
        (aggregation.receivingTransactionsCount.get('ALL') ?? 0) + 1
      )
      aggregation.receivingTransactionsAmount.set('ALL', allAmount)
      if (paymentMethod) {
        const paymentMethodAmount = await getTransactionsTotalAmount(
          [
            transaction.destinationAmountDetails,
            aggregation.receivingTransactionsAmount.get(paymentMethod),
          ],
          transaction.destinationAmountDetails.transactionCurrency,
          this.dynamoDb
        )
        aggregation.receivingTransactionsCount.set(
          paymentMethod,
          (aggregation.receivingTransactionsCount.get(paymentMethod) ?? 0) + 1
        )
        aggregation.receivingTransactionsAmount.set(
          paymentMethod,
          paymentMethodAmount
        )
      }
    }
  }
}
