import { JSONSchemaType } from 'ajv'
import {
  AuxiliaryIndexTransaction,
  TransactionRepository,
} from '../repositories/transaction-repository'
import { TimeWindow, TIME_WINDOW_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionFilters } from '../transaction-filters'
import { TransactionRule } from './rule'
import dayjs from '@/utils/dayjs'
import { subtractTime } from '@/services/rules-engine/utils/time-utils'

export type MultipleSendersWithinTimePeriodRuleParameters = {
  sendersCount: number
  timeWindow: TimeWindow
}

export type SenderReceiverTypes = {
  senderTypes: Array<'USER' | 'NON_USER'>
  receiverTypes: Array<'USER' | 'NON_USER'>
}

export default class MultipleSendersWithinTimePeriodRuleBase extends TransactionRule<
  MultipleSendersWithinTimePeriodRuleParameters,
  TransactionFilters
> {
  public static getSchema(): JSONSchemaType<MultipleSendersWithinTimePeriodRuleParameters> {
    return {
      type: 'object',
      properties: {
        sendersCount: {
          type: 'integer',
          title: 'Senders Count Threshold',
          description:
            'rule is run when the senders count per time window is greater than the threshold',
        },
        timeWindow: TIME_WINDOW_SCHEMA(),
      },
      required: ['sendersCount', 'timeWindow'],
    }
  }

  protected getSenderReceiverTypes(): SenderReceiverTypes {
    throw new Error('Not implemented')
  }

  public async computeRule() {
    const { timeWindow, sendersCount } = this.parameters
    const { senderTypes, receiverTypes } = this.getSenderReceiverTypes()
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const afterTimestamp = subtractTime(
      dayjs(this.transaction.timestamp),
      timeWindow
    )
    let senderTransactions: AuxiliaryIndexTransaction[] = []
    if (receiverTypes.includes('USER') && this.transaction.destinationUserId) {
      senderTransactions =
        await transactionRepository.getUserReceivingTransactions(
          this.transaction.destinationUserId,
          {
            afterTimestamp,
            beforeTimestamp: this.transaction.timestamp!,
          },
          {
            transactionState: this.filters.transactionState,
            transactionTypes: this.filters.transactionTypes,
            destinationPaymentMethod: this.filters.paymentMethod,
            destinationCountries: this.filters.transactionCountries,
          },
          ['senderKeyId', 'originUserId']
        )
    } else if (
      receiverTypes.includes('NON_USER') &&
      this.transaction.destinationPaymentDetails
    ) {
      senderTransactions =
        await transactionRepository.getNonUserReceivingTransactions(
          this.transaction.destinationPaymentDetails,
          {
            afterTimestamp,
            beforeTimestamp: this.transaction.timestamp!,
          },
          {
            transactionState: this.filters.transactionState,
            transactionTypes: this.filters.transactionTypes,
            destinationPaymentMethod: this.filters.paymentMethod,
            destinationCountries: this.filters.transactionCountries,
          },
          ['senderKeyId', 'originUserId']
        )
    }
    const uniqueSenders = new Set(
      senderTransactions
        .filter(
          (transaction) =>
            (senderTypes.includes('USER') && transaction.originUserId) ||
            senderTypes.includes('NON_USER')
        )
        .map((transaction) => transaction.senderKeyId)
    )
    if (uniqueSenders.size + 1 > sendersCount) {
      return { action: this.action, ...super.getTransactionVars(null) }
    }
  }
}
