import { LegacyFilters, TransactionHistoricalFilters } from '../filters'
import { TimeWindow } from '../utils/rule-parameter-schemas'
import { RuleAggregationFunc } from '@/@types/openapi-internal/RuleAggregationFunc'
import { AlertCreationDirection } from '@/@types/openapi-internal/AlertCreationDirection'
import { RuleAggregationVariable } from '@/@types/openapi-internal/RuleAggregationVariable'

export function migrateCheckDirectionParameters(
  type: 'COUNT' | 'AMOUNT',
  parameters: {
    timeWindow: TimeWindow
    checkSender?: 'sending' | 'all' | 'none'
    checkReceiver?: 'receiving' | 'all' | 'none'
    originMatchPaymentMethodDetails?: boolean
    destinationMatchPaymentMethodDetails?: boolean
  },
  _historicalFilters: TransactionHistoricalFilters
): {
  logicAggregationVariables: RuleAggregationVariable[]
  alertCreationDirection: AlertCreationDirection
} {
  let aggregationFunc: RuleAggregationFunc
  if (type === 'COUNT') {
    aggregationFunc = 'COUNT'
  } else if (type === 'AMOUNT') {
    aggregationFunc = 'SUM'
  } else {
    throw new Error('Invalid type')
  }
  let aggregationFieldKey: string = ''
  if (type === 'COUNT') {
    aggregationFieldKey = 'TRANSACTION:transactionId'
  }

  const logicAggregationVariables: RuleAggregationVariable[] = []
  if (parameters.checkSender === 'sending') {
    if (type === 'AMOUNT') {
      aggregationFieldKey = 'TRANSACTION:originAmountDetails-transactionAmount'
    }
    logicAggregationVariables.push({
      key: 'agg:sending',
      type: parameters.originMatchPaymentMethodDetails
        ? 'PAYMENT_DETAILS_TRANSACTIONS'
        : 'USER_TRANSACTIONS',
      userDirection: 'SENDER',
      transactionDirection: 'SENDING',
      aggregationFieldKey,
      aggregationFunc,
      timeWindow: {
        start: parameters.timeWindow,
        end: { units: 0, granularity: 'now' },
      },
    })
  }
  if (parameters.checkReceiver === 'receiving') {
    if (type === 'AMOUNT') {
      aggregationFieldKey =
        'TRANSACTION:destinationAmountDetails-transactionAmount'
    }
    logicAggregationVariables.push({
      key: 'agg:receiving',
      type: parameters.destinationMatchPaymentMethodDetails
        ? 'PAYMENT_DETAILS_TRANSACTIONS'
        : 'USER_TRANSACTIONS',
      userDirection: 'RECEIVER',
      transactionDirection: 'RECEIVING',
      aggregationFieldKey,
      aggregationFunc,
      timeWindow: {
        start: parameters.timeWindow,
        end: { units: 0, granularity: 'now' },
      },
    })
  }
  if (
    !parameters.checkSender ||
    parameters.checkSender === 'all' ||
    !parameters.checkReceiver ||
    parameters.checkReceiver === 'all'
  ) {
    let secondaryAggregationFieldKey = 'TRANSACTION:transactionId'
    if (type === 'AMOUNT') {
      if (parameters.checkSender) {
        aggregationFieldKey =
          'TRANSACTION:originAmountDetails-transactionAmount'
        secondaryAggregationFieldKey =
          'TRANSACTION:destinationAmountDetails-transactionAmount'
      } else {
        aggregationFieldKey =
          'TRANSACTION:destinationAmountDetails-transactionAmount'
        secondaryAggregationFieldKey =
          'TRANSACTION:originAmountDetails-transactionAmount'
      }
    }
    logicAggregationVariables.push({
      key: 'agg:sending-receiving',
      type:
        parameters.originMatchPaymentMethodDetails ||
        parameters.destinationMatchPaymentMethodDetails
          ? 'PAYMENT_DETAILS_TRANSACTIONS'
          : 'USER_TRANSACTIONS',
      userDirection: 'SENDER_OR_RECEIVER',
      transactionDirection: 'SENDING_RECEIVING',
      aggregationFieldKey,
      secondaryAggregationFieldKey,
      aggregationFunc,
      timeWindow: {
        start: parameters.timeWindow,
        end: { units: 0, granularity: 'now' },
      },
    })
  }
  let alertCreationDirection: AlertCreationDirection = 'AUTO'
  if (parameters.checkSender !== 'none' && parameters.checkReceiver == 'none') {
    alertCreationDirection = 'AUTO_ORIGIN'
  } else if (
    parameters.checkReceiver !== 'none' &&
    parameters.checkSender == 'none'
  ) {
    alertCreationDirection = 'AUTO_DESTINATION'
  }

  // TODO (V8): Apply historicalFilters to logicAggregationVariables

  return {
    logicAggregationVariables,
    alertCreationDirection,
  }
}

// TODO (V8): Migrate all filters
export function getFiltersConditions(filters: LegacyFilters) {
  const conditions: any[] = []
  if (filters.originPaymentFilters) {
    const { paymentMethods, cardPaymentChannels } = filters.originPaymentFilters
    if (paymentMethods && paymentMethods.includes('CARD')) {
      const condition: any = {
        and: [
          {
            '==': [
              {
                var: 'TRANSACTION:originPaymentDetails-method',
              },
              'CARD',
            ],
          },
        ],
      }
      if (cardPaymentChannels) {
        condition.and.push({
          in: [
            {
              var: 'TRANSACTION:originPaymentDetails-paymentChannel',
            },
            cardPaymentChannels,
          ],
        })
      }
      conditions.push(condition)
    }
  }
  return conditions
}
