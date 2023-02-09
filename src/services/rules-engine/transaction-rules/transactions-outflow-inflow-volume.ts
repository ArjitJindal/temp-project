import { JSONSchemaType } from 'ajv'
import * as _ from 'lodash'
import {
  AuxiliaryIndexTransaction,
  TransactionRepository,
} from '../repositories/transaction-repository'
import {
  getTransactionsTotalAmount,
  getTransactionUserPastTransactions,
} from '../utils/transaction-rule-utils'
import {
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  TRANSACTION_TYPE_SCHEMA,
  COMPARATOR_SCHEMA,
  Comparator,
  ValueComparator,
  VALUE_COMPARATOR_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionFilters } from '../filters'
import { RuleHitResult } from '../rule'
import { compareNumber } from '../utils/rule-schema-utils'
import { TransactionRule } from './rule'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { PaymentDetails } from '@/@types/tranasction/payment-type'

export type TransactionsOutflowInflowVolumeRuleParameters = {
  timeWindow: TimeWindow
  outflowTransactionType: TransactionType
  inflowTransactionType: TransactionType
  outflowInflowComparator: Comparator
  outflow3dsDonePercentageThreshold?: ValueComparator
  inflow3dsDonePercentageThreshold?: ValueComparator
}

export default class TransactionsOutflowInflowVolumeRule extends TransactionRule<
  TransactionsOutflowInflowVolumeRuleParameters,
  TransactionFilters
> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<TransactionsOutflowInflowVolumeRuleParameters> {
    return {
      type: 'object',
      properties: {
        timeWindow: TIME_WINDOW_SCHEMA(),
        outflowTransactionType: TRANSACTION_TYPE_SCHEMA({
          title: 'Outflow Transaction Type',
        }),
        inflowTransactionType: TRANSACTION_TYPE_SCHEMA({
          title: 'Inflow Transaction Type',
        }),
        outflowInflowComparator: COMPARATOR_SCHEMA({
          title: 'Outflow/Inflow transaction volume comparator',
          description:
            'Compares outflow transaction volume to inflow transaction volume',
        }),
        outflow3dsDonePercentageThreshold: VALUE_COMPARATOR_OPTIONAL_SCHEMA({
          title:
            'Percentage threshold of 3DS set to true (CARD payment method only) - Outflow Transactions',
        }),
        inflow3dsDonePercentageThreshold: VALUE_COMPARATOR_OPTIONAL_SCHEMA({
          title:
            'Percentage threshold of 3DS set to true (CARD payment method only) - Inflow Transactions',
        }),
      },
      required: [
        'timeWindow',
        'outflowTransactionType',
        'inflowTransactionType',
        'outflowInflowComparator',
      ],
    }
  }

  public async computeRule() {
    const { timeWindow, outflowTransactionType, inflowTransactionType } =
      this.parameters
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const { senderSendingTransactions, receiverSendingTransactions } =
      await getTransactionUserPastTransactions(
        this.transaction,
        transactionRepository,
        {
          timeWindow,
          checkSender: 'sending',
          checkReceiver: 'sending',
          transactionTypes: [outflowTransactionType],
          transactionState: this.filters.transactionState,
          paymentMethod: this.filters.paymentMethod,
          countries: this.filters.transactionCountries,
        },
        [
          'originAmountDetails',
          'destinationAmountDetails',
          'originPaymentDetails',
          'destinationPaymentDetails',
        ]
      )
    const { senderReceivingTransactions, receiverReceivingTransactions } =
      await getTransactionUserPastTransactions(
        this.transaction,
        transactionRepository,
        {
          timeWindow,
          checkSender: 'receiving',
          checkReceiver: 'receiving',
          transactionTypes: [inflowTransactionType],
          transactionState: this.filters.transactionState,
          paymentMethod: this.filters.paymentMethod,
          countries: this.filters.transactionCountries,
        },
        [
          'originAmountDetails',
          'destinationAmountDetails',
          'originPaymentDetails',
          'destinationPaymentDetails',
        ]
      )

    const hitResult: RuleHitResult = []
    if (
      this.transaction.originAmountDetails &&
      this.transaction.type === outflowTransactionType
    ) {
      const hitInfo = await this.isHit(
        senderSendingTransactions.concat(this.transaction),
        senderReceivingTransactions
      )
      if (hitInfo) {
        hitResult.push({
          direction: 'ORIGIN',
          vars: {
            ...super.getTransactionVars('origin'),
            outflowAmount: hitInfo.outflowAmount,
            inflowAmount: hitInfo.inflowAmount,
          },
        })
      }
    }
    if (
      this.transaction.destinationAmountDetails &&
      this.transaction.type === inflowTransactionType
    ) {
      const hitInfo = await this.isHit(
        receiverSendingTransactions,
        receiverReceivingTransactions.concat(this.transaction)
      )
      if (hitInfo) {
        hitResult.push({
          direction: 'DESTINATION',
          vars: {
            ...super.getTransactionVars('destination'),
            outflowAmount: hitInfo.outflowAmount,
            inflowAmount: hitInfo.inflowAmount,
          },
        })
      }
    }
    return hitResult
  }

  private async isHit(
    sendingTransactions: Array<AuxiliaryIndexTransaction>,
    receivingTransactions: Array<AuxiliaryIndexTransaction>
  ): Promise<{
    outflowAmount: TransactionAmountDetails
    inflowAmount: TransactionAmountDetails
  } | null> {
    const {
      outflowInflowComparator,
      outflow3dsDonePercentageThreshold,
      inflow3dsDonePercentageThreshold,
    } = this.parameters
    if (outflow3dsDonePercentageThreshold) {
      const ourflow3dsDonePercentage = this.get3dsDonePercentage(
        sendingTransactions.map((t) => t.originPaymentDetails)
      )
      if (
        !compareNumber(
          ourflow3dsDonePercentage,
          outflow3dsDonePercentageThreshold
        )
      ) {
        return null
      }
    }
    if (inflow3dsDonePercentageThreshold) {
      const inflow3dsDonePercentage = this.get3dsDonePercentage(
        receivingTransactions.map((t) => t.destinationPaymentDetails)
      )
      if (
        !compareNumber(
          inflow3dsDonePercentage,
          inflow3dsDonePercentageThreshold
        )
      ) {
        return null
      }
    }

    const outflowAmounts = sendingTransactions
      .map((t) => t.originAmountDetails)
      .filter(Boolean)
    const inflowAmounts = receivingTransactions
      .map((t) => t.destinationAmountDetails)
      .filter(Boolean)
    if (outflowAmounts.length === 0 || inflowAmounts.length === 0) {
      return null
    }
    const targetCurrency = outflowAmounts[0]!.transactionCurrency
    const outflowTotalAmount = await getTransactionsTotalAmount(
      outflowAmounts,
      targetCurrency
    )
    const inflowTotalAmount = await getTransactionsTotalAmount(
      inflowAmounts,
      targetCurrency
    )
    let hit = false
    switch (outflowInflowComparator) {
      case 'GREATER_THAN_OR_EQUAL_TO':
        hit =
          outflowTotalAmount.transactionAmount >=
          inflowTotalAmount.transactionAmount
        break
      case 'LESS_THAN_OR_EQUAL_TO':
        hit =
          outflowTotalAmount.transactionAmount <=
          inflowTotalAmount.transactionAmount
        break
    }
    if (!hit) {
      return null
    }
    return {
      outflowAmount: outflowTotalAmount,
      inflowAmount: inflowTotalAmount,
    }
  }

  private get3dsDonePercentage(
    paymentDetails: Array<PaymentDetails | undefined>
  ) {
    return (
      (paymentDetails.filter(
        (p) => p && p.method === 'CARD' && (p._3dsDone || (p as any)['3dsDone'])
      ).length /
        paymentDetails.length) *
      100
    )
  }
}
