import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import {
  getTransactionsTotalAmount,
  getTransactionUserPastTransactions,
  isTransactionAmountAboveThreshold,
  isTransactionInTargetTypes,
  sumTransactionAmountDetails,
} from '../utils/transaction-rule-utils'
import {
  CHECK_RECEIVER_SCHEMA,
  CHECK_SENDER_SCHEMA,
  INITIAL_TRANSACTIONS_OPTIONAL_SCHEMA,
  PAYMENT_METHOD_OPTIONAL_SCHEMA,
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  TRANSACTION_AMOUNT_THRESHOLDS_SCHEMA,
  TRANSACTION_STATE_OPTIONAL_SCHEMA,
  TRANSACTION_TYPES_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import { PaymentMethod } from '@/@types/tranasction/payment-type'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { TransactionType } from '@/@types/openapi-public/TransactionType'

type Filters = DefaultTransactionRuleParameters & {
  transactionTypes?: TransactionType[]
  paymentMethod?: PaymentMethod
}

export type TransactionsVolumeRuleParameters = Filters & {
  initialTransactions?: number
  transactionVolumeThreshold: {
    [currency: string]: number
  }
  timeWindow: TimeWindow
  checkSender: 'sending' | 'all' | 'none'
  checkReceiver: 'receiving' | 'all' | 'none'
  matchPaymentMethodDetails?: boolean
}

export default class TransactionsVolumeRule extends TransactionRule<TransactionsVolumeRuleParameters> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<TransactionsVolumeRuleParameters> {
    return {
      type: 'object',
      properties: {
        initialTransactions: INITIAL_TRANSACTIONS_OPTIONAL_SCHEMA(),
        transactionVolumeThreshold: TRANSACTION_AMOUNT_THRESHOLDS_SCHEMA({
          title: 'Transactions Volume Threshold',
        }),
        timeWindow: TIME_WINDOW_SCHEMA(),
        checkSender: CHECK_SENDER_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_SCHEMA(),
        transactionState: TRANSACTION_STATE_OPTIONAL_SCHEMA(),
        transactionTypes: TRANSACTION_TYPES_OPTIONAL_SCHEMA(),
        paymentMethod: PAYMENT_METHOD_OPTIONAL_SCHEMA(),
        matchPaymentMethodDetails: {
          type: 'boolean',
          title: 'Match Payment Method Details',
          description:
            'Transactions will only be flagged if same payment details are used',
          nullable: true,
        },
      },
      required: ['transactionVolumeThreshold', 'timeWindow'],
    }
  }

  public getFilters() {
    const filters = super.getFilters()
    const { transactionTypes, paymentMethod } = this.parameters
    const result = [
      ...filters,
      () => isTransactionInTargetTypes(this.transaction.type, transactionTypes),
    ]
    if (paymentMethod != null) {
      result.push(
        () =>
          this.transaction.originPaymentDetails?.method === paymentMethod ||
          this.transaction.destinationPaymentDetails?.method === paymentMethod
      )
    }
    return result
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
      transactionState,
      transactionTypes,
      matchPaymentMethodDetails,
      initialTransactions,
    } = this.parameters

    this.transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    let {
      senderSendingTransactions,
      senderReceivingTransactions,
      receiverSendingTransactions,
      receiverReceivingTransactions,
    } = await getTransactionUserPastTransactions(
      this.transaction,
      this.transactionRepository,
      {
        timeWindow,
        checkSender,
        checkReceiver,
        transactionState,
        transactionTypes,
        matchPaymentMethodDetails,
      }
    )

    if (matchPaymentMethodDetails) {
      senderSendingTransactions = senderSendingTransactions.filter(
        (transaction) =>
          transaction.originUserId === this.transaction.originUserId
      )
      senderReceivingTransactions = senderReceivingTransactions.filter(
        (transaction) =>
          transaction.destinationUserId === this.transaction.originUserId
      )
      receiverSendingTransactions = receiverSendingTransactions.filter(
        (transaction) =>
          transaction.originUserId === this.transaction.destinationUserId
      )
      receiverReceivingTransactions = receiverReceivingTransactions.filter(
        (transaction) =>
          transaction.destinationUserId === this.transaction.destinationUserId
      )
    }

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

    const skipCheckSender =
      initialTransactions &&
      senderSendingTransactions.length + senderReceivingTransactions.length <
        initialTransactions
    const skipCheckReceiver =
      initialTransactions &&
      receiverSendingTransactions.length +
        receiverReceivingTransactions.length <
        initialTransactions
    let isSenderHit = false
    let isReceiverHit = false
    let amount: TransactionAmountDetails | null = null
    if (
      !skipCheckSender &&
      checkSender === 'sending' &&
      (await isTransactionAmountAboveThreshold(
        senderSendingAmount,
        transactionVolumeThreshold
      ))
    ) {
      isSenderHit = true
      amount = senderSendingAmount
    } else if (
      !skipCheckSender &&
      checkSender === 'all' &&
      (await isTransactionAmountAboveThreshold(
        senderSum,
        transactionVolumeThreshold
      ))
    ) {
      isSenderHit = true
      amount = senderSum
    } else if (
      !skipCheckReceiver &&
      checkReceiver === 'receiving' &&
      (await isTransactionAmountAboveThreshold(
        receiverReceivingAmount,
        transactionVolumeThreshold
      ))
    ) {
      isReceiverHit = true
      amount = receiverReceivingAmount
    } else if (
      !skipCheckReceiver &&
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
}
