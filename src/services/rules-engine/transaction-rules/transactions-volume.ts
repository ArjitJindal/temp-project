import { JSONSchemaType } from 'ajv'
import {
  ThinTransaction,
  TransactionRepository,
} from '../repositories/transaction-repository'
import {
  getTransactionsTotalAmount,
  isTransactionAmountAboveThreshold,
  isTransactionInTargetTypes,
  sumTransactionAmountDetails,
} from '../utils/transaction-rule-utils'
import { subtractTime } from '../utils/time-utils'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import dayjs from '@/utils/dayjs'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { TRANSACTION_TYPES } from '@/@types/tranasction/transaction-type'

export type TimeWindowGranularity =
  | 'second'
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'

export type TimeWindow = {
  units: number
  granularity: TimeWindowGranularity
  rollingBasis?: boolean
}
export type TransactionsVolumeRuleParameters =
  DefaultTransactionRuleParameters & {
    transactionVolumeThreshold: {
      [currency: string]: number
    }
    transactionTypes?: TransactionType[]
    timeWindow: TimeWindow
    checkSender: 'sending' | 'all' | 'none'
    checkReceiver: 'receiving' | 'all' | 'none'
  }

export default class TransactionsVolumeRule extends TransactionRule<TransactionsVolumeRuleParameters> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<TransactionsVolumeRuleParameters> {
    return {
      type: 'object',
      properties: {
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
        transactionVolumeThreshold: {
          type: 'object',
          title: 'Transactions Volume Threshold',
          additionalProperties: {
            type: 'integer',
          },
          required: [],
        },
        timeWindow: {
          type: 'object',
          title: 'Time Window',
          properties: {
            units: { type: 'integer', title: 'Number of time unit' },
            granularity: {
              type: 'string',
              title: 'Time granularity',
              enum: ['second', 'minute', 'hour', 'day', 'week', 'month'],
            },
            rollingBasis: {
              type: 'boolean',
              title: 'Rolling basis',
              description:
                'When rolling basis is disabled, system starts the time period at 00:00 for day, week, month time granularities',
              nullable: true,
            },
          },
          required: ['units', 'granularity'],
        },
        checkSender: {
          type: 'string',
          title: 'Origin User Transaction Direction',
          enum: ['sending', 'all', 'none'],
        },
        checkReceiver: {
          type: 'string',
          title: 'Destination User Transaction Direction',
          enum: ['receiving', 'all', 'none'],
        },
      },
      required: ['transactionVolumeThreshold', 'timeWindow'],
    }
  }

  public getFilters() {
    const { transactionTypes } = this.parameters
    return super
      .getFilters()
      .concat([
        () =>
          isTransactionInTargetTypes(this.transaction.type, transactionTypes),
      ])
  }

  private async computeHits(): Promise<{
    isSenderHit: boolean
    isReceiverHit: boolean
    amount: TransactionAmountDetails | null
  }> {
    const {
      checkSender,
      checkReceiver,
      transactionVolumeThreshold,
      timeWindow,
    } = this.parameters

    this.transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    // Retrieve all the transactions during the target time window
    const afterTimestamp = subtractTime(
      dayjs(this.transaction.timestamp),
      timeWindow
    )

    const senderTransactionsPromise =
      checkSender !== 'none'
        ? this.getTransactions(
            this.transaction.originUserId,
            this.transaction.originPaymentDetails,
            afterTimestamp,
            checkSender
          )
        : Promise.resolve({
            sendingTransactions: [],
            receivingTransactions: [],
          })
    const receiverTransactionsPromise =
      checkReceiver !== 'none'
        ? this.getTransactions(
            this.transaction.destinationUserId,
            this.transaction.destinationPaymentDetails,
            afterTimestamp,
            checkReceiver
          )
        : Promise.resolve({
            sendingTransactions: [],
            receivingTransactions: [],
          })
    const [senderThinTransactions, receiverThinTransactions] =
      await Promise.all([
        senderTransactionsPromise,
        receiverTransactionsPromise,
      ])
    const [
      senderSendingTransactions,
      senderReceivingTransactions,
      receiverSendingTransactions,
      receiverReceivingTransactions,
    ] = await Promise.all([
      this.transactionRepository.getTransactionsByIds(
        senderThinTransactions.sendingTransactions.map(
          (transaction) => transaction.transactionId
        )
      ),
      this.transactionRepository.getTransactionsByIds(
        senderThinTransactions.receivingTransactions.map(
          (transaction) => transaction.transactionId
        )
      ),
      this.transactionRepository.getTransactionsByIds(
        receiverThinTransactions.sendingTransactions.map(
          (transaction) => transaction.transactionId
        )
      ),
      this.transactionRepository.getTransactionsByIds(
        receiverThinTransactions.receivingTransactions.map(
          (transaction) => transaction.transactionId
        )
      ),
    ])

    // Sum up the transactions amount
    const targetCurrency = Object.keys(transactionVolumeThreshold)[0]
    const senderSendingAmount = await getTransactionsTotalAmount(
      senderSendingTransactions
        .concat(this.transaction)
        .map((transaction) => transaction.originAmountDetails),
      targetCurrency
    )
    const senderReceivingAmount = await getTransactionsTotalAmount(
      senderReceivingTransactions.map(
        (transaction) => transaction.destinationAmountDetails
      ),
      targetCurrency
    )
    const receiverSendingAmount = await getTransactionsTotalAmount(
      receiverSendingTransactions.map(
        (transaction) => transaction.originAmountDetails
      ),
      targetCurrency
    )
    const receiverReceivingAmount = await getTransactionsTotalAmount(
      receiverReceivingTransactions
        .concat(this.transaction)
        .map((transaction) => transaction.destinationAmountDetails),
      targetCurrency
    )

    const senderSum = sumTransactionAmountDetails(
      senderSendingAmount,
      senderReceivingAmount
    )

    const receiverSum = sumTransactionAmountDetails(
      receiverSendingAmount,
      receiverReceivingAmount
    )

    let isSenderHit = false
    let isReceiverHit = false
    let amount: TransactionAmountDetails | null = null
    if (
      checkSender === 'sending' &&
      (await isTransactionAmountAboveThreshold(
        senderSendingAmount,
        transactionVolumeThreshold
      ))
    ) {
      isSenderHit = true
      amount = senderSendingAmount
    } else if (
      checkSender === 'all' &&
      (await isTransactionAmountAboveThreshold(
        senderSum,
        transactionVolumeThreshold
      ))
    ) {
      isSenderHit = true
      amount = senderSum
    } else if (
      checkReceiver === 'receiving' &&
      (await isTransactionAmountAboveThreshold(
        receiverReceivingAmount,
        transactionVolumeThreshold
      ))
    ) {
      isReceiverHit = true
      amount = receiverReceivingAmount
    } else if (
      checkReceiver === 'all' &&
      (await isTransactionAmountAboveThreshold(
        receiverSum,
        transactionVolumeThreshold
      ))
    ) {
      isReceiverHit = true
      amount = receiverSum
    }

    return { isSenderHit, isReceiverHit, amount }
  }

  public async computeRule() {
    const { isSenderHit, isReceiverHit, amount } = await this.computeHits()
    if (isSenderHit || isReceiverHit) {
      let direction: 'origin' | 'destination' | null = null
      if (isSenderHit) {
        direction = 'origin'
      } else if (isReceiverHit) {
        direction = 'destination'
      }

      const { transactionVolumeThreshold } = this.parameters
      let volumeDelta
      let volumeThreshold
      if (
        amount != null &&
        transactionVolumeThreshold[amount.transactionCurrency] != null
      ) {
        volumeDelta = {
          transactionAmount:
            amount.transactionAmount -
            transactionVolumeThreshold[amount.transactionCurrency],
          transactionCurrency: amount.transactionCurrency,
        }
        volumeThreshold = {
          transactionAmount:
            transactionVolumeThreshold[amount.transactionCurrency],
          transactionCurrency: amount.transactionCurrency,
        }
      } else {
        volumeDelta = null
        volumeThreshold = null
      }

      return {
        action: this.action,
        vars: {
          ...super.getTransactionVars(direction),
          volumeDelta,
          volumeThreshold,
        },
      }
    }
  }

  private async getTransactions(
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined,
    afterTimestamp: number,
    checkType: 'sending' | 'receiving' | 'all' | 'none'
  ): Promise<{
    sendingTransactions: ThinTransaction[]
    receivingTransactions: ThinTransaction[]
  }> {
    const transactionRepository = this
      .transactionRepository as TransactionRepository
    const [sendingTransactions, receivingTransactions] = await Promise.all([
      checkType === 'sending' || checkType === 'all'
        ? transactionRepository.getGenericUserSendingThinTransactions(
            userId,
            paymentDetails,
            {
              afterTimestamp,
              beforeTimestamp: this.transaction.timestamp!,
            },
            {
              transactionState: this.parameters.transactionState,
              transactionTypes: this.parameters.transactionTypes,
            }
          )
        : Promise.resolve([]),
      checkType === 'receiving' || checkType === 'all'
        ? transactionRepository.getGenericUserReceivingThinTransactions(
            userId,
            paymentDetails,
            {
              afterTimestamp,
              beforeTimestamp: this.transaction.timestamp!,
            },
            {
              transactionState: this.parameters.transactionState,
              transactionTypes: this.parameters.transactionTypes,
            }
          )
        : Promise.resolve([]),
    ])
    return {
      sendingTransactions,
      receivingTransactions,
    }
  }
}
