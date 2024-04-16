import { JSONSchemaType } from 'ajv'
import { mergeWith } from 'lodash'
import { getEditDistancePercentage } from '@flagright/lib/utils'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import { RuleHitResultItem } from '../rule'
import { TransactionHistoricalFilters } from '../filters'
import {
  getTransactionUserPastTransactionsByDirectionGenerator,
  groupTransactionsByHour,
} from '../utils/transaction-rule-utils'
import {
  INITIAL_TRANSACTIONS_OPTIONAL_SCHEMA,
  LEVENSHTEIN_DISTANCE_THRESHOLD_PERCENTAGE_OPTIONAL_SCHEMA,
  TIME_WINDOW_SCHEMA,
  TimeWindow,
} from '../utils/rule-parameter-schemas'
import { getTimestampRange } from '../utils/time-utils'
import { TransactionAggregationRule } from './aggregation-rule'
import { mergeObjects } from '@/utils/object'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { traceable } from '@/core/xray'
import { PaymentDetails } from '@/@types/tranasction/payment-type'

export type PaymentDetailChangeRuleParameters = {
  timeWindow: TimeWindow
  oldNamesThreshold: number
  initialTransactions?: number
  allowedDistancePercentage?: number
  ignoreEmptyName?: boolean
}

export type AggregationData = {
  senderPaymentDetailUsage: { [paymentDetail: string]: number }
  receiverPaymentDetailUsage: { [paymentDetail: string]: number }
  senderPreviousPaymentDetail: string
  receiverPreviousPaymentDetail: string
  transactionCount: number
}
const initialAggregationData = (): AggregationData => ({
  senderPaymentDetailUsage: {},
  receiverPaymentDetailUsage: {},
  senderPreviousPaymentDetail: '',
  receiverPreviousPaymentDetail: '',
  transactionCount: 0,
})

@traceable
export default abstract class PaymentDetailChangeRuleBase extends TransactionAggregationRule<
  PaymentDetailChangeRuleParameters,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getSchema(): JSONSchemaType<PaymentDetailChangeRuleParameters> {
    return {
      type: 'object',
      properties: {
        timeWindow: TIME_WINDOW_SCHEMA(),
        oldNamesThreshold: {
          type: 'integer',
          description:
            'Rule is run when count of old name usages is greater or equal to threshold',
        },
        initialTransactions: INITIAL_TRANSACTIONS_OPTIONAL_SCHEMA(),
        allowedDistancePercentage:
          LEVENSHTEIN_DISTANCE_THRESHOLD_PERCENTAGE_OPTIONAL_SCHEMA({}),
        ignoreEmptyName: {
          type: 'boolean',
          nullable: true,
        },
      },
      required: [],
    }
  }

  async getUpdatedTargetAggregation(
    direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined
  ): Promise<AggregationData | null> {
    return paymentDetailChangeReducer(
      direction,
      targetAggregationData,
      this.transaction,
      this.getPaymentDetail
    )
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
    const { paymentUsage, previousPaymentDetail } = keys(direction)
    const paymentDetailHistory = await this.getData(direction)
    const paymentDetail = this.getPaymentDetail(
      direction === 'origin'
        ? this.transaction.originPaymentDetails
        : this.transaction.destinationPaymentDetails
    )
    if (
      !paymentDetail ||
      this.isDistanceAllowed(
        paymentDetail,
        paymentDetailHistory[previousPaymentDetail]
      )
    ) {
      return
    }

    if (
      (this.parameters.ignoreEmptyName &&
        (paymentDetail === '' || paymentDetail === undefined)) ||
      paymentDetailHistory.transactionCount <
        (this.parameters.initialTransactions ?? 0)
    ) {
      return
    }

    const thispaymentUsage = paymentDetailHistory[paymentUsage][paymentDetail]

    if (!thispaymentUsage) {
      const oldPaymentUsages = Object.entries(
        paymentDetailHistory[paymentUsage]
      ).reduce((acc, [thisPaymentDetail, usages]) => {
        if (this.isDistanceAllowed(paymentDetail, thisPaymentDetail)) {
          return acc
        }
        return acc + usages
      }, 0)

      if (oldPaymentUsages >= this.parameters.oldNamesThreshold) {
        return {
          direction: direction === 'origin' ? 'ORIGIN' : 'DESTINATION',
          vars: this.getTransactionVars(direction),
        }
      }
    }
  }

  private async getData(
    direction: 'origin' | 'destination'
  ): Promise<AggregationData> {
    const { paymentUsage, previousPaymentDetail } = keys(direction)
    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp ?? 0,
      this.parameters.timeWindow
    )
    const userAggregationData = await this.getRuleAggregations<AggregationData>(
      direction,
      afterTimestamp,
      beforeTimestamp
    )

    if (userAggregationData) {
      return userAggregationData.reduce<AggregationData>(
        (result, currentData: AggregationData) => {
          result[previousPaymentDetail] = currentData[previousPaymentDetail]
          for (const [paymentDetail, usages] of Object.entries(
            currentData[paymentUsage] ?? {}
          )) {
            const existingPaymentUsage = result[paymentUsage][paymentDetail]
            if (existingPaymentUsage) {
              result[paymentUsage][paymentDetail] =
                existingPaymentUsage + usages
            } else {
              result[paymentUsage][paymentDetail] = usages
            }
          }
          result.transactionCount += currentData.transactionCount
          return result
        },
        initialAggregationData()
      )
    }

    if (this.shouldUseRawData()) {
      let aggregationData = initialAggregationData()
      for await (const data of this.getRawTransactionsData(direction)) {
        aggregationData = aggregationDataMerger(
          data.sendingTransactions.reduce<AggregationData>(
            (agg, txn) =>
              paymentDetailChangeReducer(
                'origin',
                agg,
                txn,
                this.getPaymentDetail
              ),
            initialAggregationData()
          ),
          data.receivingTransactions.reduce<AggregationData>(
            (agg, txn) =>
              paymentDetailChangeReducer(
                'destination',
                agg,
                txn,
                this.getPaymentDetail
              ),
            initialAggregationData()
          )
        )
      }
      return aggregationData
    }
    return initialAggregationData()
  }

  private async *getRawTransactionsData(
    direction: 'origin' | 'destination'
  ): AsyncGenerator<{
    receivingTransactions: AuxiliaryIndexTransaction[]
    sendingTransactions: AuxiliaryIndexTransaction[]
  }> {
    yield* getTransactionUserPastTransactionsByDirectionGenerator(
      this.transaction,
      direction,
      this.transactionRepository,
      {
        timeWindow: this.parameters.timeWindow,
        checkDirection: 'all',
        filters: this.filters,
      },
      ['timestamp', 'originPaymentDetails', 'destinationPaymentDetails']
    )
  }

  public shouldUpdateUserAggregation(
    _direction: 'origin' | 'destination',
    isTransactionFiltered: boolean
  ): boolean {
    return isTransactionFiltered
  }

  public async rebuildUserAggregation(
    direction: 'origin' | 'destination'
  ): Promise<void> {
    let timeAggregatedResult: { [key1: string]: AggregationData } = {}
    for await (const data of this.getRawTransactionsData(direction)) {
      const partialTimeAggregatedResult = await this.getTimeAggregatedResult(
        data.sendingTransactions,
        data.receivingTransactions
      )
      timeAggregatedResult = mergeWith(
        timeAggregatedResult,
        partialTimeAggregatedResult,
        aggregationDataMerger
      )
    }

    await this.saveRebuiltRuleAggregations(direction, timeAggregatedResult)
  }

  private async getTimeAggregatedResult(
    sendingTransactions: AuxiliaryIndexTransaction[],
    receivingTransactions: AuxiliaryIndexTransaction[]
  ) {
    return mergeObjects(
      await groupTransactionsByHour<AggregationData>(
        sendingTransactions,
        async (group) => {
          return group.reduce<AggregationData>(
            (agg, txn) =>
              paymentDetailChangeReducer(
                'origin',
                agg,
                txn,
                this.getPaymentDetail
              ),
            initialAggregationData()
          )
        }
      ),
      await groupTransactionsByHour<AggregationData>(
        receivingTransactions,
        async (group) => {
          return group.reduce<AggregationData>(
            (agg, txn) =>
              paymentDetailChangeReducer(
                'destination',
                agg,
                txn,
                this.getPaymentDetail
              ),
            initialAggregationData()
          )
        }
      )
    )
  }

  abstract getPaymentDetail(paymentDetils?: PaymentDetails): string | undefined
  override getMaxTimeWindow(): TimeWindow {
    return this.parameters.timeWindow
  }
  protected getRuleAggregationVersion(): number {
    return 2
  }

  private isDistanceAllowed(
    str1: string | undefined,
    str2: string | undefined
  ): boolean {
    if (!str1 || !str2) {
      return false
    }
    if (!this.parameters.allowedDistancePercentage) {
      return str1 === str2
    }
    return (
      getEditDistancePercentage(str1, str2) <=
      this.parameters.allowedDistancePercentage
    )
  }
}

const keys = (
  direction: 'origin' | 'destination'
): {
  paymentUsage: 'senderPaymentDetailUsage' | 'receiverPaymentDetailUsage'
  previousPaymentDetail:
    | 'senderPreviousPaymentDetail'
    | 'receiverPreviousPaymentDetail'
} => {
  return direction === 'origin'
    ? {
        paymentUsage: 'senderPaymentDetailUsage',
        previousPaymentDetail: 'senderPreviousPaymentDetail',
      }
    : {
        paymentUsage: 'receiverPaymentDetailUsage',
        previousPaymentDetail: 'receiverPreviousPaymentDetail',
      }
}
export const paymentDetailChangeReducer = (
  direction: 'origin' | 'destination',
  targetAggregationData: AggregationData | undefined,
  transaction: AuxiliaryIndexTransaction | Transaction,
  getDetail: (paymentDetails?: PaymentDetails) => string | undefined
): AggregationData => {
  const { paymentUsage, previousPaymentDetail } = keys(direction)
  const paymentDetail =
    direction === 'origin'
      ? getDetail(transaction.originPaymentDetails)
      : getDetail(transaction.destinationPaymentDetails)
  if (!targetAggregationData) {
    if (paymentDetail) {
      return {
        ...initialAggregationData(),
        [paymentUsage]: {
          [paymentDetail]: 1,
        },
        [previousPaymentDetail]: paymentDetail,
        transactionCount: 1,
      }
    }
    return initialAggregationData()
  }

  if (!paymentDetail) {
    return targetAggregationData
  }

  targetAggregationData[paymentUsage][paymentDetail] =
    (targetAggregationData[paymentUsage][paymentDetail] || 0) + 1
  targetAggregationData[previousPaymentDetail] = paymentDetail
  targetAggregationData.transactionCount += 1

  return targetAggregationData
}

function aggregationDataMerger(
  a: AggregationData | undefined,
  b: AggregationData | undefined
) {
  const result: AggregationData = {
    senderPaymentDetailUsage:
      mergeWith(
        a?.senderPaymentDetailUsage,
        b?.senderPaymentDetailUsage,
        (x: number | undefined, y: number | undefined) => (x ?? 0) + (y ?? 0)
      ) ?? {},
    receiverPaymentDetailUsage:
      mergeWith(
        a?.receiverPaymentDetailUsage,
        b?.receiverPaymentDetailUsage,
        (x: number | undefined, y: number | undefined) => (x ?? 0) + (y ?? 0)
      ) ?? {},
    senderPreviousPaymentDetail:
      b?.senderPreviousPaymentDetail || a?.senderPreviousPaymentDetail || '',
    receiverPreviousPaymentDetail:
      b?.receiverPreviousPaymentDetail ||
      a?.receiverPreviousPaymentDetail ||
      '',
    transactionCount: (a?.transactionCount || 0) + (b?.transactionCount || 0),
  }
  return result
}
