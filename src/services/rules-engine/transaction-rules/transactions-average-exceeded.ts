import { JSONSchemaType } from 'ajv'
import { isTransactionInTargetTypes } from '../utils/transaction-rule-utils'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import {
  PaymentDetails,
  PaymentMethod,
} from '@/@types/tranasction/payment-type'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { TRANSACTION_TYPES } from '@/@types/tranasction/transaction-type'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { subtractTime } from '@/services/rules-engine/utils/time-utils'
import dayjs from '@/utils/dayjs'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { RuleResult, TimeWindow } from '@/services/rules-engine/rule'
import { getTargetCurrencyAmount } from '@/utils/currency-utils'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TIME_WINDOW_SCHEMA } from '@/services/rules-engine/utils'

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

export type TransactionsAverageExceededParameters =
  DefaultTransactionRuleParameters & {
    period1: TimeWindow
    period2: TimeWindow
    multiplierThresholds: {
      [currency: string]: number
    }
    transactionTypes?: TransactionType[]
    paymentMethod?: PaymentMethod
    checkSender: 'sending' | 'all' | 'none'
    checkReceiver: 'receiving' | 'all' | 'none'
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
          enum: ['ACH', 'CARD', 'IBAN', 'SWIFT', 'UPI', 'WALLET'],
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

  // todo: move to utils
  private async getTransactionsInTimeWindow(
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined,
    afterTimestamp: number,
    direction: 'sending' | 'receiving'
  ): Promise<Transaction[]> {
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

    return repo.getTransactionsByIds(
      result.map(({ transactionId }) => transactionId)
    )
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
    } = this.parameters

    const afterTimestamp1 = subtractTime(
      dayjs(this.transaction.timestamp),
      period1
    )
    const afterTimestamp2 = subtractTime(
      dayjs(this.transaction.timestamp),
      period2
    )

    const toCheck: ['origin' | 'destination', 'sending' | 'receiving'][] = []
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
        const userId =
          user === 'origin'
            ? this.transaction.originUserId
            : this.transaction.destinationUserId
        const paymentDetails =
          user === 'origin'
            ? this.transaction.originPaymentDetails
            : this.transaction.destinationPaymentDetails
        const [transactions1, transactions2] = await Promise.all([
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
        if (includeCurrentTransaction) {
          transactions1.push(this.transaction)
          transactions2.push(this.transaction)
        }

        const [avg1, avg2] = await Promise.all([
          avgTransactionAmount(
            transactions1
              .map((x) =>
                direction === 'sending'
                  ? x.originAmountDetails
                  : x.destinationAmountDetails
              )
              .filter((x): x is TransactionAmountDetails => x != null),
            currency,
            period1.units
          ),
          avgTransactionAmount(
            transactions2
              .map((x) =>
                direction === 'sending'
                  ? x.originAmountDetails
                  : x.destinationAmountDetails
              )
              .filter((x): x is TransactionAmountDetails => x != null),
            currency,
            period2.units
          ),
        ])

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
