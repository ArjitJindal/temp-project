import { JSONSchemaType } from 'ajv'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository'
import { TimeWindow, TIME_WINDOW_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionHistoricalFilters } from '../filters'
import { RuleHitResult } from '../rule'
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

export default abstract class MultipleSendersWithinTimePeriodRuleBase extends TransactionRule<
  MultipleSendersWithinTimePeriodRuleParameters,
  TransactionHistoricalFilters
> {
  public static getSchema(): JSONSchemaType<MultipleSendersWithinTimePeriodRuleParameters> {
    return {
      type: 'object',
      properties: {
        sendersCount: {
          type: 'integer',
          title: 'Senders count threshold',
          description:
            'rule is run when the senders count per time window is greater than the threshold',
        },
        timeWindow: TIME_WINDOW_SCHEMA(),
      },
      required: ['sendersCount', 'timeWindow'],
    }
  }

  protected abstract getSenderReceiverTypes(): SenderReceiverTypes

  public async computeRule() {
    const { timeWindow, sendersCount } = this.parameters
    const { senderTypes, receiverTypes } = this.getSenderReceiverTypes()

    const afterTimestamp = subtractTime(
      dayjs(this.transaction.timestamp),
      timeWindow
    )
    let senderTransactions: AuxiliaryIndexTransaction[] = []
    if (receiverTypes.includes('USER') && this.transaction.destinationUserId) {
      senderTransactions =
        await this.transactionRepository.getUserReceivingTransactions(
          this.transaction.destinationUserId,
          {
            afterTimestamp,
            beforeTimestamp: this.transaction.timestamp!,
          },
          {
            transactionStates: this.filters.transactionStatesHistorical,
            transactionTypes: this.filters.transactionTypesHistorical,
            destinationPaymentMethod: this.filters.paymentMethodHistorical,
            destinationCountries: this.filters.transactionCountriesHistorical,
          },
          ['senderKeyId', 'originUserId']
        )
    } else if (
      receiverTypes.includes('NON_USER') &&
      this.transaction.destinationPaymentDetails
    ) {
      senderTransactions =
        await this.transactionRepository.getNonUserReceivingTransactions(
          this.transaction.destinationPaymentDetails,
          {
            afterTimestamp,
            beforeTimestamp: this.transaction.timestamp!,
          },
          {
            transactionStates: this.filters.transactionStatesHistorical,
            transactionTypes: this.filters.transactionTypesHistorical,
            destinationPaymentMethod: this.filters.paymentMethodHistorical,
            destinationCountries: this.filters.transactionCountriesHistorical,
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

    const hitResult: RuleHitResult = []
    if (uniqueSenders.size + 1 > sendersCount) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: super.getTransactionVars('origin'),
      })
      hitResult.push({
        direction: 'DESTINATION',
        vars: super.getTransactionVars('destination'),
      })
    }
    return hitResult
  }
}
