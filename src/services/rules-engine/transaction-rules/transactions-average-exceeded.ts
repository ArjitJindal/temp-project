import { JSONSchemaType } from 'ajv'
import { isTransactionInTargetTypes } from '../utils/transaction-rule-utils'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { TRANSACTION_TYPES } from '@/@types/tranasction/transaction-type'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import {
  subtractTime,
  TIME_WINDOW_SCHEMA,
  TimeWindow,
  PAYMENT_METHODS,
} from '@/services/rules-engine/utils/time-utils'
import dayjs from '@/utils/dayjs'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { RuleResult } from '@/services/rules-engine/rule'
import { getTargetCurrencyAmount } from '@/utils/currency-utils'
import { neverThrow } from '@/utils/lang'

type AvgMethod = 'amount' | 'number'
type User = 'origin' | 'destination'
type Direction = 'sending' | 'receiving'

export type TransactionsAverageExceededParameters =
  DefaultTransactionRuleParameters & {
    period1: TimeWindow
    period2: TimeWindow
    multiplierThresholds: {
      [currency: string]: number
    }
    transactionTypes?: TransactionType[]
    paymentMethod?: string
    checkSender: 'sending' | 'all' | 'none'
    checkReceiver: 'receiving' | 'all' | 'none'
    avgMethod?: AvgMethod
  }

export default class TransactionAverageExceededRule extends TransactionRule<TransactionsAverageExceededParameters> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<TransactionsAverageExceededParameters> {
    return {
      type: 'object',
      properties: {
        period1: TIME_WINDOW_SCHEMA,
        period2: TIME_WINDOW_SCHEMA,
        multiplierThresholds: {
          type: 'object',
          title: 'Maximum multiplier',
          additionalProperties: {
            type: 'integer',
            minimum: 1,
          },
          required: [],
          nullable: false,
        },
        paymentMethod: {
          type: 'string',
          title: 'Method of payment',
          enum: PAYMENT_METHODS,
          nullable: true,
        },
        transactionState: {
          type: 'string',
          enum: [
            'CREATED',
            'PROCESSING',
            'SENT',
            'EXPIRED',
            'DECLINED',
            'SUSPENDED',
            'REFUNDED',
            'SUCCESSFUL',
          ],
          title: 'Target Transaction State',
          description:
            'If not specified, all transactions regardless of the state will be used for running the rule',
          nullable: true,
        },
        transactionTypes: {
          type: 'array',
          title: 'Target Transaction Types',
          items: {
            type: 'string',
            enum: TRANSACTION_TYPES,
          },
          uniqueItems: true,
          nullable: true,
        },
        checkSender: {
          type: 'string',
          title: 'Origin User Transaction Direction',
          enum: ['sending', 'all', 'none'], // check origin user, only for sending transactions or as a receiver too
          nullable: false,
        },
        checkReceiver: {
          type: 'string',
          title: 'Destination User Transaction Direction',
          enum: ['receiving', 'all', 'none'],
          nullable: false,
        },
        avgMethod: {
          type: 'string',
          title: 'Calculation method',
          enum: ['amount', 'number'],
          nullable: true,
        },
      },
      required: [
        'period1',
        'period2',
        'multiplierThresholds',
        'checkSender',
        'checkReceiver',
      ],
    }
  }

  private async avg(
    avgMethod: AvgMethod,
    user: User,
    direction: Direction,
    currency: string,
    period1: TimeWindow,
    period2: TimeWindow
  ): Promise<[number, number]> {
    const repo = this.transactionRepository as TransactionRepository

    const afterTimestamp1 = subtractTime(
      dayjs(this.transaction.timestamp),
      period1
    )
    const afterTimestamp2 = subtractTime(
      dayjs(this.transaction.timestamp),
      period2
    )

    const userId =
      user === 'origin'
        ? this.transaction.originUserId
        : this.transaction.destinationUserId
    const paymentDetails =
      user === 'origin'
        ? this.transaction.originPaymentDetails
        : this.transaction.destinationPaymentDetails

    const [ids1, ids2] = await Promise.all([
      this.getTransactionsInTimeWindow(
        userId,
        paymentDetails,
        afterTimestamp1,
        direction
      ),
      this.getTransactionsInTimeWindow(
        userId,
        paymentDetails,
        afterTimestamp2,
        direction
      ),
    ])

    const checkOriginSending = user === 'origin' && direction === 'sending'
    const checkDestinationReceiving =
      user === 'destination' && direction === 'receiving'
    const includeCurrentTransaction =
      checkOriginSending || checkDestinationReceiving

    if (avgMethod === 'amount') {
      const [transactions1, transactions2] = await Promise.all([
        repo.getTransactionsByIds(ids1),
        repo.getTransactionsByIds(ids2),
      ])

      if (includeCurrentTransaction) {
        transactions1.push(this.transaction)
        transactions2.push(this.transaction)
      }

      const amountDetails1 = transactions1
        .map((x) =>
          direction === 'sending'
            ? x.originAmountDetails
            : x.destinationAmountDetails
        )
        .filter((x): x is TransactionAmountDetails => x != null)
      const amountDetails2 = transactions2
        .map((x) =>
          direction === 'sending'
            ? x.originAmountDetails
            : x.destinationAmountDetails
        )
        .filter((x): x is TransactionAmountDetails => x != null)

      return await Promise.all([
        avgTransactionAmount(amountDetails1, currency, period1.units),
        avgTransactionAmount(amountDetails2, currency, period2.units),
      ])
    } else if (avgMethod === 'number') {
      if (includeCurrentTransaction && this.transaction.transactionId) {
        ids1.push(this.transaction.transactionId)
        ids2.push(this.transaction.transactionId)
      }
      return [ids1.length / period1.units, ids2.length / period2.units]
    } else {
      throw neverThrow(avgMethod, `Method not supported: ${avgMethod}`)
    }
  }

  public getFilters() {
    const { paymentMethod, transactionTypes } = this.parameters
    return [
      ...super.getFilters(),
      () =>
        !paymentMethod ||
        this.transaction.originPaymentDetails?.method === paymentMethod,
      () => isTransactionInTargetTypes(this.transaction.type, transactionTypes),
    ]
  }

  private async getTransactionsInTimeWindow(
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined,
    afterTimestamp: number,
    direction: Direction
  ): Promise<string[]> {
    const repo = this.transactionRepository as TransactionRepository

    const timeRange = {
      afterTimestamp,
      beforeTimestamp: this.transaction.timestamp ?? Date.now(),
    }
    const filterOptions = {
      transactionState: this.parameters.transactionState,
      transactionTypes: this.parameters.transactionTypes,
    }

    const result =
      direction === 'sending'
        ? await repo.getGenericUserSendingThinTransactions(
            userId,
            paymentDetails,
            timeRange,
            filterOptions
          )
        : await repo.getGenericUserReceivingThinTransactions(
            userId,
            paymentDetails,
            timeRange,
            filterOptions
          )

    return result.map(({ transactionId }) => transactionId)
  }

  public async computeRule(): Promise<RuleResult | undefined> {
    this.transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const {
      period1,
      period2,
      multiplierThresholds,
      checkSender,
      checkReceiver,
      avgMethod = 'amount',
    } = this.parameters

    const toCheck: [User, Direction][] = []
    if (checkSender !== 'none') {
      toCheck.push(['origin', 'sending'])
      if (checkSender === 'all') {
        toCheck.push(['origin', 'receiving'])
      }
    }
    if (checkReceiver !== 'none') {
      toCheck.push(['destination', 'receiving'])
      if (checkReceiver === 'all') {
        toCheck.push(['destination', 'sending'])
      }
    }

    for (const [currency, maxMultiplier] of Object.entries(
      multiplierThresholds
    )) {
      for (const [user, direction] of toCheck) {
        const [avg1, avg2] = await this.avg(
          avgMethod,
          user,
          direction,
          currency,
          period1,
          period2
        )

        const multiplier = avg1 / avg2
        const result = multiplier > maxMultiplier
        if (result) {
          const vars = {
            ...super.getTransactionVars(user),
            period1,
            period2,
            multiplier,
            user,
            currency,
            direction,
          }
          return {
            action: this.action,
            vars,
          }
        }
      }
    }

    return undefined
  }
}

async function avgTransactionAmount(
  details: TransactionAmountDetails[],
  currency: string,
  timeUnits: number
): Promise<number> {
  if (details.length === 0) {
    return 0
  }

  const normalizedAmounts = await Promise.all(
    details.map((amountDetails) =>
      getTargetCurrencyAmount(amountDetails, currency)
    )
  )

  const sum = normalizedAmounts.reduce((acc, x) => acc + x.transactionAmount, 0)
  return sum / timeUnits
}
