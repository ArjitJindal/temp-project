import { JSONSchemaType } from 'ajv'
import { mergeWith, uniq } from 'lodash'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import { RuleHitResult } from '../rule'
import { TransactionHistoricalFilters } from '../filters'
import {
  getTransactionUserPastTransactionsByDirectionGenerator,
  groupTransactionsByHour,
} from '../utils/transaction-rule-utils'
import { TIME_WINDOW_SCHEMA, TimeWindow } from '../utils/rule-parameter-schemas'
import { getTimestampRange } from '../utils/time-utils'
import { TransactionAggregationRule } from './aggregation-rule'
import { CardDetails } from '@/@types/openapi-public/CardDetails'
import { traceable } from '@/core/xray'

type AggregationData = {
  cardFingerprints: string[]
}

export type SameUserUsingTooManyCardsParameters = {
  uniqueCardsCountThreshold: number
  timeWindow: TimeWindow
}

@traceable
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
        timeWindow: TIME_WINDOW_SCHEMA(),
      },
      required: ['uniqueCardsCountThreshold', 'timeWindow'],
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

  private async *getRawTransactionsData(): AsyncGenerator<
    AuxiliaryIndexTransaction[]
  > {
    const generator =
      await getTransactionUserPastTransactionsByDirectionGenerator(
        this.transaction,
        'origin',
        this.transactionRepository,
        {
          timeWindow: this.parameters.timeWindow,
          checkDirection: 'sending',
          filters: this.filters,
        },
        ['timestamp', 'originPaymentDetails']
      )
    for await (const data of generator) {
      yield data.sendingTransactions
    }
  }

  public shouldUpdateUserAggregation(
    direction: 'origin' | 'destination',
    isTransactionFiltered: boolean
  ): boolean {
    return isTransactionFiltered && direction === 'origin'
  }

  public async rebuildUserAggregation(): Promise<void> {
    let timeAggregatedResult: { [key1: string]: AggregationData } = {}
    for await (const data of this.getRawTransactionsData()) {
      const partialTimeAggregatedResult = await this.getTimeAggregatedResult(
        data
      )
      timeAggregatedResult = mergeWith(
        timeAggregatedResult,
        partialTimeAggregatedResult,
        (a: AggregationData, b: AggregationData) => {
          return mergeWith(
            a,
            b,
            (keys1: string[] | undefined, keys2: string[] | undefined) =>
              uniq((keys1 ?? []).concat(keys2 ?? []))
          )
        }
      )
    }
    await this.saveRebuiltRuleAggregations('origin', timeAggregatedResult)
  }

  private async getData(): Promise<Set<string>> {
    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp!,
      this.parameters.timeWindow
    )
    const userAggregationData = await this.getRuleAggregations<AggregationData>(
      'origin',
      afterTimestamp,
      beforeTimestamp
    )
    if (userAggregationData) {
      return new Set(userAggregationData.flatMap((v) => v.cardFingerprints))
    }

    if (this.shouldUseRawData()) {
      const uniqueCards = new Set<string>()
      for await (const data of this.getRawTransactionsData()) {
        const sendingTransactionsWithCard = data.filter(
          (transaction) =>
            (transaction?.originPaymentDetails as CardDetails)?.cardFingerprint
        )
        Array.from(this.getUniqueCards(sendingTransactionsWithCard)).forEach(
          (card) => uniqueCards.add(card)
        )
      }
      return uniqueCards
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
    return this.parameters.timeWindow
  }
  protected getRuleAggregationVersion(): number {
    return 2
  }
}
