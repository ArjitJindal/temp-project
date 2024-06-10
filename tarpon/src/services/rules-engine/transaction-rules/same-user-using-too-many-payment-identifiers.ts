import { JSONSchemaType } from 'ajv'
import { compact, mergeWith, startCase, uniq } from 'lodash'
import { TransactionHistoricalFilters } from '../filters'
import { getTimestampRange } from '../utils/time-utils'
import {
  getTransactionUserPastTransactionsByDirectionGenerator,
  groupTransactionsByHour,
} from '../utils/transaction-rule-utils'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import { TIME_WINDOW_SCHEMA, TimeWindow } from '../utils/rule-parameter-schemas'
import { RuleHitResult } from '../rule'
import { TransactionAggregationRule } from './aggregation-rule'
import { traceable } from '@/core/xray'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { PAYMENT_METHOD_IDENTIFIER_FIELDS } from '@/core/dynamodb/dynamodb-keys'

type AggregationData = {
  paymentIdentifiers: string[]
}

export type SameUserUsingTooManyPaymentIdentifiersParameters = {
  uniquePaymentIdentifiersCountThreshold: number
  timeWindow: TimeWindow
}

@traceable
export default class SameUserUsingTooManyPaymentIdentifiersRule extends TransactionAggregationRule<
  SameUserUsingTooManyPaymentIdentifiersParameters,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getSchema(): JSONSchemaType<SameUserUsingTooManyPaymentIdentifiersParameters> {
    return {
      type: 'object',
      properties: {
        uniquePaymentIdentifiersCountThreshold: {
          type: 'integer',
          title: 'Payment identifiers count threshold',
          description:
            'rule is run when the payment identifiers count per time window is greater than the threshold',
        },
        timeWindow: TIME_WINDOW_SCHEMA(),
      },
      required: ['uniquePaymentIdentifiersCountThreshold', 'timeWindow'],
    }
  }

  public shouldUpdateUserAggregation(
    direction: 'origin' | 'destination',
    isTransactionFiltered: boolean
  ): boolean {
    return isTransactionFiltered && direction === 'origin'
  }

  public async computeRule() {
    if (
      !this.transaction.originPaymentDetails ||
      !this.transaction.originUserId
    ) {
      return
    }

    const paymentIdentifier = this.getUniqueIdentifier(
      this.transaction.originPaymentDetails
    )

    const uniquePaymentIdentifiers = await this.getData()

    if (paymentIdentifier) {
      uniquePaymentIdentifiers.add(paymentIdentifier)
    }

    const hitResult: RuleHitResult = []

    if (
      uniquePaymentIdentifiers.size >
      this.parameters.uniquePaymentIdentifiersCountThreshold
    ) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: {
          ...super.getTransactionVars('origin'),
          uniquePaymentIdentifiersCount: uniquePaymentIdentifiers.size,
        },
      })
    }

    return hitResult
  }

  private async getData(): Promise<Set<string>> {
    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp,
      this.parameters.timeWindow
    )

    const userAggregationData = await this.getRuleAggregations<AggregationData>(
      'origin',
      afterTimestamp,
      beforeTimestamp
    )

    if (userAggregationData) {
      return new Set(userAggregationData.flatMap((v) => v.paymentIdentifiers))
    }

    if (this.shouldUseRawData()) {
      const uniquePaymentIdentifiers = new Set<string>()
      for await (const data of this.getRawTransactionsData()) {
        Array.from(this.getUniquePaymentIdentifers(data)).forEach((v) =>
          uniquePaymentIdentifiers.add(v)
        )
      }

      return uniquePaymentIdentifiers
    } else {
      return new Set()
    }
  }

  private async *getRawTransactionsData(): AsyncGenerator<
    AuxiliaryIndexTransaction[]
  > {
    const generator = getTransactionUserPastTransactionsByDirectionGenerator(
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

  private getUniquePaymentIdentifers(
    transactions: AuxiliaryIndexTransaction[]
  ): Set<string> {
    const paymentIdentifiers = transactions.map((transaction) => {
      return this.getUniqueIdentifier(transaction?.originPaymentDetails)
    })

    return new Set(compact(paymentIdentifiers))
  }

  override async getUpdatedTargetAggregation(
    _direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined
  ): Promise<AggregationData | null> {
    const paymentIdentifier = this.getUniqueIdentifier(
      this.transaction.originPaymentDetails
    )

    if (!paymentIdentifier) {
      return null
    }
    return {
      paymentIdentifiers: Array.from(
        new Set(
          (targetAggregationData?.paymentIdentifiers ?? []).concat(
            paymentIdentifier
          )
        )
      ),
    }
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

  private async getTimeAggregatedResult(
    sendingTransactionsWithCard: AuxiliaryIndexTransaction[]
  ) {
    return groupTransactionsByHour<AggregationData>(
      sendingTransactionsWithCard,
      async (group) => ({
        paymentIdentifiers: Array.from(this.getUniquePaymentIdentifers(group)),
      })
    )
  }

  override getMaxTimeWindow(): TimeWindow {
    return this.parameters.timeWindow
  }
  protected getRuleAggregationVersion(): number {
    return 1
  }

  private getUniqueIdentifier(paymentDetails: PaymentDetails | undefined) {
    if (paymentDetails?.method === undefined) {
      return undefined
    }
    const identifiers = PAYMENT_METHOD_IDENTIFIER_FIELDS[paymentDetails?.method]
    return identifiers
      .map(
        (identifier: string) =>
          `${startCase(identifier)}: ${paymentDetails[identifier]}`
      )
      .join(', ')
  }
}
