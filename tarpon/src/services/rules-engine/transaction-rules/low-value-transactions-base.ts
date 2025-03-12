import { JSONSchemaType } from 'ajv'
import { uniqBy } from 'lodash'
import {
  checkTransactionAmountBetweenThreshold,
  getTransactionStatsTimeGroupLabelV2,
} from '../utils/transaction-rule-utils'
import {
  TimeWindow,
  TRANSACTION_AMOUNT_RANGE_SCHEMA,
  TransactionAmountRange,
} from '../utils/rule-parameter-schemas'
import { TransactionHistoricalFilters } from '../filters'
import { RuleHitResultItem } from '../rule'
import { TransactionAggregationRule } from './aggregation-rule'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { PaymentDirection } from '@/@types/tranasction/payment-direction'
import { traceable } from '@/core/xray'
import { everyAsync } from '@/utils/array'

export type LowValueTransactionsRuleParameters = {
  lowTransactionValues: TransactionAmountRange
  lowTransactionCount: number
}

type AggregationData = {
  lastNTransactionAmounts: Array<TransactionAmountDetails | undefined>
}

@traceable
export default abstract class LowValueTransactionsRule extends TransactionAggregationRule<
  LowValueTransactionsRuleParameters,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getSchema(): JSONSchemaType<LowValueTransactionsRuleParameters> {
    return {
      type: 'object',
      properties: {
        lowTransactionValues: TRANSACTION_AMOUNT_RANGE_SCHEMA({
          title: 'Low transaction value',
        }),
        lowTransactionCount: {
          type: 'integer',
          title: 'Low-value transactions count threshold',
          description:
            'rule is run when the transactions count is greater or equal to threshold',
        },
      },
      required: ['lowTransactionValues', 'lowTransactionCount'],
    }
  }

  protected abstract getDirection(): PaymentDirection

  private getTransactionUserId(): string | undefined {
    return this.getDirection() === 'sending'
      ? this.transaction.originUserId
      : this.transaction.destinationUserId
  }

  private getTransactionAmountDetails(
    transaction: Transaction
  ): TransactionAmountDetails | undefined {
    return this.getDirection() === 'sending'
      ? transaction.originAmountDetails
      : transaction.destinationAmountDetails
  }

  protected async computeRuleUser(
    direction: 'origin' | 'destination'
  ): Promise<RuleHitResultItem | undefined> {
    if (
      (direction === 'origin' && this.getDirection() !== 'sending') ||
      (direction === 'destination' && this.getDirection() !== 'receiving')
    ) {
      return
    }

    const userId = this.getTransactionUserId()
    if (!userId) {
      return
    }

    const data = await this.getData(direction)
    if (!data || data.length <= this.parameters.lowTransactionCount - 1) {
      return
    }

    const areAllTransactionsLowValue = await everyAsync(
      data,
      async (transactionAmountDetails) =>
        (await checkTransactionAmountBetweenThreshold(
          transactionAmountDetails,
          this.parameters.lowTransactionValues,
          this.dynamoDb
        )) != null
    )

    if (areAllTransactionsLowValue) {
      return {
        direction: direction.toUpperCase() as 'ORIGIN' | 'DESTINATION',
        vars: {
          ...super.getTransactionVars(direction),
          transactionCountDelta:
            this.parameters.lowTransactionCount - data.length + 1,
        },
      }
    }
  }

  private async getData(
    direction: 'origin' | 'destination'
  ): Promise<AggregationData['lastNTransactionAmounts'] | undefined> {
    const userId = this.getTransactionUserId()
    if (!userId) {
      return
    }

    const userAggregationData = await this.getRuleAggregations<AggregationData>(
      direction,
      this.getStaticTimestamp(),
      this.getStaticTimestamp() + 1
    )

    if (userAggregationData && userAggregationData.length) {
      return [
        ...userAggregationData[0].lastNTransactionAmounts,
        this.getTransactionAmountDetails(this.transaction),
      ]
    }

    if (this.shouldUseRawData()) {
      const transactions = await this.getRawTransactionsData(direction, userId)
      transactions.push(this.transaction)
      const uniqTransactions = uniqBy(transactions, 'transactionId')
      return uniqTransactions.map(this.getTransactionAmountDetails.bind(this))
    }
  }

  private async getRawTransactionsData(
    direction: 'origin' | 'destination',
    userId: string
  ): Promise<Transaction[]> {
    const lastNTransactionsToCheck = this.parameters.lowTransactionCount - 1
    const commonOptions = {
      transactionStates: this.filters.transactionStatesHistorical,
      transactionTypes: this.filters.transactionTypesHistorical,
      transactionAmountRange: this.filters.transactionAmountRangeHistorical,
    }
    const fields: Array<keyof Transaction> = [
      'transactionId',
      'originAmountDetails',
      'destinationAmountDetails',
    ]

    const transactions = (await (direction === 'origin'
      ? this.transactionRepository.getLastNUserSendingTransactions(
          userId,
          lastNTransactionsToCheck,
          {
            ...commonOptions,
            originPaymentMethods: this.filters.paymentMethodsHistorical,
            originCountries: this.filters.transactionCountriesHistorical,
          },
          fields
        )
      : this.transactionRepository.getLastNUserReceivingTransactions(
          userId,
          lastNTransactionsToCheck,
          {
            ...commonOptions,
            destinationPaymentMethods: this.filters.paymentMethodsHistorical,
            destinationCountries: this.filters.transactionCountriesHistorical,
          },
          fields
        ))) as Transaction[]
    return transactions.filter(
      (transaction) =>
        transaction.transactionId !== this.transaction.transactionId
    )
  }

  public async computeRule() {
    return Promise.all([
      this.computeRuleUser('origin'),
      this.computeRuleUser('destination'),
    ])
  }

  public async rebuildUserAggregation(
    direction: 'origin' | 'destination'
  ): Promise<void> {
    const userId = this.getTransactionUserId()
    if (!userId) {
      return
    }

    const transactions = await this.getRawTransactionsData(direction, userId)
    const lastNTransactionAmounts = transactions.map(
      this.getTransactionAmountDetails.bind(this)
    )
    await this.saveRebuiltRuleAggregations(direction, {
      [getTransactionStatsTimeGroupLabelV2(
        this.getStaticTimestamp(),
        this.getMaxTimeWindow().granularity
      )]: {
        lastNTransactionAmounts,
      },
    })
  }

  protected getStaticTimestamp(): number {
    return 0
  }

  public shouldUpdateUserAggregation(
    direction: 'origin' | 'destination',
    isTransactionFiltered: boolean
  ): boolean {
    return (
      isTransactionFiltered &&
      Boolean(this.getTransactionUserId()) &&
      ((direction === 'origin' && this.getDirection() === 'sending') ||
        (direction === 'destination' && this.getDirection() === 'receiving'))
    )
  }

  protected async getUpdatedTargetAggregation(
    direction: 'origin' | 'destination',
    aggregation: AggregationData | undefined,
    isTransactionFiltered: boolean
  ): Promise<AggregationData | null> {
    if (!this.shouldUpdateUserAggregation(direction, isTransactionFiltered)) {
      return null
    }

    const aggregationData = aggregation?.lastNTransactionAmounts ?? []

    const transactionAmountDetails = this.getTransactionAmountDetails(
      this.transaction
    )

    return {
      lastNTransactionAmounts: [
        transactionAmountDetails,
        ...aggregationData,
      ].slice(0, this.parameters.lowTransactionCount - 1),
    }
  }

  protected getMaxTimeWindow(): TimeWindow {
    return { granularity: 'year', units: 1 }
  }

  protected getRuleAggregationVersion(): number {
    return 3
  }
}
