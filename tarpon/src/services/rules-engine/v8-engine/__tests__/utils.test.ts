import {
  getAggregationGranularity,
  transformJsonLogic,
  transformJsonLogicVars,
} from '../utils'
import { RuleAggregationTimeWindowGranularity } from '@/@types/openapi-internal/RuleAggregationTimeWindowGranularity'

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
  it('different key and entityKey', () => {
    const updatedJsonLogic = transformJsonLogic(
      {
        and: [
          {
            '==': [
              {
                var: 'entity:1',
              },
              'CONSUMER',
            ],
          },
        ],
      },
      [{ key: 'entity:1', entityKey: 'USER:type__BOTH' }]
    )
    expect(updatedJsonLogic).toEqual({
      and: [
        {
          or: [
            {
              '==': [
                {
                  var: 'entity:1__SENDER',
                },
                'CONSUMER',
              ],
            },
            {
              '==': [
                {
                  var: 'entity:1__RECEIVER',
                },
                'CONSUMER',
              ],
            },
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

describe('Transform var data', () => {
  it('return the original var data if no need to transform', () => {
    const vars = transformJsonLogicVars({}, { v1: 'k1', v2: 2 })
    expect(vars).toEqual({ v1: 'k1', v2: 2 })
  })

  it('filter out invalid value', () => {
    const vars = transformJsonLogicVars(
      {},
      { v1: 0, v2: '', v3: null, v4: undefined, v5: NaN }
    )
    expect(vars).toEqual({ v1: 0, v2: '' })
  })

  it('truncate list values', () => {
    const vars = transformJsonLogicVars(
      {},
      { v1: 'k1', v2: [1, 2, 3, 4, 5] },
      { maxVarDataLength: 3 }
    )
    expect(vars).toEqual({ v1: 'k1', v2: [1, 2, 3] })
  })

  it('transform array-type variables - simple', () => {
    const vars = transformJsonLogicVars(
      {
        and: [
          {
            some: [
              {
                var: 'root',
              },
              {
                some: [
                  {
                    var: 'a',
                  },
                  {
                    '==': [
                      {
                        var: 'b',
                      },
                      'abc',
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        v1: 'k1',
        root: [{ a: [{ b: '1' }] }, { a: [{ b: '2' }, { b: '3' }] }],
      }
    )
    expect(vars).toEqual({ v1: 'k1', root: { 'a.b': ['1', '2', '3'] } })
  })

  it('transform array-type variables - complex', () => {
    const vars = transformJsonLogicVars(
      {
        and: [
          {
            some: [
              {
                var: 'root',
              },
              {
                and: [
                  {
                    some: [
                      {
                        var: 'a',
                      },
                      {
                        some: [
                          {
                            var: 'b',
                          },
                          {
                            and: [
                              {
                                '==': [
                                  {
                                    var: 'c',
                                  },
                                  'k',
                                ],
                              },
                              {
                                '==': [
                                  {
                                    var: 'd',
                                  },
                                  'v',
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    '==': [
                      {
                        var: 'e',
                      },
                      '10',
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        v1: 'k1',
        root: [
          { a: [{ b: [{ c: 1, d: 2 }] }], e: 'a' },
          { a: [{ b: [{ c: 3, d: 4 }] }], e: '10' },
        ],
      }
    )
    expect(vars).toEqual({
      v1: 'k1',
      root: { 'a.b.c': [1, 3], 'a.b.d': [2, 4], e: ['a', '10'] },
    })
  })
})

const GRANULARITY_TEST_CASES: Array<{
  timeWindow: RuleAggregationTimeWindowGranularity[]
  expectedGranularity: RuleAggregationTimeWindowGranularity[]
}> = [
  {
    timeWindow: ['all_time', 'year'],
    expectedGranularity: ['year', 'day'],
  },
  {
    timeWindow: ['all_time', 'month'],
    expectedGranularity: ['month', 'day'],
  },
  {
    timeWindow: ['all_time', 'week'],
    expectedGranularity: ['week', 'day'],
  },
  {
    timeWindow: ['all_time', 'day'],
    expectedGranularity: ['day', 'day'],
  },
  {
    timeWindow: ['all_time', 'hour'], // invalid combination
    expectedGranularity: ['day', 'day'],
  },
  {
    timeWindow: ['year', 'year'],
    expectedGranularity: ['year', 'day'],
  },
  {
    timeWindow: ['year', 'month'],
    expectedGranularity: ['month', 'day'],
  },
  {
    timeWindow: ['year', 'week'],
    expectedGranularity: ['week', 'day'],
  },
  {
    timeWindow: ['year', 'day'],
    expectedGranularity: ['day', 'day'],
  },
  {
    timeWindow: ['year', 'hour'], // invalid combination
    expectedGranularity: ['day', 'day'],
  },
  {
    timeWindow: ['month', 'month'],
    expectedGranularity: ['month', 'day'],
  },
  {
    timeWindow: ['month', 'week'],
    expectedGranularity: ['week', 'day'],
  },
  {
    timeWindow: ['month', 'day'],
    expectedGranularity: ['day', 'day'],
  },
  {
    timeWindow: ['month', 'hour'],
    expectedGranularity: ['hour', 'hour'],
  },
  {
    timeWindow: ['week', 'week'],
    expectedGranularity: ['week', 'day'],
  },
  {
    timeWindow: ['week', 'day'],
    expectedGranularity: ['day', 'day'],
  },
  {
    timeWindow: ['week', 'hour'],
    expectedGranularity: ['hour', 'hour'],
  },
  {
    timeWindow: ['day', 'day'],
    expectedGranularity: ['day', 'hour'],
  },
  {
    timeWindow: ['day', 'hour'],
    expectedGranularity: ['hour', 'hour'],
  },
  {
    timeWindow: ['all_time', 'now'],
    expectedGranularity: ['year', 'day'],
  },
  {
    timeWindow: ['year', 'now'],
    expectedGranularity: ['year', 'day'],
  },
  {
    timeWindow: ['month', 'now'],
    expectedGranularity: ['month', 'day'],
  },
  {
    timeWindow: ['week', 'now'],
    expectedGranularity: ['week', 'day'],
  },
  {
    timeWindow: ['day', 'now'],
    expectedGranularity: ['day', 'hour'],
  },
  {
    timeWindow: ['hour', 'now'],
    expectedGranularity: ['hour', 'hour'],
  },
]

describe('getAggregationGranularity', () => {
  GRANULARITY_TEST_CASES.forEach(({ timeWindow, expectedGranularity }) => {
    it(`returns "${timeWindow}" - ${expectedGranularity}`, () => {
      const [start, end] = timeWindow
      const nonRolling = getAggregationGranularity(
        {
          start: { units: 5, granularity: start },
          end: { units: 1, granularity: end },
        },
        'default'
      )
      expect(nonRolling).toEqual(expectedGranularity[0])
      const rolling = getAggregationGranularity(
        {
          start: { units: 5, granularity: start, rollingBasis: true },
          end: { units: 1, granularity: end, rollingBasis: true },
        },
        'default'
      )
      expect(rolling).toEqual(expectedGranularity[1])
    })
  })
})
