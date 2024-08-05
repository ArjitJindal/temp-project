import { JSONSchemaType } from 'ajv'
import { compact, mergeWith, uniq } from 'lodash'
import { TransactionHistoricalFilters } from '../filters'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import {
  CHECK_RECEIVER_OPTIONAL_SCHEMA,
  CHECK_SENDER_OPTIONAL_SCHEMA,
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  BANKS_THRESHOLD_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { RuleHitResultItem } from '../rule'
import {
  getTransactionUserPastTransactionsByDirectionGenerator,
  groupTransactionsByTime,
} from '../utils/transaction-rule-utils'
import { getTimestampRange } from '../utils/time-utils'
import { getReceiverKeyId, getSenderKeyId } from '../utils'
import { TransactionAggregationRule } from './aggregation-rule'
import { mergeObjects } from '@/utils/object'
import { IBANDetails } from '@/@types/openapi-public/IBANDetails'
import { GenericBankAccountDetails } from '@/@types/openapi-public/GenericBankAccountDetails'
import { ACHDetails } from '@/@types/openapi-public/ACHDetails'
import { SWIFTDetails } from '@/@types/openapi-public/SWIFTDetails'
import { traceable } from '@/core/xray'
type AggregationData = {
  uniqueBanks?: string[]
}

export type AcceptedPaymentDetails =
  | IBANDetails
  | ACHDetails
  | SWIFTDetails
  | GenericBankAccountDetails

export function isTransactionMethodValid(
  transactionMethod: string | undefined
): boolean {
  if (transactionMethod === undefined) {
    return false
  }
  const requiredTransactionMethods = [
    'GENERIC_BANK_ACCOUNT',
    'IBAN',
    'SWIFT',
    'ACH',
  ]
  return requiredTransactionMethods.includes(transactionMethod)
}

export type UsingTooManyBanksToMakePaymentsRuleParameters = {
  banksLimit: number
  timeWindow: TimeWindow

  checkSender?: 'sending' | 'all' | 'none'
  checkReceiver?: 'receiving' | 'all' | 'none'

  // Optional parameters
  onlyCheckKnownUsers?: boolean
}

@traceable
export default class UsingTooManyBanksToMakePaymentsRule extends TransactionAggregationRule<
  UsingTooManyBanksToMakePaymentsRuleParameters,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getSchema(): JSONSchemaType<UsingTooManyBanksToMakePaymentsRuleParameters> {
    return {
      type: 'object',
      properties: {
        banksLimit: BANKS_THRESHOLD_SCHEMA(),
        timeWindow: TIME_WINDOW_SCHEMA(),
        checkSender: CHECK_SENDER_OPTIONAL_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_OPTIONAL_SCHEMA(),
        onlyCheckKnownUsers: {
          type: 'boolean',
          title: 'Only check transactions from known users (with user ID)',
          nullable: true,
        },
      },
      required: ['banksLimit', 'timeWindow'],
    }
  }

  public async computeRule() {
    return await Promise.all([
      this.computeRuleUser('origin'),
      this.computeRuleUser('destination'),
    ])
  }

  protected async computeRuleUser(
    direction: 'origin' | 'destination'
  ): Promise<RuleHitResultItem | undefined> {
    const { banksLimit, onlyCheckKnownUsers, checkSender, checkReceiver } =
      this.parameters

    if (direction === 'origin' && checkSender === 'none') {
      return
    } else if (direction === 'destination' && checkReceiver === 'none') {
      return
    }

    if (
      onlyCheckKnownUsers &&
      (!this.transaction.originUserId || !this.transaction.destinationUserId)
    ) {
      return
    }

    const banksCount = await this.getData(direction)
    if (!banksCount) {
      return
    }
    if (banksCount > banksLimit) {
      const banksDif = banksCount - banksLimit
      return {
        direction: direction === 'origin' ? 'ORIGIN' : 'DESTINATION',
        vars: {
          ...super.getTransactionVars(direction),
          banksDif,
        },
      }
    }
  }

  public shouldUpdateUserAggregation(
    _direction: 'origin' | 'destination',
    isTransactionHistoricalFiltered: boolean
  ): boolean {
    return isTransactionHistoricalFiltered
  }

  public async rebuildUserAggregation(
    direction: 'origin' | 'destination'
  ): Promise<void> {
    let timeAggregatedResult: { [key1: string]: AggregationData } = {}
    for await (const data of this.getRawTransactionsData(direction)) {
      const partialTimeAggregatedResult = await this.getTimeAggregatedResult(
        data.sendingTransactions,
        data.receivingTransactions,
        direction
      )
      timeAggregatedResult = mergeWith(
        timeAggregatedResult,
        partialTimeAggregatedResult,
        (a: AggregationData | undefined, b: AggregationData | undefined) => {
          const result: AggregationData = {
            uniqueBanks: uniq([
              ...(a?.uniqueBanks ?? []),
              ...(b?.uniqueBanks ?? []),
            ]),
          }
          return result
        }
      )
    }

    await this.saveRebuiltRuleAggregations(direction, timeAggregatedResult)
  }

  private async getData(
    direction: 'origin' | 'destination'
  ): Promise<number | undefined> {
    const { timeWindow, checkSender, checkReceiver } = this.parameters
    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp,
      timeWindow
    )
    const checkDirection = direction === 'origin' ? checkSender : checkReceiver
    const userAggregationData = await this.getRuleAggregations<AggregationData>(
      direction,
      afterTimestamp,
      beforeTimestamp
    )

    if (userAggregationData) {
      const uniqueBanks = new Set(
        userAggregationData.flatMap((v) => v.uniqueBanks ?? [])
      )
      const paymentDetails = this.getPaymentDetails(this.transaction, direction)
      const updatedUniqueBanks = this.addBankNameIfValid(
        paymentDetails,
        uniqueBanks
      )
      return updatedUniqueBanks.size
    }

    if (this.shouldUseRawData()) {
      const uniqueBanks = this.getUniqueBanks([this.transaction], direction)
      for await (const data of this.getRawTransactionsData(direction)) {
        const banks = this.getUniqueBanks(
          data.sendingTransactions.concat(data.receivingTransactions),
          direction
        )
        Array.from(banks).forEach((bank) => uniqueBanks.add(bank))
      }
      return uniqueBanks.size
    } else {
      return checkDirection != 'none'
        ? direction === 'origin'
          ? isTransactionMethodValid(
              this.transaction.originPaymentDetails?.method
            )
            ? 1
            : 0
          : isTransactionMethodValid(
              this.transaction.destinationPaymentDetails?.method
            )
          ? 1
          : 0
        : 0
    }
  }

  private async *getRawTransactionsData(
    direction: 'origin' | 'destination'
  ): AsyncGenerator<{
    sendingTransactions: AuxiliaryIndexTransaction[]
    receivingTransactions: AuxiliaryIndexTransaction[]
  }> {
    const { timeWindow, checkSender, checkReceiver, onlyCheckKnownUsers } =
      this.parameters

    const generator =
      await getTransactionUserPastTransactionsByDirectionGenerator(
        this.transaction,
        direction,
        this.transactionRepository,
        {
          timeWindow,
          checkDirection:
            (direction === 'origin' ? checkSender : checkReceiver) ?? 'all',
          filters: this.filters,
        },
        [
          'timestamp',
          'originUserId',
          'destinationUserId',
          'destinationPaymentDetails',
          'originPaymentDetails',
        ]
      )

    for await (const data of generator) {
      const filteredSendingTransactions = this.filterTransactions(
        data.sendingTransactions,
        onlyCheckKnownUsers
      )
      const filteredReceivingTransactions = this.filterTransactions(
        data.receivingTransactions,
        onlyCheckKnownUsers
      )
      yield {
        sendingTransactions: filteredSendingTransactions,
        receivingTransactions: filteredReceivingTransactions,
      }
    }
  }

  private async getTimeAggregatedResult(
    sendingTransactions: AuxiliaryIndexTransaction[],
    receivingTransactions: AuxiliaryIndexTransaction[],
    direction: 'origin' | 'destination'
  ) {
    return mergeObjects(
      await groupTransactionsByTime<AggregationData>(
        sendingTransactions,
        async (group) => ({
          uniqueBanks: Array.from(this.getUniqueBanks(group, direction)),
        }),
        this.getAggregationGranularity()
      ),
      await groupTransactionsByTime<AggregationData>(
        receivingTransactions,
        async (group) => ({
          uniqueBanks: Array.from(this.getUniqueBanks(group, direction)),
        }),
        this.getAggregationGranularity()
      )
    )
  }

  override async getUpdatedTargetAggregation(
    direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined
  ): Promise<AggregationData | null> {
    if (
      this.parameters.onlyCheckKnownUsers &&
      (!this.transaction.originUserId || !this.transaction.destinationUserId)
    ) {
      return null
    }
    const result = targetAggregationData ?? {}
    const paymentDetails = this.getPaymentDetails(this.transaction, direction)
    result.uniqueBanks = Array.from(
      this.addBankNameIfValid(paymentDetails, new Set(result.uniqueBanks))
    )
    return result
  }

  override getMaxTimeWindow(): TimeWindow {
    return this.parameters.timeWindow
  }
  override getRuleAggregationVersion(): number {
    return 1
  }

  override getUserKeyId(direction: 'origin' | 'destination') {
    return direction === 'origin'
      ? getSenderKeyId(this.tenantId, this.transaction, {
          disableDirection: true,
        })
      : getReceiverKeyId(this.tenantId, this.transaction, {
          disableDirection: true,
        })
  }

  private getUniqueBanks(
    transactions: AuxiliaryIndexTransaction[],
    direction: 'origin' | 'destination'
  ): Set<string> {
    return new Set(
      compact(
        transactions.map(
          (transaction) =>
            this.getPaymentDetails(transaction, direction)?.bankName
        )
      )
    ) as Set<string>
  }

  private addBankNameIfValid = (
    paymentDetails: AcceptedPaymentDetails | undefined,
    uniqueBanks: Set<string>
  ) => {
    if (
      paymentDetails?.bankName &&
      isTransactionMethodValid(paymentDetails?.method)
    ) {
      uniqueBanks.add(paymentDetails.bankName)
    }
    return uniqueBanks
  }

  private filterTransactions = (
    transactions: AuxiliaryIndexTransaction[],
    onlyCheckKnownUsers: boolean | undefined
  ) => {
    transactions.filter(
      (transaction) =>
        (!onlyCheckKnownUsers || transaction.originUserId) &&
        isTransactionMethodValid(transaction.originPaymentDetails?.method)
    )
    return transactions
  }

  private getPaymentDetails = (
    transaction: AuxiliaryIndexTransaction,
    direction: 'origin' | 'destination'
  ): AcceptedPaymentDetails | undefined => {
    const paymentDetails =
      direction === 'origin'
        ? transaction.originPaymentDetails
        : transaction.destinationPaymentDetails
    return paymentDetails as AcceptedPaymentDetails
  }
}
