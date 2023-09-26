import { JSONSchemaType } from 'ajv'
import { mapValues, sumBy, groupBy } from 'lodash'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import {
  getTransactionUserPastTransactionsByDirection,
  groupTransactionsByHour,
} from '../utils/transaction-rule-utils'
import {
  CHECK_RECEIVER_OPTIONAL_SCHEMA,
  CHECK_SENDER_OPTIONAL_SCHEMA,
  INITIAL_TRANSACTIONS_OPTIONAL_SCHEMA,
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  TRANSACTIONS_THRESHOLD_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionHistoricalFilters } from '../filters'
import { RuleHitResultItem } from '../rule'
import { getTimestampRange } from '../utils/time-utils'
import { TransactionAggregationRule } from './aggregation-rule'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { mergeObjects } from '@/utils/object'

const DEFAULT_GROUP_KEY = 'all'

type AggregationData = {
  sendingCount?: number
  receivingCount?: number
}

export type TransactionsPatternVelocityRuleParameters = {
  transactionsLimit: number
  timeWindow: TimeWindow

  // Optional parameters
  checkSender?: 'sending' | 'all' | 'none'
  checkReceiver?: 'receiving' | 'all' | 'none'
  initialTransactions?: number
}

export default abstract class TransactionsPatternVelocityBaseRule<
  T extends TransactionsPatternVelocityRuleParameters
> extends TransactionAggregationRule<
  T,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getBaseSchema(): JSONSchemaType<TransactionsPatternVelocityRuleParameters> {
    return {
      type: 'object',
      properties: {
        timeWindow: TIME_WINDOW_SCHEMA(),
        transactionsLimit: TRANSACTIONS_THRESHOLD_SCHEMA(),
        initialTransactions: INITIAL_TRANSACTIONS_OPTIONAL_SCHEMA(),
        checkSender: CHECK_SENDER_OPTIONAL_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_OPTIONAL_SCHEMA(),
      },
      required: ['transactionsLimit', 'timeWindow'],
    }
  }

  public async computeRule() {
    return await Promise.all([
      this.computeRuleUser('origin'),
      this.computeRuleUser('destination'),
    ])
  }

  protected async computeRuleUser(
    direction: 'origin' | 'destination'
  ): Promise<RuleHitResultItem | undefined> {
    const matchPattern = this.matchPattern(
      this.transaction,
      direction,
      direction === 'origin' ? 'sender' : 'receiver',
      true
    )
    if (!matchPattern) {
      return
    }
    const { checkSender, checkReceiver } = this.parameters
    if (direction === 'origin' && checkSender === 'none') {
      return
    } else if (direction === 'destination' && checkReceiver === 'none') {
      return
    }

    const groupCounts = await this.getData(direction)
    for (const group in groupCounts) {
      if (
        (!this.parameters.initialTransactions ||
          groupCounts[group] > this.parameters.initialTransactions!) &&
        groupCounts[group] > this.parameters.transactionsLimit
      ) {
        return {
          direction: direction === 'origin' ? 'ORIGIN' : 'DESTINATION',
          vars: super.getTransactionVars(direction),
        }
      }
    }
  }

  private async getRawTransactionsData(
    direction: 'origin' | 'destination'
  ): Promise<{
    sendingTransactions: AuxiliaryIndexTransaction[]
    receivingTransactions: AuxiliaryIndexTransaction[]
  }> {
    const {
      timeWindow,
      checkReceiver = 'all',
      checkSender = 'all',
    } = this.parameters
    const checkDirection = direction === 'origin' ? checkSender : checkReceiver

    const { sendingTransactions, receivingTransactions } =
      await getTransactionUserPastTransactionsByDirection(
        this.transaction,
        direction,
        this.transactionRepository,
        {
          timeWindow,
          checkDirection,
          matchPaymentMethodDetails:
            this.isMatchPaymentMethodDetailsEnabled(direction),
          filters: this.filters,
        },
        this.getNeededTransactionFields()
      )

    return { sendingTransactions, receivingTransactions }
  }

  private async getData(
    direction: 'origin' | 'destination'
  ): Promise<{ [groupKey: string]: number }> {
    const {
      timeWindow,
      checkSender = 'all',
      checkReceiver = 'all',
    } = this.parameters
    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp!,
      timeWindow
    )
    const userAggregationData = await this.getRuleAggregations<AggregationData>(
      direction,
      afterTimestamp,
      beforeTimestamp
    )
    const checkDirection = direction === 'origin' ? checkSender : checkReceiver
    if (userAggregationData) {
      const transactionsCount = sumBy(
        userAggregationData,
        (data) =>
          (checkDirection === 'sending'
            ? data.sendingCount
            : checkDirection === 'receiving'
            ? data.receivingCount
            : (data.sendingCount ?? 0) + (data.receivingCount ?? 0)) ?? 0
      )
      return {
        [DEFAULT_GROUP_KEY]: transactionsCount + 1,
      }
    }

    if (!this.shouldUseRawData() && this.isAggregationSupported()) {
      return await this.computeRawData(direction)
    } else {
      const { sendingTransactions, receivingTransactions } =
        await this.getRawTransactionsData(direction)

      // Update aggregations
      if (this.isAggregationSupported() && this.shouldUseRawData()) {
        await this.saveRebuiltRuleAggregations(
          direction,
          await this.getTimeAggregatedResult(
            sendingTransactions,
            receivingTransactions
          )
        )
      }
      return await this.computeRawData(
        direction,
        sendingTransactions,
        receivingTransactions
      )
    }
  }

  public shouldUpdateUserAggregation(
    direction: 'origin' | 'destination',
    isTransactionHistoricalFiltered: boolean
  ): boolean {
    const matchPattern = this.matchPattern(
      this.transaction,
      direction,
      direction === 'origin' ? 'sender' : 'receiver',
      true
    )
    return (
      isTransactionHistoricalFiltered &&
      matchPattern &&
      this.isAggregationSupported()
    )
  }

  public async rebuildUserAggregation(
    direction: 'origin' | 'destination'
  ): Promise<void> {
    const { sendingTransactions, receivingTransactions } =
      await this.getRawTransactionsData(direction)

    if (this.transaction.originUserId || this.transaction.destinationUserId) {
      if (direction === 'origin') {
        sendingTransactions.push(this.transaction)
      } else {
        receivingTransactions.push(this.transaction)
      }

      // Update aggregations
      if (this.isAggregationSupported()) {
        await this.saveRebuiltRuleAggregations(
          direction,
          await this.getTimeAggregatedResult(
            sendingTransactions,
            receivingTransactions
          )
        )
      }
    }
  }

  private async computeRawData(
    direction: 'origin' | 'destination',
    sendingTransactions: AuxiliaryIndexTransaction[] = [],
    receivingTransactions: AuxiliaryIndexTransaction[] = []
  ): Promise<AggregationData> {
    if (direction === 'origin') {
      sendingTransactions.push(this.transaction)
    } else {
      receivingTransactions.push(this.transaction)
    }

    const sendingMatchedTransactions = sendingTransactions.filter(
      (transaction) => this.matchPattern(transaction, 'origin', 'sender')
    )

    const receivingMatchedTransactions = receivingTransactions.filter(
      (transaction) => this.matchPattern(transaction, 'destination', 'sender')
    )

    return mapValues(
      groupBy(
        sendingMatchedTransactions.concat(receivingMatchedTransactions),
        (t) => this.getTransactionGroupKey(t) || DEFAULT_GROUP_KEY
      ),
      (group) => group.length
    )
  }

  private async getTimeAggregatedResult(
    sendingTransactions: AuxiliaryIndexTransaction[],
    receivingTransactions: AuxiliaryIndexTransaction[]
  ) {
    return mergeObjects(
      await groupTransactionsByHour<AggregationData>(
        sendingTransactions,
        async (group) => ({ sendingCount: group.length })
      ),
      await groupTransactionsByHour<AggregationData>(
        receivingTransactions,
        async (group) => ({ receivingCount: group.length })
      )
    )
  }

  protected getTransactionGroupKey(
    _transaction: AuxiliaryIndexTransaction
  ): string | undefined {
    return
  }

  protected abstract matchPattern(
    _transaction: AuxiliaryIndexTransaction,
    _direction?: 'origin' | 'destination',
    _userType?: 'sender' | 'receiver',
    _pure?: boolean
  ): boolean

  protected abstract getNeededTransactionFields(): Array<keyof Transaction>

  protected abstract isAggregationSupported(): boolean

  protected abstract isMatchPaymentMethodDetailsEnabled(
    direction: 'origin' | 'destination'
  ): boolean | undefined

  override async getUpdatedTargetAggregation(
    direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined
  ): Promise<AggregationData | null> {
    if (direction === 'origin') {
      return {
        ...targetAggregationData,
        sendingCount: (targetAggregationData?.sendingCount || 0) + 1,
      }
    } else {
      return {
        ...targetAggregationData,
        receivingCount: (targetAggregationData?.receivingCount || 0) + 1,
      }
    }
  }

  override getMaxTimeWindow(): TimeWindow {
    return this.parameters.timeWindow
  }

  override getRuleAggregationVersion(): number {
    return 2
  }
}
