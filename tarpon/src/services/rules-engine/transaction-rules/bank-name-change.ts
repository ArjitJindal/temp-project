import { JSONSchemaType } from 'ajv'
import { mergeWith } from 'lodash'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import { RuleHitResultItem } from '../rule'
import { TransactionHistoricalFilters } from '../filters'
import {
  getTransactionUserPastTransactionsByDirectionGenerator,
  groupTransactionsByHour,
} from '../utils/transaction-rule-utils'
import { TIME_WINDOW_SCHEMA, TimeWindow } from '../utils/rule-parameter-schemas'
import { getTimestampRange } from '../utils/time-utils'
import { TransactionAggregationRule } from './aggregation-rule'
import { getBankname } from '@/core/dynamodb/dynamodb-keys'
import { mergeObjects } from '@/utils/object'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { traceable } from '@/core/xray'

export type BankNameChangeRuleParameters = {
  timeWindow: TimeWindow
  oldBanksThreshold: number
}

export type AggregationData = {
  senderBanknameUsage: { [bankname: string]: number }
  receiverBanknameUsage: { [bankname: string]: number }
  senderPreviousBankName: string
  receiverPreviousBankName: string
}
const initialAggregationData = (): AggregationData => ({
  senderBanknameUsage: {},
  receiverBanknameUsage: {},
  senderPreviousBankName: '',
  receiverPreviousBankName: '',
})

@traceable
export default class BankNameChangeRule extends TransactionAggregationRule<
  BankNameChangeRuleParameters,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getSchema(): JSONSchemaType<BankNameChangeRuleParameters> {
    return {
      type: 'object',
      properties: {
        timeWindow: TIME_WINDOW_SCHEMA(),
        oldBanksThreshold: {
          type: 'integer',
          description:
            'Rule is run when count of old bank usages is greater or equal to threshold',
        },
      },
      required: [],
    }
  }

  async getUpdatedTargetAggregation(
    direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined
  ): Promise<AggregationData | null> {
    return bankNameChangeReducer(
      direction,
      targetAggregationData,
      this.transaction
    )
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
    const { bankUsage, previousBankname } = keys(direction)
    const banknameHistory = await this.getData(direction)
    const bankName = getBankname(
      direction === 'origin'
        ? this.transaction.originPaymentDetails
        : this.transaction.destinationPaymentDetails
    )
    if (!bankName) {
      return
    }
    if (bankName === banknameHistory[previousBankname]) {
      return
    }

    const thisBankUsage = banknameHistory[bankUsage][bankName]

    if (!thisBankUsage) {
      const oldBankUsages = Object.entries(banknameHistory[bankUsage]).reduce(
        (acc, [thisBankName, usages]) => {
          if (bankName === thisBankName) {
            return acc
          }
          return acc + usages
        },
        0
      )
      if (oldBankUsages >= this.parameters.oldBanksThreshold) {
        return {
          direction: direction === 'origin' ? 'ORIGIN' : 'DESTINATION',
          vars: this.getTransactionVars(direction),
        }
      }
    }
  }

  private async getData(
    direction: 'origin' | 'destination'
  ): Promise<AggregationData> {
    const { bankUsage, previousBankname } = keys(direction)
    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp!,
      this.parameters.timeWindow
    )
    const userAggregationData = await this.getRuleAggregations<AggregationData>(
      direction,
      afterTimestamp,
      beforeTimestamp
    )

    if (userAggregationData) {
      return userAggregationData.reduce<AggregationData>(
        (result, currentData: AggregationData) => {
          result[previousBankname] = currentData[previousBankname]
          for (const [bankName, usages] of Object.entries(
            currentData[bankUsage]
          )) {
            const existingBankUsage = result[bankUsage][bankName]
            if (existingBankUsage) {
              result[bankUsage][bankName] = existingBankUsage + usages
            } else {
              result[bankUsage][bankName] = usages
            }
          }
          return result
        },
        initialAggregationData()
      )
    }

    if (this.shouldUseRawData()) {
      let aggregationData = initialAggregationData()
      for await (const data of this.getRawTransactionsData(direction)) {
        aggregationData = aggregationDataMerger(
          data.sendingTransactions.reduce<AggregationData>(
            (agg, txn) => bankNameChangeReducer('origin', agg, txn),
            initialAggregationData()
          ),
          data.receivingTransactions.reduce<AggregationData>(
            (agg, txn) => bankNameChangeReducer('destination', agg, txn),
            initialAggregationData()
          )
        )
      }
      return aggregationData
    }
    return initialAggregationData()
  }

  private async *getRawTransactionsData(
    direction: 'origin' | 'destination'
  ): AsyncGenerator<{
    receivingTransactions: AuxiliaryIndexTransaction[]
    sendingTransactions: AuxiliaryIndexTransaction[]
  }> {
    yield* getTransactionUserPastTransactionsByDirectionGenerator(
      this.transaction,
      direction,
      this.transactionRepository,
      {
        timeWindow: this.parameters.timeWindow,
        checkDirection: 'all',
        filters: this.filters,
      },
      ['timestamp', 'originPaymentDetails', 'destinationPaymentDetails']
    )
  }

  public shouldUpdateUserAggregation(
    _direction: 'origin' | 'destination',
    isTransactionFiltered: boolean
  ): boolean {
    return isTransactionFiltered
  }

  public async rebuildUserAggregation(
    direction: 'origin' | 'destination'
  ): Promise<void> {
    let timeAggregatedResult: { [key1: string]: AggregationData } = {}
    for await (const data of this.getRawTransactionsData(direction)) {
      const partialTimeAggregatedResult = await this.getTimeAggregatedResult(
        data.sendingTransactions,
        data.receivingTransactions
      )
      timeAggregatedResult = mergeWith(
        timeAggregatedResult,
        partialTimeAggregatedResult,
        aggregationDataMerger
      )
    }

    await this.saveRebuiltRuleAggregations(direction, timeAggregatedResult)
  }

  private async getTimeAggregatedResult(
    sendingTransactions: AuxiliaryIndexTransaction[],
    receivingTransactions: AuxiliaryIndexTransaction[]
  ) {
    return mergeObjects(
      await groupTransactionsByHour<AggregationData>(
        sendingTransactions,
        async (group) => {
          return group.reduce<AggregationData>(
            (agg, txn) => bankNameChangeReducer('origin', agg, txn),
            initialAggregationData()
          )
        }
      ),
      await groupTransactionsByHour<AggregationData>(
        receivingTransactions,
        async (group) => {
          return group.reduce<AggregationData>(
            (agg, txn) => bankNameChangeReducer('destination', agg, txn),
            initialAggregationData()
          )
        }
      )
    )
  }

  override getMaxTimeWindow(): TimeWindow {
    return this.parameters.timeWindow
  }
  protected getRuleAggregationVersion(): number {
    return 1
  }
}

const keys = (
  direction: 'origin' | 'destination'
): {
  bankUsage: 'senderBanknameUsage' | 'receiverBanknameUsage'
  previousBankname: 'senderPreviousBankName' | 'receiverPreviousBankName'
} => {
  return direction === 'origin'
    ? {
        bankUsage: 'senderBanknameUsage',
        previousBankname: 'senderPreviousBankName',
      }
    : {
        bankUsage: 'receiverBanknameUsage',
        previousBankname: 'receiverPreviousBankName',
      }
}
export const bankNameChangeReducer = (
  direction: 'origin' | 'destination',
  targetAggregationData: AggregationData | undefined,
  transaction: AuxiliaryIndexTransaction | Transaction
): AggregationData => {
  const { bankUsage, previousBankname } = keys(direction)
  const bankName =
    direction === 'origin'
      ? getBankname(transaction.originPaymentDetails)
      : getBankname(transaction.destinationPaymentDetails)
  if (!targetAggregationData) {
    if (bankName) {
      return {
        ...initialAggregationData(),
        [bankUsage]: {
          [bankName]: 1,
        },
        [previousBankname]: bankName,
      }
    }
    return initialAggregationData()
  }

  if (!bankName) {
    return targetAggregationData
  }

  targetAggregationData[bankUsage][bankName] =
    (targetAggregationData[bankUsage][bankName] || 0) + 1
  targetAggregationData[previousBankname] = bankName

  return targetAggregationData
}

function aggregationDataMerger(
  a: AggregationData | undefined,
  b: AggregationData | undefined
) {
  const result: AggregationData = {
    senderBanknameUsage:
      mergeWith(
        a?.senderBanknameUsage,
        b?.senderBanknameUsage,
        (x: number | undefined, y: number | undefined) => (x ?? 0) + (y ?? 0)
      ) ?? {},
    receiverBanknameUsage:
      mergeWith(
        a?.receiverBanknameUsage,
        b?.receiverBanknameUsage,
        (x: number | undefined, y: number | undefined) => (x ?? 0) + (y ?? 0)
      ) ?? {},
    senderPreviousBankName:
      b?.senderPreviousBankName || a?.senderPreviousBankName || '',
    receiverPreviousBankName:
      b?.receiverPreviousBankName || a?.receiverPreviousBankName || '',
  }
  return result
}
