import { isTransactionInTargetTypes } from '../utils/transaction-rule-utils'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import {
  subtractTime,
  TimeWindow,
  toGranularity,
} from '@/services/rules-engine/utils/time-utils'
import dayjs from '@/utils/dayjs'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { RuleResult } from '@/services/rules-engine/rule'
import { getTargetCurrencyAmount } from '@/utils/currency-utils'
import { neverThrow } from '@/utils/lang'
import { Business } from '@/@types/openapi-public/Business'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { User } from '@/@types/openapi-public/User'
import {
  isUserBetweenAge,
  isUserType,
} from '@/services/rules-engine/utils/user-rule-utils'
import { UserType } from '@/@types/user/user-type'

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
    paymentMethod?: string
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

export default class TransactionAverageExceededRule<
  Params extends TransactionsAverageExceededParameters
> extends TransactionRule<Params> {
  transactionRepository?: TransactionRepository

  private avgMethod: 'AMOUNT' | 'NUMBER'
  private multiplierThresholds: { [currency: string]: number }

  constructor(
    tenantId: string,
    data: {
      transaction: Transaction
      senderUser?: User | Business
      receiverUser?: User | Business
    },
    params: {
      parameters: Params
      action: RuleAction
    },
    dynamoDb: AWS.DynamoDB.DocumentClient,
    avgMethod: 'AMOUNT' | 'NUMBER',
    multiplierThresholds: { [currency: string]: number }
  ) {
    super(tenantId, data, params, dynamoDb)
    this.avgMethod = avgMethod
    this.multiplierThresholds = multiplierThresholds
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
    if (this.avgMethod === 'AMOUNT') {
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
    } else if (this.avgMethod === 'NUMBER') {
      result = [num1 / period1.units, num2 / period2.units]
    } else {
      throw neverThrow(
        this.avgMethod,
        `Method not supported: ${this.avgMethod}`
      )
    }

    if (
      (avgMin != null && result[0] < avgMin) ||
      (avgMax != null && result[0] > avgMax)
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
      this.multiplierThresholds
    )) {
      for (const [user, direction] of toCheck) {
        const avgs = await this.avg(user, direction, currency)
        if (avgs == null) {
          return
        }
        const [avg1, avg2] = avgs
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
