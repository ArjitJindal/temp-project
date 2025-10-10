import { V8LogicToText } from '..'
import { LogicAggregationVariable } from '@/@types/openapi-internal/LogicAggregationVariable'
import { LogicEntityVariableInUse } from '@/@types/openapi-internal/LogicEntityVariableInUse'

describe('LogicToText', () => {
  const logicAggregationVariables: LogicAggregationVariable[] = [
    {
      aggregationFieldKey:
        'TRANSACTION:destinationAmountDetails-transactionAmount',
      aggregationFunc: 'AVG',
      timeWindow: {
        start: { granularity: 'month', rollingBasis: true, units: 3 },
        end: { granularity: 'now', rollingBasis: true, units: 0 },
      },
      userDirection: 'SENDER',
      type: 'USER_TRANSACTIONS',
      transactionDirection: 'SENDING',
      includeCurrentEntity: false,
      version: 1734701783480,
      key: 'agg:da73fedc',
      baseCurrency: 'GBP',
    },
  ]
  const logicEntityVariables: LogicEntityVariableInUse[] = [
    {
      key: 'entity:26ad0499',
      entityKey: 'TRANSACTION:destinationAmountDetails-transactionAmount',
    },
  ]

  const logic: any = {
    and: [
      {
        '>=': [
          { var: 'entity:26ad0499' },
          { '*': [2, { var: 'agg:da73fedc' }] },
        ],
      },
      { '!=': [{ var: 'agg:da73fedc' }, 0] },
    ],
  }

  it('should convert logic to text', () => {
    const logicToText = new V8LogicToText(
      logic,
      logicEntityVariables,
      logicAggregationVariables
    )

    expect(logicToText.ruleLogicToText('Rule is hit when ')).toBe(
      'Rule is hit when (Transaction destination amount details transaction amount is greater than or equal to 2 multiplied by Avg of sending transactions by a sender user from now to 3 months ago and Avg of sending transactions by a sender user from now to 3 months ago is not equal to 0)'
    )
  })
})
