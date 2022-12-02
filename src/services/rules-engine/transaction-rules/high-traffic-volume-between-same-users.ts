import { JSONSchemaType } from 'ajv'
import * as _ from 'lodash'
import { TransactionRepository } from '../repositories/transaction-repository'
import {
  getTransactionsTotalAmount,
  isTransactionAmountAboveThreshold,
} from '../utils/transaction-rule-utils'
import { subtractTime } from '../utils/time-utils'
import {
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  TRANSACTION_AMOUNT_THRESHOLDS_SCHEMA,
  TRANSACTIONS_THRESHOLD_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionFilters } from '../filters'
import { RuleHitResult } from '../rule'
import HighTrafficBetweenSameParties from './high-traffic-between-same-parties'

import dayjs from '@/utils/dayjs'
import { TransactionRule } from '@/services/rules-engine/transaction-rules/rule'
import { MissingRuleParameter } from '@/services/rules-engine/transaction-rules/errors'
import { getReceiverKeys } from '@/services/rules-engine/utils'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'

export type HighTrafficVolumeBetweenSameUsersParameters = {
  timeWindow: TimeWindow
  transactionVolumeThreshold: {
    [currency: string]: number
  }
  transactionsLimit?: number
}

export default class HighTrafficVolumeBetweenSameUsers extends TransactionRule<
  HighTrafficVolumeBetweenSameUsersParameters,
  TransactionFilters
> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<HighTrafficVolumeBetweenSameUsersParameters> {
    return {
      type: 'object',
      properties: {
        transactionVolumeThreshold: TRANSACTION_AMOUNT_THRESHOLDS_SCHEMA({
          title: 'Transactions Volume Threshold',
        }),
        transactionsLimit: TRANSACTIONS_THRESHOLD_OPTIONAL_SCHEMA(),
        timeWindow: TIME_WINDOW_SCHEMA(),
      },
      required: ['timeWindow', 'transactionVolumeThreshold'],
    }
  }

  public async computeRule() {
    const { transactionVolumeThreshold, transactionsLimit } = this.parameters
    const { transactions } = await this.computeResults()

    const targetCurrency = Object.keys(
      transactionVolumeThreshold
    )[0] as CurrencyCode
    const transactionAmounts = await getTransactionsTotalAmount(
      transactions
        .concat(this.transaction)
        .map((transaction) => transaction.originAmountDetails),
      targetCurrency
    )
    let volumeDelta = null
    let volumeThreshold = null
    if (
      transactionAmounts != null &&
      transactionVolumeThreshold[targetCurrency] != null
    ) {
      volumeDelta = {
        transactionAmount:
          transactionAmounts.transactionAmount -
          transactionVolumeThreshold[targetCurrency],
        transactionCurrency: targetCurrency,
      }
      volumeThreshold = {
        transactionAmount: transactionVolumeThreshold[targetCurrency],
        transactionCurrency: targetCurrency,
      }
    }

    let countHit = true
    if (Number.isFinite(transactionsLimit)) {
      const highTrafficCountRule = new HighTrafficBetweenSameParties(
        this.tenantId,
        {
          transaction: this.transaction,
          senderUser: this.senderUser,
          receiverUser: this.receiverUser,
        },
        {
          parameters: this
            .parameters as HighTrafficVolumeBetweenSameUsersParameters & {
            transactionsLimit: number
          },
          filters: this.filters,
        },
        { ruleInstance: this.ruleInstance },
        this.dynamoDb
      )
      const countResult = await highTrafficCountRule.computeRule()
      countHit = Boolean(countResult && countResult.length > 0)
    }

    const hitResult: RuleHitResult = []
    const transactionAmountHit = await isTransactionAmountAboveThreshold(
      transactionAmounts,
      transactionVolumeThreshold
    )
    let falsePositiveDetails
    if (
      this.ruleInstance.falsePositiveCheckEnabled &&
      this.ruleInstance.caseCreationType === 'TRANSACTION'
    ) {
      if (
        volumeDelta != null &&
        transactionAmounts != null &&
        volumeDelta.transactionAmount / transactionAmounts.transactionAmount <
          0.05
      ) {
        falsePositiveDetails = {
          isFalsePositive: true,
          confidenceScore: _.random(60, 80),
        }
      }
    }

    if (transactionAmountHit.isHit && countHit) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: {
          ...super.getTransactionVars('origin'),
          transactions,
          volumeDelta,
          volumeThreshold,
        },
        falsePositiveDetails,
      })
      hitResult.push({
        direction: 'DESTINATION',
        vars: {
          ...super.getTransactionVars('destination'),
          transactions,
          volumeDelta,
          volumeThreshold,
        },
        falsePositiveDetails: falsePositiveDetails,
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
      throw new Error(`Transaction timestamp is missing`)
    }
    if (originUserId == null) {
      throw new Error(`Origin user ID is missing`)
    }

    // todo: move to constructor
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const transactions = await transactionRepository.getUserSendingTransactions(
      originUserId,
      {
        beforeTimestamp: timestamp,
        afterTimestamp: subtractTime(dayjs(timestamp), timeWindow),
      },
      {
        transactionState: this.filters.transactionState,
        transactionTypes: this.filters.transactionTypes,
        receiverKeyId: getReceiverKeys(this.tenantId, transaction)
          ?.PartitionKeyID,
        originPaymentMethod: this.filters.paymentMethod,
        originCountries: this.filters.transactionCountries,
      },
      ['originAmountDetails']
    )

    return { transactions }
  }
}
