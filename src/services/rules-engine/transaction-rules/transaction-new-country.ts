import { JSONSchemaType } from 'ajv'
import { AggregationRepository } from '../repositories/aggregation-repository'
import {
  INITIAL_TRANSACTIONS_SCHEMA,
  PAYMENT_CHANNEL_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionRule } from './rule'
import {
  CardDetails,
  CardDetailsPaymentChannelEnum,
} from '@/@types/openapi-public/CardDetails'

export type TransactionNewCountryRuleParameters = {
  initialTransactions: number
  paymentChannel?: CardDetailsPaymentChannelEnum
}

export default class TransactionNewCountryRule extends TransactionRule<TransactionNewCountryRuleParameters> {
  public static getSchema(): JSONSchemaType<TransactionNewCountryRuleParameters> {
    return {
      type: 'object',
      properties: {
        initialTransactions: INITIAL_TRANSACTIONS_SCHEMA(),
        paymentChannel: PAYMENT_CHANNEL_OPTIONAL_SCHEMA(),
      },

      required: ['initialTransactions'],
    }
  }

  public async computeHits(): Promise<{
    hitReceiver: boolean
    hitSender: boolean
  }> {
    const aggregationRepository = new AggregationRepository(
      this.tenantId,
      this.dynamoDb
    )
    const { originUserId, destinationUserId } = this.transaction
    const senderCountry = this.transaction.originAmountDetails?.country
    const receiverCountry = this.transaction.destinationAmountDetails?.country
    const [
      senderTransactionCountries,
      senderTransactionsCount,
      receiverTransactionCountries,
      receiverTransactionsCount,
    ] = await Promise.all([
      originUserId &&
        aggregationRepository.getUserTransactionCountries(originUserId),
      originUserId &&
        aggregationRepository.getUserTransactionsCount(originUserId),
      destinationUserId &&
        aggregationRepository.getUserTransactionCountries(destinationUserId),
      destinationUserId &&
        aggregationRepository.getUserTransactionsCount(destinationUserId),
    ])

    const hitSender =
      receiverCountry &&
      senderTransactionsCount &&
      senderTransactionsCount?.sendingTransactionsCount &&
      senderTransactionsCount.sendingTransactionsCount >=
        this.parameters.initialTransactions &&
      senderTransactionCountries &&
      !senderTransactionCountries.sendingToCountries.has(receiverCountry)
    const hitReceiver =
      senderCountry &&
      receiverTransactionsCount &&
      receiverTransactionsCount.receivingTransactionsCount >=
        this.parameters.initialTransactions &&
      receiverTransactionCountries &&
      !receiverTransactionCountries.receivingFromCountries.has(senderCountry)
    return { hitSender: !!hitSender, hitReceiver: !!hitReceiver }
  }

  public async computeRule() {
    const { paymentChannel } = this.parameters
    if (
      paymentChannel &&
      (this.transaction.originPaymentDetails as CardDetails).paymentChannel !==
        paymentChannel
    ) {
      return
    }
    const { hitReceiver, hitSender } = await this.computeHits()
    if (hitReceiver || hitSender) {
      let direction: 'origin' | 'destination' | null = null
      if (hitSender) {
        direction = 'origin'
      } else if (hitReceiver) {
        direction = 'destination'
      }
      return {
        action: this.action,
        vars: super.getTransactionVars(direction),
      }
    }
  }
}
