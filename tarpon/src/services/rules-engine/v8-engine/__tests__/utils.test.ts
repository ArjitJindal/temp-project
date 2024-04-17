import { RuleAggregationVariable } from '@/@types/openapi-internal/RuleAggregationVariable'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const transformJsonLogic = require('../utils').transformJsonLogic as (
  rawJsonLogic: object,
  aggVariables?: RuleAggregationVariable[]
) => object

describe('Transform json logic with direction-less entity variables', () => {
  it('no direction-less entity variable', () => {
    const logic = {
      and: [
        {
          '==': [
            {
              var: 'USER:type__SENDER',
            },
            'CONSUMER',
          ],
        },
      ],
    }
    const updatedJsonLogic = transformJsonLogic(logic)
    expect(updatedJsonLogic).toEqual(logic)
  })
  it('partial direction-less entity variable', () => {
    const updatedJsonLogic = transformJsonLogic({
      and: [
        {
          '==': [
            {
              var: 'USER:type__BOTH',
            },
            'CONSUMER',
          ],
        },
        {
          '>': [
            {
              var: 'TRANSACTION:originAmountDetails-transactionAmount',
            },
            100,
          ],
        },
      ],
    })
    expect(updatedJsonLogic).toEqual({
      and: [
        {
          or: [
            {
              '==': [
                {
                  var: 'USER:type__SENDER',
                },
                'CONSUMER',
              ],
            },
            {
              '==': [
                {
                  var: 'USER:type__RECEIVER',
                },
                'CONSUMER',
              ],
            },
          ],
        },
        {
          '>': [
            {
              var: 'TRANSACTION:originAmountDetails-transactionAmount',
            },
            100,
          ],
        },
      ],
    })
  })
  it('all direction-less entity variables', () => {
    const updatedJsonLogic = transformJsonLogic({
      and: [
        {
          '==': [
            {
              var: 'USER:type__BOTH',
            },
            'CONSUMER',
          ],
        },
        {
          '>': [
            {
              var: 'TRANSACTION:amountDetails-transactionAmount__BOTH',
            },
            100,
          ],
        },
      ],
    })
    expect(updatedJsonLogic).toEqual({
      and: [
        {
          or: [
            {
              '==': [
                {
                  var: 'USER:type__SENDER',
                },
                'CONSUMER',
              ],
            },
            {
              '==': [
                {
                  var: 'USER:type__RECEIVER',
                },
                'CONSUMER',
              ],
            },
          ],
        },
        {
          or: [
            {
              '>': [
                {
                  var: 'TRANSACTION:originAmountDetails-transactionAmount',
                },
                100,
              ],
            },
            {
              '>': [
                {
                  var: 'TRANSACTION:destinationAmountDetails-transactionAmount',
                },
                100,
              ],
            },
          ],
        },
      ],
    })
  })
  it('nested logic groups', () => {
    const updatedJsonLogic = transformJsonLogic({
      and: [
        {
          '==': [
            {
              var: 'USER:type__BOTH',
            },
            'CONSUMER',
          ],
        },
        {
          or: [
            {
              '==': [
                {
                  var: 'USER:type__BOTH',
                },
                'CONSUMER',
              ],
            },
            {
              '==': [
                {
                  var: 'USER:type__BOTH',
                },
                'BUSINESS',
              ],
            },
          ],
        },
      ],
    })
    expect(updatedJsonLogic).toEqual({
      and: [
        {
          or: [
            {
              '==': [
                {
                  var: 'USER:type__SENDER',
                },
                'CONSUMER',
              ],
            },
            {
              '==': [
                {
                  var: 'USER:type__RECEIVER',
                },
                'CONSUMER',
              ],
            },
          ],
        },
        {
          or: [
            {
              or: [
                {
                  '==': [
                    {
                      var: 'USER:type__SENDER',
                    },
                    'CONSUMER',
                  ],
                },
                {
                  '==': [
                    {
                      var: 'USER:type__RECEIVER',
                    },
                    'CONSUMER',
                  ],
                },
              ],
            },
            {
              or: [
                {
                  '==': [
                    {
                      var: 'USER:type__SENDER',
                    },
                    'BUSINESS',
                  ],
                },
                {
                  '==': [
                    {
                      var: 'USER:type__RECEIVER',
                    },
                    'BUSINESS',
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
  })
  it('with function', () => {
    const updatedJsonLogic = transformJsonLogic({
      and: [
        {
          '==': [
            {
              '+': [
                {
                  var: 'TRANSACTION:amountDetails-transactionAmount__BOTH',
                },
                10,
              ],
            },
            100,
          ],
        },
      ],
    })
    expect(updatedJsonLogic).toEqual({
      and: [
        {
          or: [
            {
              '==': [
                {
                  '+': [
                    {
                      var: 'TRANSACTION:originAmountDetails-transactionAmount',
                    },
                    10,
                  ],
                },
                100,
              ],
            },
            {
              '==': [
                {
                  '+': [
                    {
                      var: 'TRANSACTION:destinationAmountDetails-transactionAmount',
                    },
                    10,
                  ],
                },
                100,
              ],
            },
          ],
        },
      ],
    })
  })

  it('Both LHS and RHS are direction-less variables', () => {
    const updatedJsonLogic = transformJsonLogic({
      and: [
        {
          '==': [
            {
              var: 'TRANSACTION:amountDetails-country__BOTH',
            },
            {
              var: 'TRANSACTION:paymentDetails-country__BOTH',
            },
          ],
        },
      ],
    })
    expect(updatedJsonLogic).toEqual({
      and: [
        {
          or: [
            {
              or: [
                {
                  '==': [
                    {
                      var: 'TRANSACTION:originAmountDetails-country',
                    },
                    {
                      var: 'TRANSACTION:originPaymentDetails-country',
                    },
                  ],
                },
                {
                  '==': [
                    {
                      var: 'TRANSACTION:destinationAmountDetails-country',
                    },
                    {
                      var: 'TRANSACTION:originPaymentDetails-country',
                    },
                  ],
                },
              ],
            },
            {
              or: [
                {
                  '==': [
                    {
                      var: 'TRANSACTION:originAmountDetails-country',
                    },
                    {
                      var: 'TRANSACTION:destinationPaymentDetails-country',
                    },
                  ],
                },
                {
                  '==': [
                    {
                      var: 'TRANSACTION:destinationAmountDetails-country',
                    },
                    {
                      var: 'TRANSACTION:destinationPaymentDetails-country',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
  })
})
