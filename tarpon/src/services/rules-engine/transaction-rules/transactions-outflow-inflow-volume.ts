import { JSONSchemaType } from 'ajv'
import mergeWith from 'lodash/mergeWith'
import sumBy from 'lodash/sumBy'
import {
  COMPARATOR_SCHEMA,
  TIME_WINDOW_SCHEMA,
  TRANSACTION_TYPES_SCHEMA,
  VALUE_COMPARATOR_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionHistoricalFilters } from '../filters'
import { RuleHitResultItem } from '../rule'
import { getTimestampRange } from '../utils/time-utils'
import {
  getTransactionUserPastTransactionsByDirectionGenerator,
  getTransactionsTotalAmount,
  groupTransactionsByTime,
} from '../utils/transaction-rule-utils'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import { compareNumber } from '../utils/rule-schema-utils'
import { TransactionAggregationRule } from './aggregation-rule'
import { TimeWindow, Comparator, ValueComparator } from '@/@types/rule/params'
import { TransactionAmountDetails } from '@/@types/openapi-internal/TransactionAmountDetails'
import { CurrencyCode } from '@/@types/openapi-internal/CurrencyCode'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { mergeObjects } from '@/utils/object'
import { CurrencyService } from '@/services/currency'
import { traceable } from '@/core/xray'

export type TransactionsOutflowInflowVolumeRuleParameters = {
  timeWindow: TimeWindow
  outflowTransactionTypes: string[]
  inflowTransactionTypes: string[]
  outflowInflowComparator: Comparator
  outflow3dsDonePercentageThreshold?: ValueComparator
  inflow3dsDonePercentageThreshold?: ValueComparator
}

type AggregationResult = {
  outflowTransactionAmount: number
  inflowTransactionAmount: number
  outflowTransactionCount: number
  inflowTransactionCount: number
  outflow3dsDoneTransactionCount: number
  inflow3dsDoneTransactionCount: number
}

type AggregationData = Partial<AggregationResult>

@traceable
export default class TransactionsOutflowInflowVolumeRule extends TransactionAggregationRule<
  TransactionsOutflowInflowVolumeRuleParameters,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getSchema(): JSONSchemaType<TransactionsOutflowInflowVolumeRuleParameters> {
    return {
      type: 'object',
      properties: {
        timeWindow: TIME_WINDOW_SCHEMA(),
        outflowTransactionTypes: TRANSACTION_TYPES_SCHEMA({
          title: 'Outflow transaction types',
        }),
        inflowTransactionTypes: TRANSACTION_TYPES_SCHEMA({
          title: 'Inflow transaction types',
        }),
        outflowInflowComparator: COMPARATOR_SCHEMA({
          title: 'Outflow/Inflow transaction volume comparator',
          description:
            'Compares outflow transaction volume to inflow transaction volume',
        }),
        outflow3dsDonePercentageThreshold: VALUE_COMPARATOR_OPTIONAL_SCHEMA({
          title:
            'Percentage threshold of 3DS set to true (CARD payment method only) - Outflow Transactions',
        }),
        inflow3dsDonePercentageThreshold: VALUE_COMPARATOR_OPTIONAL_SCHEMA({
          title:
            'Percentage threshold of 3DS set to true (CARD payment method only) - Inflow Transactions',
        }),
      },
      required: [
        'timeWindow',
        'outflowTransactionTypes',
        'inflowTransactionTypes',
        'outflowInflowComparator',
      ],
    }
  }

  private getTargetCurrency(): CurrencyCode {
    return 'USD'
  }

  protected override getMaxTimeWindow(): TimeWindow {
    return this.parameters.timeWindow
  }

  protected override getRuleAggregationVersion(): number {
    return 2
  }

  protected override async getUpdatedTargetAggregation(
    direction: 'origin' | 'destination',
    aggregation: AggregationData | undefined
  ): Promise<AggregationData | null> {
    const amountDetails =
      direction === 'origin'
        ? this.transaction.originAmountDetails
        : this.transaction.destinationAmountDetails

    const paymentDetails =
      direction === 'origin'
        ? this.transaction.originPaymentDetails
        : this.transaction.destinationPaymentDetails

    if (!amountDetails) {
      return null
    }
    const currencyService = new CurrencyService(this.dynamoDb)
    const amount = await currencyService.getTargetCurrencyAmount(
      amountDetails,
      this.getTargetCurrency()
    )

    if (direction === 'origin') {
      return {
        ...aggregation,
        outflowTransactionAmount:
          (aggregation?.outflowTransactionAmount ?? 0) +
          amount.transactionAmount,
        outflowTransactionCount:
          (aggregation?.outflowTransactionCount ?? 0) + 1,
        outflow3dsDoneTransactionCount:
          (aggregation?.outflow3dsDoneTransactionCount ?? 0) +
          (this.is3dsDone(paymentDetails) ? 1 : 0),
      }
    } else {
      return {
        ...aggregation,
        inflowTransactionAmount:
          (aggregation?.inflowTransactionAmount ?? 0) +
          amount.transactionAmount,
        inflowTransactionCount: (aggregation?.inflowTransactionCount ?? 0) + 1,
        inflow3dsDoneTransactionCount:
          (aggregation?.inflow3dsDoneTransactionCount ?? 0) +
          (this.is3dsDone(paymentDetails) ? 1 : 0),
      }
    }
  }

  public async computeRule() {
    return {
      ruleHitResult: (
        await Promise.all([
          this.computeRuleUser('origin'),
          this.computeRuleUser('destination'),
        ])
      )
        .filter(Boolean)
        .flat(),
    }
  }

  protected async computeRuleUser(
    direction: 'origin' | 'destination'
  ): Promise<RuleHitResultItem | undefined> {
    const { outflowTransactionTypes, inflowTransactionTypes } = this.parameters

    if (!this.transaction.type) {
      return
    }

    const amountDetails =
      direction === 'origin'
        ? this.transaction.originAmountDetails
        : this.transaction.destinationAmountDetails

    if (!amountDetails) {
      return
    }

    if (
      direction === 'origin' &&
      !outflowTransactionTypes.includes(this.transaction.type)
    ) {
      return
    }

    if (
      direction === 'destination' &&
      !inflowTransactionTypes.includes(this.transaction.type)
    ) {
      return
    }

    const {
      outflowTransactionAmount,
      inflowTransactionAmount,
      outflowTransactionCount,
      inflowTransactionCount,
      outflow3dsDoneTransactionCount,
      inflow3dsDoneTransactionCount,
    } = await this.getData(direction)

    const {
      outflowInflowComparator,
      outflow3dsDonePercentageThreshold,
      inflow3dsDonePercentageThreshold,
    } = this.parameters

    if (direction === 'origin' && outflow3dsDonePercentageThreshold) {
      const outflow3dsDonePercentage = this.get3dsDonePercentage(
        outflowTransactionCount,
        outflow3dsDoneTransactionCount
      )

      if (
        !compareNumber(
          outflow3dsDonePercentage,
          outflow3dsDonePercentageThreshold
        )
      ) {
        return undefined
      }
    }

    if (direction === 'destination' && inflow3dsDonePercentageThreshold) {
      const inflow3dsDonePercentage = this.get3dsDonePercentage(
        inflowTransactionCount,
        inflow3dsDoneTransactionCount
      )

      if (
        !compareNumber(
          inflow3dsDonePercentage,
          inflow3dsDonePercentageThreshold
        )
      ) {
        return undefined
      }
    }

    if (!outflowTransactionCount || !inflowTransactionCount) {
      return
    }

    let hit = false

    switch (outflowInflowComparator) {
      case 'GREATER_THAN_OR_EQUAL_TO':
        hit = outflowTransactionAmount >= inflowTransactionAmount
        break
      case 'LESS_THAN_OR_EQUAL_TO':
        hit = outflowTransactionAmount <= inflowTransactionAmount
        break
    }

    if (!hit) {
      return
    }

    return {
      direction: direction === 'origin' ? 'ORIGIN' : 'DESTINATION',
      vars: {
        ...super.getTransactionVars(direction),
        outflowAmount: {
          transactionAmount: outflowTransactionAmount,
          transactionCurrency: amountDetails.transactionCurrency,
        } as TransactionAmountDetails,
        inflowAmount: {
          transactionAmount: inflowTransactionAmount,
          transactionCurrency: amountDetails.transactionCurrency,
        } as TransactionAmountDetails,
      },
    } as RuleHitResultItem
  }

  private async *getRawTransactionsData(
    direction: 'origin' | 'destination'
  ): AsyncGenerator<{
    sendingTransactions: AuxiliaryIndexTransaction[]
    receivingTransactions: AuxiliaryIndexTransaction[]
  }> {
    const { timeWindow } = this.parameters

    yield* getTransactionUserPastTransactionsByDirectionGenerator(
      this.transaction,
      direction,
      this.transactionRepository,
      {
        timeWindow,
        checkDirection: 'all',
        matchPaymentMethodDetails: false,
        filters: this.filters,
      },
      [
        'originAmountDetails',
        'destinationAmountDetails',
        'originPaymentDetails',
        'destinationPaymentDetails',
      ]
    )
  }

  private async getData(
    direction: 'origin' | 'destination'
  ): Promise<AggregationResult> {
    const { timeWindow } = this.parameters
    const { beforeTimestamp, afterTimestamp } = getTimestampRange(
      this.transaction.timestamp,
      timeWindow
    )

    const transaction = this.transaction

    const userAggregationData = await this.getRuleAggregations<AggregationData>(
      direction,
      afterTimestamp,
      beforeTimestamp
    )

    if (userAggregationData) {
      let amount = 0
      let currency = this.getTargetCurrency()

      if (direction === 'origin' && transaction.originAmountDetails) {
        amount = transaction.originAmountDetails.transactionAmount
        currency = transaction.originAmountDetails.transactionCurrency
      } else if (
        direction === 'destination' &&
        transaction.destinationAmountDetails
      ) {
        amount = transaction.destinationAmountDetails.transactionAmount
        currency = transaction.destinationAmountDetails.transactionCurrency
      }

      const sumOutflowAmounts = sumBy(
        userAggregationData,
        (data) => data.outflowTransactionAmount ?? 0
      )

      const sumInflowAmounts = sumBy(
        userAggregationData,
        (data) => data.inflowTransactionAmount ?? 0
      )
      const currencyService = new CurrencyService(this.dynamoDb)

      const [outflowTransactionAmount, inflowTransactionAmount] =
        await Promise.all([
          currencyService.getTargetCurrencyAmount(
            {
              transactionAmount: sumOutflowAmounts,
              transactionCurrency: this.getTargetCurrency(),
            },
            currency
          ),
          currencyService.getTargetCurrencyAmount(
            {
              transactionAmount: sumInflowAmounts,
              transactionCurrency: this.getTargetCurrency(),
            },
            currency
          ),
        ])

      const sumOutflowTransactionCount = sumBy(
        userAggregationData,
        (data) => data.outflowTransactionCount ?? 0
      )

      const sumInflowTransactionCount = sumBy(
        userAggregationData,
        (data) => data.inflowTransactionCount ?? 0
      )

      const sumOutflow3dsDoneTransactionCount = sumBy(
        userAggregationData,
        (data) => data.outflow3dsDoneTransactionCount ?? 0
      )

      const sumInflow3dsDoneTransactionCount = sumBy(
        userAggregationData,
        (data) => data.inflow3dsDoneTransactionCount ?? 0
      )

      return {
        outflowTransactionAmount:
          direction === 'origin'
            ? outflowTransactionAmount.transactionAmount + amount
            : outflowTransactionAmount.transactionAmount,
        inflowTransactionAmount:
          direction === 'destination'
            ? inflowTransactionAmount.transactionAmount + amount
            : inflowTransactionAmount.transactionAmount,
        outflowTransactionCount:
          direction === 'origin'
            ? sumOutflowTransactionCount + 1
            : sumOutflowTransactionCount,
        inflowTransactionCount:
          direction === 'destination'
            ? sumInflowTransactionCount + 1
            : sumInflowTransactionCount,
        outflow3dsDoneTransactionCount:
          direction === 'origin'
            ? sumOutflow3dsDoneTransactionCount +
              (this.is3dsDone(transaction.originPaymentDetails) ? 1 : 0)
            : sumOutflow3dsDoneTransactionCount,
        inflow3dsDoneTransactionCount:
          direction === 'destination'
            ? sumInflow3dsDoneTransactionCount +
              (this.is3dsDone(transaction.destinationPaymentDetails) ? 1 : 0)
            : sumInflow3dsDoneTransactionCount,
      }
    }

    let aggregationResult = await this.getAggregationResult(
      direction,
      direction === 'origin' ? [this.transaction] : [],
      direction === 'origin' ? [] : [this.transaction]
    )
    if (this.shouldUseRawData()) {
      for await (const data of this.getRawTransactionsData(direction)) {
        const partialTimeAggregatedResult = await this.getAggregationResult(
          direction,
          data.sendingTransactions,
          data.receivingTransactions
        )
        aggregationResult = mergeWith(
          aggregationResult,
          partialTimeAggregatedResult,
          (x: number | undefined, y: number | undefined) => (x ?? 0) + (y ?? 0)
        )
      }
    }
    return aggregationResult
  }

  public shouldUpdateUserAggregation(
    _direction: 'origin' | 'destination',
    isTransactionHistoricalFiltered: boolean
  ): boolean {
    return isTransactionHistoricalFiltered
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
        (a: AggregationData, b: AggregationData) => {
          return mergeWith(
            a,
            b,
            (x: number | undefined, y: number | undefined) =>
              (x ?? 0) + (y ?? 0)
          )
        }
      )
    }
    await this.saveRebuiltRuleAggregations(direction, timeAggregatedResult)
  }

  private async getAggregationResult(
    direction: 'origin' | 'destination',
    sendingTransactions: AuxiliaryIndexTransaction[] = [],
    receivingTransactions: AuxiliaryIndexTransaction[] = []
  ): Promise<AggregationResult> {
    const outflowAmounts = sendingTransactions
      .map((transaction) => transaction.originAmountDetails)
      .filter(Boolean) as TransactionAmountDetails[]

    const inflowAmounts = receivingTransactions
      .map((transaction) => transaction.destinationAmountDetails)
      .filter(Boolean) as TransactionAmountDetails[]

    const outflowTransactionCount = sendingTransactions.length
    const inflowTransactionCount = receivingTransactions.length

    const [outflowAmountTotal, inflowAmountTotal] = await Promise.all([
      getTransactionsTotalAmount(
        outflowAmounts,
        this.getTargetCurrency(),
        this.dynamoDb
      ),
      getTransactionsTotalAmount(
        inflowAmounts,
        this.getTargetCurrency(),
        this.dynamoDb
      ),
    ])

    const outflow3dsDoneTransactionCount = sendingTransactions.filter(
      (transaction) => this.is3dsDone(transaction.originPaymentDetails)
    ).length

    const inflow3dsDoneTransactionCount = receivingTransactions.filter(
      (transaction) => this.is3dsDone(transaction.destinationPaymentDetails)
    ).length

    return {
      outflowTransactionAmount: outflowAmountTotal.transactionAmount,
      inflowTransactionAmount: inflowAmountTotal.transactionAmount,
      outflowTransactionCount,
      inflowTransactionCount,
      outflow3dsDoneTransactionCount,
      inflow3dsDoneTransactionCount,
    }
  }

  private async getTimeAggregatedResult(
    sendingTransactions: AuxiliaryIndexTransaction[],
    receivingTransactions: AuxiliaryIndexTransaction[]
  ) {
    return mergeObjects(
      await groupTransactionsByTime<AggregationData>(
        sendingTransactions,
        async (group) => {
          const outflowAmounts = sendingTransactions
            .map((transaction) => transaction.originAmountDetails)
            .filter(Boolean) as TransactionAmountDetails[]

          const outflowAmountTotal = await getTransactionsTotalAmount(
            outflowAmounts,
            this.getTargetCurrency(),
            this.dynamoDb
          )

          const outflow3dsDoneTransactionCount = sendingTransactions.filter(
            (transaction) => this.is3dsDone(transaction.originPaymentDetails)
          ).length

          return {
            outflowTransactionAmount: outflowAmountTotal.transactionAmount,
            outflowTransactionCount: group.length,
            outflow3dsDoneTransactionCount,
          }
        },
        this.getAggregationGranularity()
      ),
      await groupTransactionsByTime<AggregationData>(
        receivingTransactions,
        async (group) => {
          const inflowAmounts = receivingTransactions
            .map((transaction) => transaction.destinationAmountDetails)
            .filter(Boolean) as TransactionAmountDetails[]

          const inflowAmountTotal = await getTransactionsTotalAmount(
            inflowAmounts,
            this.getTargetCurrency(),
            this.dynamoDb
          )

          const inflow3dsDoneTransactionCount = receivingTransactions.filter(
            (transaction) =>
              this.is3dsDone(transaction.destinationPaymentDetails)
          ).length

          return {
            inflowTransactionAmount: inflowAmountTotal.transactionAmount,
            inflowTransactionCount: group.length,
            inflow3dsDoneTransactionCount,
          }
        },
        this.getAggregationGranularity()
      )
    )
  }

  private get3dsDonePercentage(
    totalTransactionCount: number,
    total3dsDoneTransactionCount: number
  ) {
    return totalTransactionCount === 0
      ? 0
      : (total3dsDoneTransactionCount / totalTransactionCount) * 100
  }

  private is3dsDone(paymentDetails: PaymentDetails | undefined) {
    return Boolean(
      paymentDetails?.method === 'CARD' && paymentDetails?.['3dsDone']
    )
  }
}
