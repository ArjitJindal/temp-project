import { JSONSchemaType } from 'ajv'
import { getReceiverKeys } from '../utils'
import { TransactionHistoricalFilters } from '../filters'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'
import dayjs from '@/utils/dayjs'

export type UserTransactionPairsRuleParameters = {
  userPairsThreshold: number
  timeWindowInSeconds: number
  excludedUserIds?: string[]
}

export default class UserTransactionPairsRule extends TransactionRule<
  UserTransactionPairsRuleParameters,
  TransactionHistoricalFilters
> {
  public static getSchema(): JSONSchemaType<UserTransactionPairsRuleParameters> {
    return {
      type: 'object',
      properties: {
        userPairsThreshold: {
          type: 'integer',
          title: 'User pairs count threshold',
        },
        timeWindowInSeconds: {
          type: 'integer',
          title: 'Time window (seconds)',
        },
        excludedUserIds: {
          type: 'array',
          title: 'Excluded user IDs',
          items: { type: 'string' },
          nullable: true,
        },
      },
      required: ['userPairsThreshold', 'timeWindowInSeconds'],
    }
  }

  public async computeRule() {
    const { excludedUserIds } = this.parameters
    if (
      !this.transaction.originUserId ||
      !this.transaction.destinationUserId ||
      (excludedUserIds &&
        (excludedUserIds.includes(this.transaction.originUserId as string) ||
          excludedUserIds.includes(
            this.transaction.destinationUserId as string
          )))
    ) {
      return
    }

    const { userPairsThreshold } = this.parameters
    const sendingTransactions = await this.getSenderSendingTransactions()

    const hitResult: RuleHitResult = []
    if (sendingTransactions.length > userPairsThreshold) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: {},
      })
      hitResult.push({
        direction: 'DESTINATION',
        vars: {},
      })
    }
    return hitResult
  }

  protected async getSenderSendingTransactions() {
    const { timeWindowInSeconds } = this.parameters
    const possibleReceiverKeyIds = new Set(
      (this.filters.transactionTypesHistorical || [undefined]).map(
        (transactionType) =>
          getReceiverKeys(this.tenantId, this.transaction, transactionType)
            ?.PartitionKeyID
      )
    )
    const sendingTransactions = (
      await this.transactionRepository.getUserSendingTransactions(
        this.transaction.originUserId as string,
        {
          afterTimestamp: dayjs(this.transaction.timestamp)
            .subtract(timeWindowInSeconds, 'second')
            .valueOf(),
          beforeTimestamp: this.transaction.timestamp!,
        },
        {
          transactionTypes: this.filters.transactionTypesHistorical,
          transactionAmountRange: this.filters.transactionAmountRangeHistorical,
          transactionStates: this.filters.transactionStatesHistorical,
          originPaymentMethods: this.filters.paymentMethodsHistorical,
          originCountries: this.filters.transactionCountriesHistorical,
        },
        ['receiverKeyId']
      )
    ).concat({
      ...this.transaction,
      receiverKeyId: getReceiverKeys(
        this.tenantId,
        this.transaction,
        this.transaction.type
      )?.PartitionKeyID,
      senderKeyId: undefined,
    })
    return sendingTransactions.filter((transaction) =>
      possibleReceiverKeyIds.has(transaction.receiverKeyId)
    )
  }
}
