import { JSONSchemaType } from 'ajv'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import { RuleHitResult } from '../rule'
import { TransactionHistoricalFilters } from '../filters'
import {
  getTransactionUserPastTransactionsByDirection,
  groupTransactionsByHour,
} from '../utils/transaction-rule-utils'
import { TimeWindow } from '../utils/rule-parameter-schemas'
import { getTimestampRange } from '../utils/time-utils'
import { TransactionAggregationRule } from './aggregation-rule'
import { CardDetails } from '@/@types/openapi-public/CardDetails'

type AggregationData = {
  cardFingerprints: string[]
}

export type SameUserUsingTooManyCardsParameters = {
  uniqueCardsCountThreshold: number
  timeWindowInDays: number
}

export default class SameUserUsingTooManyCardsRule extends TransactionAggregationRule<
  SameUserUsingTooManyCardsParameters,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getSchema(): JSONSchemaType<SameUserUsingTooManyCardsParameters> {
    return {
      type: 'object',
      properties: {
        uniqueCardsCountThreshold: {
          type: 'integer',
          title: 'Cards count threshold',
          description:
            'rule is run when the cards count per time window is greater than the threshold',
        },
        timeWindowInDays: { type: 'integer', title: 'Time window (days)' },
      },
      required: ['uniqueCardsCountThreshold', 'timeWindowInDays'],
    }
  }

  public async computeRule() {
    const cardFingerprint = (
      this.transaction?.originPaymentDetails as CardDetails
    )?.cardFingerprint
    if (!this.transaction.originUserId || !cardFingerprint) {
      return
    }

    const uniqueCards = await this.getData()
    uniqueCards.add(cardFingerprint)

    const hitResult: RuleHitResult = []
    if (uniqueCards.size > this.parameters.uniqueCardsCountThreshold) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: {
          ...super.getTransactionVars('origin'),
          uniqueCardsCount: uniqueCards.size,
        },
      })
    }
    return hitResult
  }

  private async getRawTransactionsData(): Promise<AuxiliaryIndexTransaction[]> {
    const { sendingTransactions } =
      await getTransactionUserPastTransactionsByDirection(
        this.transaction,
        'origin',
        this.transactionRepository,
        {
          timeWindow: {
            units: this.parameters.timeWindowInDays,
            granularity: 'day',
            rollingBasis: true,
          },
          checkDirection: 'sending',
          filters: this.filters,
        },
        ['timestamp', 'originPaymentDetails']
      )

    return sendingTransactions
  }

  public shouldUpdateUserAggregation(
    direction: 'origin' | 'destination',
    isTransactionFiltered: boolean
  ): boolean {
    return isTransactionFiltered && direction === 'origin'
  }

  public async rebuildUserAggregation(): Promise<void> {
    const sendingTransactions = await this.getRawTransactionsData()

    sendingTransactions.push(this.transaction)

    await this.saveRebuiltRuleAggregations(
      'origin',
      await this.getTimeAggregatedResult(sendingTransactions)
    )
  }

  private async getData(): Promise<Set<string>> {
    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp!,
      {
        units: this.parameters.timeWindowInDays,
        granularity: 'day',
        rollingBasis: true,
      }
    )
    const userAggregationData = await this.getRuleAggregations<AggregationData>(
      'origin',
      afterTimestamp,
      beforeTimestamp
    )
    if (userAggregationData) {
      return new Set(userAggregationData.flatMap((v) => v.cardFingerprints))
    }

    // Fallback
    if (this.shouldUseRawData()) {
      const sendingTransactions = await this.getRawTransactionsData()
      const sendingTransactionsWithCard = sendingTransactions.filter(
        (transaction) =>
          (transaction?.originPaymentDetails as CardDetails)?.cardFingerprint
      )

      // Update aggregations
      await this.saveRebuiltRuleAggregations(
        'origin',
        await this.getTimeAggregatedResult(sendingTransactionsWithCard)
      )

      return this.getUniqueCards(sendingTransactionsWithCard)
    } else {
      return new Set()
    }
  }

  private getUniqueCards(
    transactions: AuxiliaryIndexTransaction[]
  ): Set<string> {
    return new Set(
      transactions
        .map(
          (transaction) =>
            (transaction?.originPaymentDetails as CardDetails)?.cardFingerprint
        )
        .filter(Boolean)
    ) as Set<string>
  }

  private async getTimeAggregatedResult(
    sendingTransactionsWithCard: AuxiliaryIndexTransaction[]
  ) {
    return groupTransactionsByHour<AggregationData>(
      sendingTransactionsWithCard,
      async (group) => ({
        cardFingerprints: Array.from(this.getUniqueCards(group)),
      })
    )
  }

  override async getUpdatedTargetAggregation(
    _direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined
  ): Promise<AggregationData | null> {
    const cardFingerprint = (
      this.transaction?.originPaymentDetails as CardDetails
    )?.cardFingerprint

    if (!cardFingerprint) {
      return null
    }
    return {
      cardFingerprints: Array.from(
        new Set(
          (targetAggregationData?.cardFingerprints ?? []).concat(
            cardFingerprint
          )
        )
      ),
    }
  }

  override getMaxTimeWindow(): TimeWindow {
    return {
      units: this.parameters.timeWindowInDays,
      granularity: 'day',
    }
  }
  protected getRuleAggregationVersion(): number {
    return 2
  }
}
