import dayjs from 'dayjs'
import { JSONSchemaType } from 'ajv'
import _ from 'lodash'
import {
  ThinTransaction,
  TransactionRepository,
} from '../repositories/transaction-repository'
import { isTransactionAmountAboveThreshold } from '../utils/transaction-rule-utils'
import { TransactionRule } from './rule'
import { getTargetCurrencyAmount } from '@/utils/currency-utils'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'

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
          additionalProperties: {
            type: 'integer',
          },
          required: [],
        },
        timeWindowInSeconds: { type: 'integer' },
        checkSender: {
          type: 'string',
          enum: ['sending', 'all', 'none'],
        },
        checkReceiver: {
          type: 'string',
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
    const senderSendingAmount = await this.getTransactionsTotalAmount(
      senderSendingTransactions
        .concat(this.transaction)
        .map((transaction) => transaction.originAmountDetails),
      targetCurrency
    )
    const senderReceivingAmount = await this.getTransactionsTotalAmount(
      senderReceivingTransactions.map(
        (transaction) => transaction.destinationAmountDetails
      ),
      targetCurrency
    )
    const receiverSendingAmount = await this.getTransactionsTotalAmount(
      receiverSendingTransactions.map(
        (transaction) => transaction.originAmountDetails
      ),
      targetCurrency
    )
    const receiverReceivingAmount = await this.getTransactionsTotalAmount(
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
          this.sumTransactionAmountDetails(
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
          this.sumTransactionAmountDetails(
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
        ? transactionRepository.getAfterTimeUserSendingThinTransactions(
            userId,
            afterTimestamp
          )
        : Promise.resolve([]),
      checkType === 'receiving' || checkType === 'all'
        ? transactionRepository.getAfterTimeUserReceivingThinTransactions(
            userId,
            afterTimestamp
          )
        : Promise.resolve([]),
    ])
    return {
      sendingTransactions,
      receivingTransactions,
    }
  }

  private async getTransactionsTotalAmount(
    amountDetailsList: (TransactionAmountDetails | undefined)[],
    targetCurrency: string
  ): Promise<TransactionAmountDetails> {
    let totalAmount: TransactionAmountDetails = {
      transactionAmount: 0,
      transactionCurrency: targetCurrency,
    }
    for (const amountDetails of amountDetailsList) {
      if (amountDetails) {
        const targetAmount = await getTargetCurrencyAmount(
          amountDetails,
          targetCurrency
        )
        totalAmount = this.sumTransactionAmountDetails(
          totalAmount,
          targetAmount
        )
      }
    }
    return totalAmount
  }

  private sumTransactionAmountDetails(
    transactionAmountDetails1: TransactionAmountDetails,
    transactionAmountDetails2: TransactionAmountDetails
  ): TransactionAmountDetails {
    if (
      transactionAmountDetails1.transactionCurrency !==
      transactionAmountDetails2.transactionCurrency
    ) {
      throw new Error('Currencies should be the same in order to sum up')
    }
    return {
      transactionAmount:
        transactionAmountDetails1.transactionAmount +
        transactionAmountDetails2.transactionAmount,
      transactionCurrency: transactionAmountDetails1.transactionCurrency,
    }
  }
}
