import dayjs from 'dayjs'
import { JSONSchemaType } from 'ajv'
import _ from 'lodash'
import {
  ThinTransaction,
  TransactionRepository,
} from '../repositories/transaction-repository'
import {
  getTransactionsTotalAmount,
  isTransactionAmountAboveThreshold,
  sumTransactionAmountDetails,
} from '../utils/transaction-rule-utils'
import { TransactionRule } from './rule'

export type TransactionsVolumeRuleParameters = {
  transactionVolumeThreshold: {
    [currency: string]: number
  }
  timeWindowInSeconds: number
  checkSender: 'sending' | 'all' | 'none'
  checkReceiver: 'receiving' | 'all' | 'none'
}

export default class TransactionsVolumeRule extends TransactionRule<TransactionsVolumeRuleParameters> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<TransactionsVolumeRuleParameters> {
    return {
      type: 'object',
      properties: {
        transactionVolumeThreshold: {
          type: 'object',
          title: 'Transactions Volume Threshold',
          additionalProperties: {
            type: 'integer',
          },
          required: [],
        },
        timeWindowInSeconds: {
          type: 'integer',
          title: 'Time Window (Seconds)',
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
      required: ['transactionVolumeThreshold', 'timeWindowInSeconds'],
      additionalProperties: false,
    }
  }

  public async computeRule() {
    const {
      checkSender,
      checkReceiver,
      transactionVolumeThreshold,
      timeWindowInSeconds,
    } = this.parameters

    this.transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    // Retrieve all the transactions during the target time window
    const afterTimestamp = dayjs(this.transaction.timestamp)
      .subtract(timeWindowInSeconds, 'seconds')
      .valueOf()
    const senderTransactionsPromise =
      this.transaction.originUserId && checkSender !== 'none'
        ? this.getTransactions(
            this.transaction.originUserId,
            afterTimestamp,
            checkSender
          )
        : Promise.resolve({
            sendingTransactions: [],
            receivingTransactions: [],
          })
    const receiverTransactionsPromise =
      this.transaction.destinationUserId && checkReceiver !== 'none'
        ? this.getTransactions(
            this.transaction.destinationUserId,
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

    if (
      (checkSender === 'sending' &&
        (await isTransactionAmountAboveThreshold(
          senderSendingAmount,
          transactionVolumeThreshold
        ))) ||
      (checkSender === 'all' &&
        (await isTransactionAmountAboveThreshold(
          sumTransactionAmountDetails(
            senderSendingAmount,
            senderReceivingAmount
          ),
          transactionVolumeThreshold
        ))) ||
      (checkReceiver === 'receiving' &&
        (await isTransactionAmountAboveThreshold(
          receiverReceivingAmount,
          transactionVolumeThreshold
        ))) ||
      (checkReceiver === 'all' &&
        (await isTransactionAmountAboveThreshold(
          sumTransactionAmountDetails(
            receiverSendingAmount,
            receiverReceivingAmount
          ),
          transactionVolumeThreshold
        )))
    ) {
      return { action: this.action }
    }
  }

  private async getTransactions(
    userId: string,
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
        ? transactionRepository.getUserSendingThinTransactions(userId, {
            afterTimestamp,
            beforeTimestamp: this.transaction.timestamp!,
          })
        : Promise.resolve([]),
      checkType === 'receiving' || checkType === 'all'
        ? transactionRepository.getUserReceivingThinTransactions(userId, {
            afterTimestamp,
            beforeTimestamp: this.transaction.timestamp!,
          })
        : Promise.resolve([]),
    ])
    return {
      sendingTransactions,
      receivingTransactions,
    }
  }
}
