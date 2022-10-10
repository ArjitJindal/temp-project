import { isTransactionInTargetTypes } from '../utils/transaction-rule-utils'
import {
  AGE_RANGE_OPTIONAL_SCHEMA,
  CHECK_RECEIVER_SCHEMA,
  CHECK_SENDER_SCHEMA,
  PAYMENT_METHOD_OPTIONAL_SCHEMA,
  TIME_WINDOW_SCHEMA,
  TimeWindow,
  TRANSACTION_STATE_OPTIONAL_SCHEMA,
  TRANSACTION_TYPES_OPTIONAL_SCHEMA,
  USER_TYPE_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import {
  PaymentDetails,
  PaymentMethod,
} from '@/@types/tranasction/payment-type'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import {
  subtractTime,
  toGranularity,
} from '@/services/rules-engine/utils/time-utils'
import dayjs from '@/utils/dayjs'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { RuleResult } from '@/services/rules-engine/rule'
import { getTargetCurrencyAmount } from '@/utils/currency-utils'
import { neverThrow } from '@/utils/lang'
import {
  isUserBetweenAge,
  isUserType,
} from '@/services/rules-engine/utils/user-rule-utils'
import { UserType } from '@/@types/user/user-type'
import { ExtendedJSONSchemaType } from '@/services/rules-engine/utils/rule-schema-utils'
import { multiplierToPercents } from '@/services/rules-engine/utils/math-utils'

type UserParty = 'origin' | 'destination'
type Direction = 'sending' | 'receiving'

export type TransactionsAverageExceededParameters =
  DefaultTransactionRuleParameters & {
    period1: TimeWindow
    period2: TimeWindow
    excludePeriod1?: boolean
    ageRange?: {
      minAge?: number
      maxAge?: number
    }
    userType?: UserType
    transactionTypes?: TransactionType[]
    paymentMethod?: PaymentMethod
    checkSender: 'sending' | 'all' | 'none'
    checkReceiver: 'receiving' | 'all' | 'none'
    transactionsNumberThreshold?: {
      min?: number
      max?: number
    }
    averageThreshold?: {
      min?: number
      max?: number
    }
  }

export default class TransactionAverageExceededBaseRule<
  Params extends TransactionsAverageExceededParameters
> extends TransactionRule<Params> {
  transactionRepository?: TransactionRepository

  public static getBaseSchema(): ExtendedJSONSchemaType<TransactionsAverageExceededParameters> {
    return {
      type: 'object',
      properties: {
        period1: TIME_WINDOW_SCHEMA({
          title: 'period1 (Current period)',
        }),
        period2: TIME_WINDOW_SCHEMA({
          title: 'period2 (Reference period, should be larger than period1)',
        }),
        excludePeriod1: {
          type: 'boolean',
          title: 'Exclude transactions in period1 from period2',
          nullable: true,
        },
        transactionsNumberThreshold: {
          type: 'object',
          title:
            "Rule doesn't trigger if transactions number in period1 in less than 'Min' or more than 'Max'",
          properties: {
            min: { type: 'integer', title: 'Min', nullable: true },
            max: { type: 'integer', title: 'Max', nullable: true },
          },
          required: [],
          nullable: true,
        },
        averageThreshold: {
          type: 'object',
          title:
            "Rule doesn't trigger if average in period1 in less than 'Min' or more than 'Max'",
          properties: {
            min: { type: 'integer', title: 'Min', nullable: true },
            max: { type: 'integer', title: 'Max', nullable: true },
          },
          required: [],
          nullable: true,
        },
        paymentMethod: PAYMENT_METHOD_OPTIONAL_SCHEMA(),
        transactionState: TRANSACTION_STATE_OPTIONAL_SCHEMA(),
        transactionTypes: TRANSACTION_TYPES_OPTIONAL_SCHEMA(),
        checkSender: CHECK_SENDER_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_SCHEMA(),
        ageRange: AGE_RANGE_OPTIONAL_SCHEMA(),
        userType: USER_TYPE_OPTIONAL_SCHEMA(),
      },
      required: ['period1', 'period2', 'checkSender', 'checkReceiver'],
      'ui:schema': {
        'ui:order': [
          'period1',
          'period2',
          'excludePeriod1',
          'paymentMethod',
          'transactionState',
          'transactionTypes',
          'checkSender',
          'checkReceiver',
          'ageRange',
          'userType',
          'transactionsNumberThreshold',
          'averageThreshold',
        ],
      },
    }
  }

  protected getMultiplierThresholds(): { [currency: string]: number } {
    throw new Error('Not implemented')
  }

  protected getAvgMethod(): 'AMOUNT' | 'NUMBER' {
    throw new Error('Not implemented')
  }

  private async avg(
    user: UserParty,
    direction: Direction,
    currency: string
  ): Promise<[number, number] | undefined> {
    const {
      period1,
      period2,
      averageThreshold,
      transactionsNumberThreshold,
      excludePeriod1,
    } = this.parameters

    const { min: avgMin, max: avgMax } = averageThreshold ?? {}
    const { min: numMin, max: numMax } = transactionsNumberThreshold ?? {}

    const repo = this.transactionRepository as TransactionRepository

    const afterTimestamp1 = subtractTime(
      dayjs(this.transaction.timestamp),
      period1
    )
    const afterTimestamp2 = subtractTime(
      dayjs(this.transaction.timestamp),
      period2
    )

    const beforeTimestamp1 = this.transaction.timestamp ?? Date.now()
    const beforeTimestamp2 = excludePeriod1 ? afterTimestamp1 : beforeTimestamp1

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
        beforeTimestamp1,
        direction
      ),
      this.getTransactionsInTimeWindow(
        userId,
        paymentDetails,
        afterTimestamp2,
        beforeTimestamp2,
        direction
      ),
    ])

    const checkOriginSending = user === 'origin' && direction === 'sending'
    const checkDestinationReceiving =
      user === 'destination' && direction === 'receiving'
    const includeCurrentTransaction =
      checkOriginSending || checkDestinationReceiving

    let num1 = ids1.length
    let num2 = ids2.length

    if (includeCurrentTransaction && this.transaction.transactionId) {
      num1++
      if (!excludePeriod1) {
        num2++
      }
    }

    if ((numMin && num1 < numMin) || (numMax && num1 > numMax)) {
      return
    }

    let result: [number, number]
    const avgMethod = this.getAvgMethod()
    if (avgMethod === 'AMOUNT') {
      const [transactions1, transactions2] = await Promise.all([
        repo.getTransactionsByIds(ids1),
        repo.getTransactionsByIds(ids2),
      ])

      if (includeCurrentTransaction) {
        transactions1.push(this.transaction)
        if (!excludePeriod1) {
          transactions2.push(this.transaction)
        }
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

      const units1 = period1.units
      const units2 = excludePeriod1
        ? toGranularity(period2, period1.granularity).units - period1.units
        : period2.units

      result = await Promise.all([
        avgTransactionAmount(amountDetails1, currency, units1),
        avgTransactionAmount(amountDetails2, currency, units2),
      ])
    } else if (avgMethod === 'NUMBER') {
      result = [num1 / period1.units, num2 / period2.units]
    } else {
      throw neverThrow(avgMethod, `Method not supported: ${avgMethod}`)
    }

    if (
      (avgMin != null && multiplierToPercents(result[0]) < avgMin) ||
      (avgMax != null && multiplierToPercents(result[0]) > avgMax)
    ) {
      return
    }

    return result
  }

  public getFilters() {
    const { paymentMethod, transactionTypes, ageRange, userType } =
      this.parameters
    return [
      ...super.getFilters(),
      () => !ageRange || isUserBetweenAge(this.senderUser, ageRange),
      () => isUserType(this.senderUser, userType),
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
    beforeTimestamp: number,
    direction: Direction
  ): Promise<string[]> {
    const repo = this.transactionRepository as TransactionRepository

    const timeRange = {
      afterTimestamp,
      beforeTimestamp,
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

    const { period1, period2, checkSender, checkReceiver } = this.parameters

    const toCheck: [UserParty, Direction][] = []
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
      this.getMultiplierThresholds()
    )) {
      for (const [user, direction] of toCheck) {
        const avgs = await this.avg(user, direction, currency)
        if (avgs == null) {
          return
        }
        const [avg1, avg2] = avgs
        const multiplier = avg1 / avg2
        const result = multiplierToPercents(multiplier) > maxMultiplier
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
  units: number
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
  return sum / units
}
