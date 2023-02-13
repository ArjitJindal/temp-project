import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import {
  TRANSACTIONS_THRESHOLD_SCHEMA,
  TimeWindow,
  TIME_WINDOW_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { subtractTime } from '../utils/time-utils'
import { TransactionHistoricalFilters } from '../filters'
import { RuleHitResult } from '../rule'
import dayjs from '@/utils/dayjs'
import { TransactionRule } from '@/services/rules-engine/transaction-rules/rule'
import { MissingRuleParameter } from '@/services/rules-engine/transaction-rules/errors'
import { getReceiverKeys } from '@/services/rules-engine/utils'

export type HighTrafficBetweenSamePartiesParameters = {
  timeWindow: TimeWindow
  transactionsLimit: number
}

export default class HighTrafficBetweenSameParties extends TransactionRule<
  HighTrafficBetweenSamePartiesParameters,
  TransactionHistoricalFilters
> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<HighTrafficBetweenSamePartiesParameters> {
    return {
      type: 'object',
      properties: {
        transactionsLimit: TRANSACTIONS_THRESHOLD_SCHEMA(),
        timeWindow: TIME_WINDOW_SCHEMA(),
      },
      required: ['timeWindow', 'transactionsLimit'],
    }
  }

  public async computeRule() {
    const { transactionsLimit } = this.parameters
    const { count } = await this.computeResults()

    const hitResult: RuleHitResult = []
    if (count > transactionsLimit) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: {
          ...super.getTransactionVars('origin'),
          count,
          delta: count - this.parameters.transactionsLimit,
        },
      })
      hitResult.push({
        direction: 'DESTINATION',
        vars: {
          ...super.getTransactionVars('destination'),
          count,
          delta: count - this.parameters.transactionsLimit,
        },
      })
    }
    return hitResult
  }

  private async computeResults() {
    const { timeWindow } = this.parameters
    if (timeWindow === undefined) {
      throw new MissingRuleParameter()
    }
    const { transaction } = this
    const { originUserId, timestamp } = transaction

    if (timestamp == null) {
      throw new Error(`Transaction timestamp is missing`) // todo: better error
    }

    // todo: move to constructor
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const count =
      await transactionRepository.getGenericUserSendingTransactionsCount(
        originUserId,
        transaction.originPaymentDetails,
        {
          beforeTimestamp: timestamp,
          afterTimestamp: subtractTime(dayjs(timestamp), timeWindow),
        },
        {
          transactionStates: this.filters.transactionStatesHistorical,
          originPaymentMethod: this.filters.paymentMethodHistorical,
          transactionTypes: this.filters.transactionTypesHistorical,
          originCountries: this.filters.transactionCountriesHistorical,
          receiverKeyId: getReceiverKeys(this.tenantId, transaction)
            ?.PartitionKeyID,
        }
      )
    return { count: count + 1 }
  }
}
