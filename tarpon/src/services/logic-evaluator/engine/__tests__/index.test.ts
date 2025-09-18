import { v4 as uuidv4 } from 'uuid'
import { AggregationRepository } from '../aggregation-repository'
import { getJsonLogicEngine, TransactionLogicData } from '..'
import { createAggregationVariable } from '../test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import {
  getTestTransaction,
  getTestTransactionEvent,
} from '@/test-utils/transaction-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestUser, setUpUsersHooks } from '@/test-utils/user-test-utils'
import { LegalDocument } from '@/@types/openapi-public/LegalDocument'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import dayjs from '@/utils/dayjs'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { LogicAggregationVariable } from '@/@types/openapi-internal/LogicAggregationVariable'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { ReportRepository } from '@/services/sar/repositories/report-repository'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { Address } from '@/@types/openapi-public/Address'
import { getAddressStringForAggregation } from '@/utils/helpers'

jest.mock('../../operators/starts-ends-with', () => {
  const actualModule = jest.requireActual('../../operators/starts-ends-with')
  return {
    ...actualModule,
    STARTS_WITH_OPERATOR: {
      ...actualModule.STARTS_WITH_OPERATOR,
      run: jest.fn().mockImplementation(actualModule.STARTS_WITH_OPERATOR.run),
    },
  }
})
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { STARTS_WITH_OPERATOR } = require('../../operators/starts-ends-with')

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LogicEvaluator } = require('..')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { canAggregate } = require('../utils')
const bulkVerifyTransactions =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('@/test-utils/rule-test-utils').bulkVerifyTransactions

dynamoDbSetupHook()

describe('Logic engine', () => {
  const jsonLogicEngine = getJsonLogicEngine()
  describe('Basic functions', () => {
    test('simple math', async () => {
      const result = await jsonLogicEngine.run({ '+': [2, 2] })
      expect(result).toEqual(4)
    })
  })
  describe('By examples', () => {
    const cases = [
      {
        logic: {
          and: [
            {
              some: [
                {
                  var: 'entity:01',
                },
                {
                  '==': [
                    {
                      var: 'documentIssuedDate',
                    },
                    {
                      var: 'entity:02',
                    },
                  ],
                },
              ],
            },
          ],
        },
        data: {
          'entity:01': [
            {
              documentIssuedDate: 123,
            },
            {
              documentIssuedDate: 789,
            },
          ],
          'entity:02': 123,
        },
        expected: true,
      },
      {
        logic: {
          and: [
            {
              some: [
                {
                  var: 'entity:01',
                },
                {
                  or: [
                    {
                      '==': [
                        {
                          var: 'documentIssuedDate',
                        },
                        {
                          var: 'entity:02',
                        },
                      ],
                    },
                    {
                      '<': [
                        {
                          var: 'documentExpirationDate',
                        },
                        {
                          var: 'entity:02',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        data: {
          'entity:01': [
            {
              documentIssuedDate: 123,
            },
            {
              documentIssuedDate: 789,
            },
          ],
          'entity:02': 789,
        },
        expected: true,
      },
      {
        logic: {
          filter: [
            {
              var: 'entity:01',
            },
            {
              '==': [
                {
                  var: 'documentIssuedDate',
                },
                {
                  var: 'entity:02',
                },
              ],
            },
          ],
        },
        data: {
          'entity:01': [
            {
              documentIssuedDate: 123,
            },
            {
              documentIssuedDate: 789,
            },
          ],
          'entity:02': 789,
        },
        expected: [
          {
            documentIssuedDate: 789,
          },
        ],
      },
      {
        logic: {
          and: [
            {
              '==': [
                {
                  reduce: [
                    {
                      filter: [
                        {
                          var: 'entity:01',
                        },
                        {
                          '==': [
                            {
                              var: 'documentIssuedDate',
                            },
                            {
                              var: 'entity:02',
                            },
                          ],
                        },
                      ],
                    },
                    {
                      '+': [
                        1,
                        {
                          var: 'accumulator',
                        },
                      ],
                    },
                    0,
                  ],
                },
                1,
              ],
            },
          ],
        },
        data: {
          'entity:01': [
            {
              documentIssuedDate: 123,
            },
            {
              documentIssuedDate: 789,
            },
          ],
          'entity:02': 789,
        },
        expected: true,
      },
      {
        logic: {
          reduce: [
            {
              filter: [
                {
                  var: 'entity:01',
                },
                {
                  and: [
                    {
                      '==': [
                        {
                          var: 'documentIssuedDate',
                        },
                        {
                          var: 'entity:02',
                        },
                      ],
                    },
                    {
                      some: [
                        {
                          var: 'tags',
                        },
                        {
                          '==': [
                            {
                              var: 'key',
                            },
                            {
                              var: 'entity:03',
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              '+': [
                1,
                {
                  var: 'accumulator',
                },
              ],
            },
            0,
          ],
        },
        expected: 1,
        data: {
          'entity:01': [
            {
              documentIssuedDate: 123,
              tags: [{ key: 'v2' }],
            },
            {
              documentIssuedDate: 789,
              tags: [{ key: 'v2' }],
            },
            {
              documentIssuedDate: 789,
              tags: [{ key: 'v1' }],
            },
          ],
          'entity:02': 789,
          'entity:03': 'v2',
        },
      },
    ]
    for (let i = 0; i < cases.length; i++) {
      const { logic, expected, data = {} } = cases[i]
      test(`case #${i}`, async () => {
        const result = await jsonLogicEngine.run(logic, data)
        expect(result).toEqual(expected)
      })
    }
  })
  describe('Array build-in operations customisation', () => {
    describe('all', () => {
      it('Default logic', async () => {
        {
          const logic = {
            all: [{ var: 'array' }, { '<=': [{ var: '' }, 3] }],
          }
          expect(
            await jsonLogicEngine.run(logic, {
              array: [1, 2, 3],
            })
          ).toBe(true)
        }
        {
          const logic = {
            all: [{ var: 'array' }, { '<=': [{ var: '' }, 2] }],
          }
          expect(
            await jsonLogicEngine.run(logic, {
              array: [1, 2, 3],
            })
          ).toBe(false)
        }
      })
      it('Using global variables', async () => {
        const logic = {
          all: [
            { var: 'array' },
            { '<=': [{ var: 'x' }, { var: 'toCompare' }] },
          ],
        }
        expect(
          await jsonLogicEngine.run(logic, {
            array: [{ x: 1 }, { x: 2 }, { x: 3 }],
            toCompare: 3,
          })
        ).toBe(true)
        // expect(
        //   await jsonLogicEngine.run(logic, {
        //     array: [{ x: 1 }, { x: 2 }, { x: 3 }],
        //     toCompare: 2,
        //   })
        // ).toBe(false)
      })
    })
    describe('some', () => {
      it('Default logic', async () => {
        {
          const logic = {
            some: [[1, 2, 3], { '==': [{ var: '' }, 3] }],
          }
          expect(await jsonLogicEngine.run(logic)).toBe(true)
        }
        {
          const logic = {
            some: [[1, 2, 3], { '==': [{ var: '' }, 4] }],
          }
          expect(await jsonLogicEngine.run(logic)).toBe(false)
        }
      })
      it('Using global variables', async () => {
        const logic = {
          some: [
            { var: 'array' },
            { '==': [{ var: 'x' }, { var: 'toCompare' }] },
          ],
        }
        expect(
          await jsonLogicEngine.run(logic, {
            array: [{ x: 1 }, { x: 2 }, { x: 3 }],
            toCompare: 3,
          })
        ).toBe(true)
        expect(
          await jsonLogicEngine.run(logic, {
            array: [{ x: 1 }, { x: 2 }, { x: 3 }],
            toCompare: 4,
          })
        ).toBe(false)
      })
    })
    describe('none', () => {
      it('Default logic', async () => {
        {
          const logic = {
            none: [[1, 2, 3], { '==': [{ var: '' }, 4] }],
          }
          expect(await jsonLogicEngine.run(logic)).toBe(true)
        }
        {
          const logic = {
            none: [[1, 2, 3], { '==': [{ var: '' }, 3] }],
          }
          expect(await jsonLogicEngine.run(logic)).toBe(false)
        }
      })
      it('Using global variables', async () => {
        const logic = {
          none: [
            { var: 'array' },
            { '==': [{ var: 'x' }, { var: 'toCompare' }] },
          ],
        }
        expect(
          await jsonLogicEngine.run(logic, {
            array: [{ x: 1 }, { x: 2 }, { x: 3 }],
            toCompare: 4,
          })
        ).toBe(true)
        expect(
          await jsonLogicEngine.run(logic, {
            array: [{ x: 1 }, { x: 2 }, { x: 3 }],
            toCompare: 3,
          })
        ).toBe(false)
      })
    })
    describe('filter', () => {
      it('Default logic', async () => {
        const logic = {
          filter: [[1, 2, 3, 4, 5], { '<': [{ var: '' }, 4] }],
        }
        expect(await jsonLogicEngine.run(logic)).toEqual([1, 2, 3])
      })
      it('Using global variables', async () => {
        const logic = {
          filter: [{ var: 'array' }, { '<': [{ var: 'x' }, 4] }],
        }
        expect(
          await jsonLogicEngine.run(logic, {
            array: [{ x: 1 }, { x: 2 }, { x: 3 }, { x: 4 }, { x: 5 }],
          })
        ).toEqual([{ x: 1 }, { x: 2 }, { x: 3 }])
      })
    })
    describe('map', () => {
      it('Default logic', async () => {
        const logic = {
          map: [[1, 2, 3, 4, 5], { '*': [{ var: '' }, 2] }],
        }
        expect(await jsonLogicEngine.run(logic)).toEqual([2, 4, 6, 8, 10])
      })
      it('Using global variables', async () => {
        const logic = {
          map: [{ var: 'array' }, { '*': [{ var: 'x' }, 2] }],
        }
        expect(
          await jsonLogicEngine.run(logic, {
            array: [{ x: 1 }, { x: 2 }, { x: 3 }, { x: 4 }, { x: 5 }],
          })
        ).toEqual([2, 4, 6, 8, 10])
      })
    })
    describe('reduce', () => {
      it('Default logic', async () => {
        const logic = {
          reduce: [
            [1, 2, 3, 4, 5],
            { '*': [{ var: 'accumulator' }, { var: 'current' }] },
            10,
          ],
        }
        expect(await jsonLogicEngine.run(logic)).toEqual(1200)
      })
      it('Using global variables', async () => {
        const logic = {
          reduce: [
            [1, 2, 3],
            {
              '*': [{ var: 'accumulator' }, { var: 'current' }, { var: 'mul' }],
            },
            1,
          ],
        }
        expect(
          await jsonLogicEngine.run(logic, {
            mul: 10,
          })
        ).toEqual(6000) // 1 * 10 * 2 * 10 * 3 * 10
      })
    })
  })
})

describe('Entity variable', () => {
  test('executes the json logic - hit', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      {
        and: [{ '==': [{ var: 'TRANSACTION:type' }, 'TRANSFER'] }],
      },
      {},
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        { direction: 'ORIGIN', value: { 'TRANSACTION:type': 'TRANSFER' } },
      ],
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
  })
  test('executes the json logic with all updated logic', async () => {
    const tenantId = getTestTenantId()
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const logic = {
      and: [
        {
          all: [
            {
              var: 'CONSUMER_USER:employmentDetails-businessIndustry__SENDER',
            },
            {
              in: [
                {
                  var: '',
                },
                [
                  'Money Service Business / Money Changer / Money Lender / Financial Market Provider',
                  'Healthcare Services & Products / Traditional Medicine Practitioner',
                  'Educational Services / Child Care Centre / Babysitting Services',
                  'Property / Rental / Leasing',
                  'Not Applicable',
                  'General Workers/ General Labourer / Farmer / Fisherman ',
                  'IT / Telecommunication / Networking / Robotic and Automation',
                  'Beauty Saloon or Parlour / Bridal Services / Fitness',
                ],
              ],
            },
          ],
        },
      ],
    }
    // undefined array
    const result = await evaluator.evaluate(
      logic,
      {},
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'USER',
        user: getTestUser({
          employmentDetails: {},
        }),
      }
    )
    expect(result).toEqual({
      hit: false,
      vars: [{ direction: 'ORIGIN', value: {} }],
      hitDirections: [],
    })
    // empty array
    const result2 = await evaluator.evaluate(
      logic,
      {},
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'USER',
        user: getTestUser({
          employmentDetails: {
            businessIndustry: [],
          },
        }),
      }
    )
    expect(result2).toEqual({
      hit: false,
      vars: [
        {
          direction: 'ORIGIN',
          value: {
            'CONSUMER_USER:employmentDetails-businessIndustry__SENDER': [],
          },
        },
      ],
      hitDirections: [],
    })
    const result3 = await evaluator.evaluate(
      logic,
      {},
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'USER',
        user: getTestUser({
          employmentDetails: {
            businessIndustry: [
              'Money Service Business / Money Changer / Money Lender / Financial Market Provider',
            ],
          },
        }),
      }
    )
    expect(result3).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: {
            'CONSUMER_USER:employmentDetails-businessIndustry__SENDER': [
              'Money Service Business / Money Changer / Money Lender / Financial Market Provider',
            ],
          },
        },
      ],
      hitDirections: ['ORIGIN'],
    })
  })

  test('executes the json logic - hit (tx directionless - 1)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      {
        and: [{ '==': [{ var: 'entity:1' }, '100'] }],
      },
      {
        entity: [
          {
            key: 'entity:1',
            entityKey: 'TRANSACTION:amountDetails-transactionAmount__BOTH',
          },
        ],
      },
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({
          type: 'TRANSFER',
          originAmountDetails: {
            transactionCurrency: 'EUR',
            transactionAmount: 200,
          },
          destinationAmountDetails: {
            transactionCurrency: 'EUR',
            transactionAmount: 100,
          },
        }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'entity:1__SENDER': 200, 'entity:1__RECEIVER': 100 },
        },
      ],
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
  })

  test('executes the json logic - hit (tx directionless - 2)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      {
        and: [
          {
            '==': [
              { var: 'TRANSACTION:amountDetails-transactionAmount__BOTH' },
              '100',
            ],
          },
        ],
      },
      {},
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({
          type: 'TRANSFER',
          originAmountDetails: {
            transactionCurrency: 'EUR',
            transactionAmount: 200,
          },
          destinationAmountDetails: {
            transactionCurrency: 'EUR',
            transactionAmount: 100,
          },
        }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: {
            'TRANSACTION:originAmountDetails-transactionAmount': 200,
            'TRANSACTION:destinationAmountDetails-transactionAmount': 100,
          },
        },
      ],
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
  })

  test('executes the json logic - no hit', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'TRANSACTION:type' }, 'TRANSFER'] }] },
      {},
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'DEPOSIT' }),
      }
    )
    expect(result).toEqual({
      hit: false,
      vars: [{ direction: 'ORIGIN', value: { 'TRANSACTION:type': 'DEPOSIT' } }],
      hitDirections: [],
    })
  })

  test('executes the json logic - hit (user)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      {
        and: [
          { '==': [{ var: 'entity:1' }, 'abc'] },
          { '==': [{ var: 'entity:2' }, 'abc'] },
        ],
      },
      {
        entity: [
          { key: 'entity:1', entityKey: 'CONSUMER_USER:userId__SENDER' },
          { key: 'entity:2', entityKey: 'CONSUMER_USER:userId__BOTH' },
        ],
      },
      { tenantId },
      {
        type: 'USER',
        user: getTestUser({ userId: 'abc' }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: {
            'entity:1': 'abc',
            'entity:2__SENDER': 'abc',
            'entity:2__RECEIVER': 'abc',
          },
        },
      ],
      hitDirections: ['ORIGIN'],
    })
  })

  test('executes the json logic - no hit (user)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'CONSUMER_USER:userId__SENDER' }, 'abc'] }] },
      {},
      { tenantId },
      {
        type: 'USER',
        user: getTestUser({ userId: 'cde' }),
      }
    )
    expect(result).toEqual({
      hit: false,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'CONSUMER_USER:userId__SENDER': 'cde' },
        },
      ],
      hitDirections: [],
    })
  })

  test('executes the json logic - hit (tx event)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'TRANSACTION_EVENT:reason' }, 'abc'] }] },
      {},
      { tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
        transactionEvents: [getTestTransactionEvent({ reason: 'abc' })],
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'TRANSACTION_EVENT:reason': 'abc' },
        },
      ],
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
  })

  test('executes the json logic - no hit (tx event)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'TRANSACTION_EVENT:reason' }, 'abc'] }] },
      {},
      { tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
        transactionEvents: [getTestTransactionEvent({ reason: 'def' })],
      }
    )
    expect(result).toEqual({
      hit: false,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'TRANSACTION_EVENT:reason': 'def' },
        },
      ],
      hitDirections: [],
    })
  })
})

describe('Entity variable (array)', () => {
  const TEST_LOGIC = {
    and: [
      {
        some: [
          { var: 'TRANSACTION:tags' },
          {
            and: [
              { '==': [{ var: 'key' }, 'a'] },
              { '==': [{ var: 'value' }, 'b'] },
            ],
          },
        ],
      },
    ],
  }
  const TEST_LOGIC_NESTED = {
    and: [
      {
        some: [
          { var: 'CONSUMER_USER:legalDocuments__SENDER' },
          {
            some: [
              { var: 'tags' },
              {
                and: [
                  { '==': [{ var: 'key' }, 'a'] },
                  { '==': [{ var: 'value' }, 'b'] },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
  test('executes the json logic - hit', async () => {
    const tenantId = 'tenant-id'
    const evaluator = new LogicEvaluator(tenantId, getDynamoDbClient())
    const result = await evaluator.evaluate(
      TEST_LOGIC,
      {},
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({
          tags: [
            { key: '1', value: '2' },
            { key: 'a', value: 'b' },
          ],
        }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: {
            'TRANSACTION:tags': {
              key: ['1', 'a'],
              value: ['2', 'b'],
            },
          },
        },
      ],
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
  })
  test('executes the json logic - not hit', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      TEST_LOGIC,
      {},
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({
          tags: [
            { key: '1', value: 'b' },
            { key: 'a', value: '2' },
          ],
        }),
      }
    )
    expect(result).toMatchObject({ hit: false })
  })
  test('executes the json logic (nested) - hit', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const testLegalDocuments: LegalDocument[] = [
      {
        documentType: 'passport',
        documentNumber: 'Z9431P',
        documentIssuedCountry: 'DE',
        tags: [
          { key: '1', value: 'b' },
          { key: 'a', value: '2' },
        ],
      },
      {
        documentType: 'passport',
        documentNumber: 'Z9431P',
        documentIssuedCountry: 'DE',
        tags: [
          { key: '1', value: '2' },
          { key: 'a', value: 'b' },
        ],
      },
    ]
    const result = await evaluator.evaluate(
      TEST_LOGIC_NESTED,
      {},
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction(),
        senderUser: getTestUser({
          legalDocuments: testLegalDocuments,
        }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: {
            'CONSUMER_USER:legalDocuments__SENDER': {
              'tags.key': ['1', 'a', '1', 'a'],
              'tags.value': ['b', '2', '2', 'b'],
            },
          },
        },
      ],
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
  })
  test('executes the json logic (nested) - not hit', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      TEST_LOGIC_NESTED,
      {},
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction(),
        senderUser: getTestUser({
          legalDocuments: [
            {
              documentType: 'passport',
              documentNumber: 'Z9431P',
              documentIssuedCountry: 'DE',
              tags: [
                { key: '1', value: 'b' },
                { key: 'a', value: '2' },
              ],
            },
          ],
        }),
      }
    )
    expect(result).toMatchObject({ hit: false })
  })
})

describe('Entity variable (filters)', () => {
  test('executes the json logic - hit', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const testTransaction = getTestTransaction({ transactionState: 'CREATED' })
    const targetTimestamp = dayjs('2024-01-02').valueOf()
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'entity:1' }, targetTimestamp] }] },
      {
        entity: [
          {
            key: 'entity:1',
            entityKey: 'TRANSACTION_EVENT:timestamp',
            filtersLogic: {
              and: [
                {
                  '==': [{ var: 'TRANSACTION:transactionState' }, 'PROCESSING'],
                },
              ],
            },
          },
        ],
      },
      { tenantId },
      {
        type: 'TRANSACTION',
        transaction: testTransaction,
        transactionEvents: [
          getTestTransactionEvent({
            timestamp: dayjs('2024-01-01').valueOf(),
            transactionState: 'CREATED',
            updatedTransactionAttributes: testTransaction,
          }),
          getTestTransactionEvent({
            timestamp: targetTimestamp,
            transactionState: 'PROCESSING',
          }),
          getTestTransactionEvent({
            timestamp: dayjs('2024-01-03').valueOf(),
            transactionState: 'SUCCESSFUL',
          }),
        ],
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'entity:1': targetTimestamp },
        },
      ],
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
  })
  test('executes the json logic - no hit', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const testTransaction = getTestTransaction({ transactionState: 'CREATED' })
    const targetTimestamp = dayjs('2024-01-02').valueOf()
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'entity:1' }, targetTimestamp] }] },
      {
        entity: [
          {
            key: 'entity:1',
            entityKey: 'TRANSACTION_EVENT:timestamp',
            filtersLogic: {
              and: [
                {
                  '==': [{ var: 'TRANSACTION:transactionState' }, 'PROCESSING'],
                },
              ],
            },
          },
        ],
      },
      { tenantId },
      {
        type: 'TRANSACTION',
        transaction: testTransaction,
        transactionEvents: [
          getTestTransactionEvent({
            timestamp: dayjs('2024-01-01').valueOf(),
            transactionState: 'CREATED',
            updatedTransactionAttributes: testTransaction,
          }),
          getTestTransactionEvent({
            timestamp: dayjs('2024-01-03').valueOf(),
            transactionState: 'SUCCESSFUL',
          }),
        ],
      }
    )
    expect(result).toEqual({
      hit: false,
      vars: [
        {
          direction: 'ORIGIN',
          value: {},
        },
      ],
      hitDirections: [],
    })
  })

  test('executes the json logic (TRS) - hit', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const testTransaction = getTestTransaction({
      transactionState: 'CREATED',
    })
    const result = await evaluator.evaluate(
      { and: [{ '>': [{ var: 'entity:1' }, 50] }] },
      {
        entity: [
          {
            key: 'entity:1',
            entityKey: 'TRANSACTION:trsScore',
            filtersLogic: {
              and: [
                {
                  '==': [{ var: 'TRANSACTION:transactionState' }, 'PROCESSING'],
                },
              ],
            },
          },
        ],
      },
      { tenantId },
      {
        type: 'TRANSACTION',
        transaction: testTransaction,
        transactionEvents: [
          getTestTransactionEvent({
            transactionState: 'CREATED',
            updatedTransactionAttributes: testTransaction,
          }),
          getTestTransactionEvent({
            transactionState: 'PROCESSING',
            riskScoreDetails: {
              trsScore: 80,
              trsRiskLevel: 'HIGH',
            },
          }),
          getTestTransactionEvent({
            transactionState: 'SUCCESSFUL',
            riskScoreDetails: {
              trsScore: 20,
              trsRiskLevel: 'LOW',
            },
          }),
        ],
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'entity:1': 80 },
        },
      ],
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
  })
  test('executes the json logic (TRS) - no hit', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const testTransaction = getTestTransaction({
      transactionState: 'CREATED',
    })
    const result = await evaluator.evaluate(
      { and: [{ '>': [{ var: 'entity:1' }, 50] }] },
      {
        entity: [
          {
            key: 'entity:1',
            entityKey: 'TRANSACTION:trsScore',
            filtersLogic: {
              and: [
                {
                  '==': [{ var: 'TRANSACTION:transactionState' }, 'PROCESSING'],
                },
              ],
            },
          },
        ],
      },
      { tenantId },
      {
        type: 'TRANSACTION',
        transaction: testTransaction,
        transactionEvents: [
          getTestTransactionEvent({
            transactionState: 'CREATED',
            updatedTransactionAttributes: testTransaction,
          }),
        ],
      }
    )
    expect(result).toEqual({
      hit: false,
      vars: [
        {
          direction: 'ORIGIN',
          value: {},
        },
      ],
      hitDirections: [],
    })
  })
})

describe('Aggregation variable', () => {
  test('executes the json logic (sending)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      {
        agg: [
          {
            key: 'agg:123',
            type: 'USER_TRANSACTIONS',
            userDirection: 'SENDER',
            transactionDirection: 'SENDING',
            aggregationFieldKey: 'TRANSACTION:transactionId',
            aggregationFunc: 'COUNT',
            timeWindow: {
              start: { units: 30, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            includeCurrentEntity: true,
          },
        ],
      },
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 1 },
        },
      ],
      hitDirections: ['ORIGIN'],
    })
  })

  test('executes the json logic (receiving)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      {
        agg: [
          {
            key: 'agg:123',
            type: 'USER_TRANSACTIONS',
            userDirection: 'RECEIVER',
            transactionDirection: 'RECEIVING',
            aggregationFieldKey: 'TRANSACTION:transactionId',
            aggregationFunc: 'COUNT',
            timeWindow: {
              start: { units: 30, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            includeCurrentEntity: true,
          },
        ],
      },
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 1 },
        },
      ],
      hitDirections: ['DESTINATION'],
    })
  })

  test('executes the json logic (sending + receiving)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      {
        and: [
          { '==': [{ var: 'agg:123' }, 1] },
          { '==': [{ var: 'agg:456' }, 1] },
        ],
      },
      {
        agg: [
          {
            key: 'agg:123',
            type: 'USER_TRANSACTIONS',
            userDirection: 'SENDER',
            transactionDirection: 'SENDING',
            aggregationFieldKey: 'TRANSACTION:transactionId',
            aggregationFunc: 'COUNT',
            timeWindow: {
              start: { units: 30, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            includeCurrentEntity: true,
          },
          {
            key: 'agg:456',
            type: 'USER_TRANSACTIONS',
            userDirection: 'RECEIVER',
            transactionDirection: 'RECEIVING',
            aggregationFieldKey: 'TRANSACTION:transactionId',
            aggregationFunc: 'COUNT',
            timeWindow: {
              start: { units: 30, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            includeCurrentEntity: true,
          },
        ],
      },
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 1, 'agg:456': 1 },
        },
      ],
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
  })

  test('executes the json logic (sending_receiving)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      {
        agg: [
          {
            key: 'agg:123',
            type: 'USER_TRANSACTIONS',
            userDirection: 'SENDER_OR_RECEIVER',
            transactionDirection: 'SENDING_RECEIVING',
            aggregationFieldKey: 'TRANSACTION:transactionId',
            aggregationFunc: 'COUNT',
            timeWindow: {
              start: { units: 30, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            includeCurrentEntity: true,
          },
        ],
      },
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 1 },
        },
        {
          direction: 'DESTINATION',
          value: { 'agg:123': 1 },
        },
      ],
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
  })

  test('executes the json logic (sender-only; sending_receiving)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      {
        agg: [
          {
            key: 'agg:123',
            type: 'USER_TRANSACTIONS',
            userDirection: 'SENDER',
            transactionDirection: 'SENDING_RECEIVING',
            aggregationFieldKey: 'TRANSACTION:transactionId',
            aggregationFunc: 'COUNT',
            timeWindow: {
              start: { units: 30, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            includeCurrentEntity: true,
          },
        ],
      },
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 1 },
        },
      ],
      hitDirections: ['ORIGIN'],
    })
  })

  test('executes the json logic (receiver-only; sending_receiving)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      {
        agg: [
          {
            key: 'agg:123',
            type: 'USER_TRANSACTIONS',
            userDirection: 'RECEIVER',
            transactionDirection: 'SENDING_RECEIVING',
            aggregationFieldKey: 'TRANSACTION:transactionId',
            aggregationFunc: 'COUNT',
            timeWindow: {
              start: { units: 30, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            includeCurrentEntity: true,
          },
        ],
      },
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 1 },
        },
      ],
      hitDirections: ['DESTINATION'],
    })
  })

  test('executes the json logic (sender + receiving)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      {
        agg: [
          {
            key: 'agg:123',
            type: 'USER_TRANSACTIONS',
            userDirection: 'SENDER',
            transactionDirection: 'RECEIVING',
            aggregationFieldKey: 'TRANSACTION:transactionId',
            aggregationFunc: 'COUNT',
            timeWindow: {
              start: { units: 30, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            includeCurrentEntity: true,
          },
        ],
      },
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(result).toEqual({
      hit: false,
      vars: [{ direction: 'ORIGIN', value: { 'agg:123': 0 } }],
      hitDirections: [],
    })
  })

  test('executes the json logic (receiver + sending)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      {
        agg: [
          {
            key: 'agg:123',
            type: 'USER_TRANSACTIONS',
            userDirection: 'RECEIVER',
            transactionDirection: 'SENDING',
            aggregationFieldKey: 'TRANSACTION:transactionId',
            aggregationFunc: 'COUNT',
            timeWindow: {
              start: { units: 30, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            includeCurrentEntity: true,
          },
        ],
      },
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(result).toEqual({
      hit: false,
      vars: [{ direction: 'ORIGIN', value: { 'agg:123': 0 } }],
      hitDirections: [],
    })
  })

  test('executes the json logic (filters logic)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const testAggVar = {
      key: 'agg:123',
      type: 'USER_TRANSACTIONS',
      userDirection: 'RECEIVER',
      transactionDirection: 'RECEIVING',
      aggregationFieldKey: 'TRANSACTION:transactionId',
      aggregationFunc: 'COUNT',
      timeWindow: {
        start: { units: 30, granularity: 'day' },
        end: { units: 0, granularity: 'day' },
      },
      includeCurrentEntity: true,
    } as const
    const resultFilteredOut = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      {
        agg: [
          {
            ...testAggVar,
            filtersLogic: {
              and: [{ '==': [{ var: 'TRANSACTION:type' }, 'DEPOSIT'] }],
            },
          },
        ],
      },
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(resultFilteredOut).toEqual({
      hit: false,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 0 },
        },
      ],
      hitDirections: [],
    })
    const resultFiltered = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      {
        agg: [
          {
            ...testAggVar,
            filtersLogic: {
              and: [{ '==': [{ var: 'TRANSACTION:type' }, 'TRANSFER'] }],
            },
          },
        ],
      },
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(resultFiltered).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 1 },
        },
      ],
      hitDirections: ['DESTINATION'],
    })
  })

  test('executes the json logic (filters logic + tx event)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const testAggVar = {
      key: 'agg:123',
      type: 'USER_TRANSACTIONS',
      userDirection: 'RECEIVER',
      transactionDirection: 'RECEIVING',
      aggregationFieldKey: 'TRANSACTION:transactionId',
      aggregationFunc: 'COUNT',
      timeWindow: {
        start: { units: 30, granularity: 'day' },
        end: { units: 0, granularity: 'day' },
      },
      includeCurrentEntity: true,
    } as const
    const resultFilteredOut = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      {
        agg: [
          {
            ...testAggVar,
            filtersLogic: {
              and: [{ '==': [{ var: 'TRANSACTION_EVENT:reason' }, 'reason1'] }],
            },
          },
        ],
      },
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
        transactionEvents: [getTestTransactionEvent({ reason: 'reason2' })],
      }
    )
    expect(resultFilteredOut).toEqual({
      hit: false,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 0 },
        },
      ],
      hitDirections: [],
    })
    const resultFiltered = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      {
        agg: [
          {
            ...testAggVar,
            filtersLogic: {
              and: [{ '==': [{ var: 'TRANSACTION_EVENT:reason' }, 'reason1'] }],
            },
          },
        ],
      },
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
        transactionEvents: [getTestTransactionEvent({ reason: 'reason1' })],
      }
    )
    expect(resultFiltered).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 1 },
        },
      ],
      hitDirections: ['DESTINATION'],
    })
  })

  test('executes the json logic (time window)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const testAggVar = {
      key: 'agg:123',
      type: 'USER_TRANSACTIONS',
      userDirection: 'SENDER',
      transactionDirection: 'SENDING',
      aggregationFieldKey: 'TRANSACTION:transactionId',
      aggregationFunc: 'COUNT',
      includeCurrentEntity: true,
    } as const
    const resultNotWithinTimeWindow = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      {
        agg: [
          {
            ...testAggVar,
            timeWindow: {
              start: { units: 30, granularity: 'day' },
              end: { units: 1, granularity: 'day' },
            },
          },
        ],
      },
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(resultNotWithinTimeWindow).toEqual({
      hit: false,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 0 },
        },
      ],
      hitDirections: [],
    })
    const resultWithinTimeWindow = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 1] }] },
      {
        agg: [
          {
            ...testAggVar,
            timeWindow: {
              start: { units: 30, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
          },
        ],
      },
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(resultWithinTimeWindow).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 1 },
        },
      ],
      hitDirections: ['ORIGIN'],
    })
  })

  test('executes the json logic (object type aggregator)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '>': [{ var: 'agg:123' }, 100] }] },
      {
        agg: [
          {
            key: 'agg:123',
            type: 'USER_TRANSACTIONS',
            userDirection: 'SENDER',
            transactionDirection: 'SENDING',
            aggregationFieldKey:
              'TRANSACTION:originAmountDetails-transactionAmount',
            baseCurrency: 'USD',
            aggregationFunc: 'AVG',
            timeWindow: {
              start: { units: 1, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            includeCurrentEntity: true,
          },
        ],
      },
      { baseCurrency: 'USD', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({
          type: 'TRANSFER',
          originAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'EUR',
          },
        }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 108.24283106705523 },
        },
      ],
      hitDirections: ['ORIGIN'],
    })
  })

  test('aggregation type (user ID)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const logic = { and: [{ '==': [{ var: 'agg:123' }, 1] }] }
    const aggVars = [
      {
        key: 'agg:123',
        type: 'USER_TRANSACTIONS',
        userDirection: 'SENDER',
        transactionDirection: 'SENDING',
        aggregationFieldKey: 'TRANSACTION:transactionId',
        aggregationFunc: 'COUNT',
        timeWindow: {
          start: { units: 30, granularity: 'day' },
          end: { units: 0, granularity: 'day' },
        },
        includeCurrentEntity: true,
      },
    ]
    const data: TransactionLogicData = {
      type: 'TRANSACTION',
      transaction: getTestTransaction({
        type: 'TRANSFER',
        originUserId: 'U-1',
        originPaymentDetails: undefined,
      }),
      transactionEvents: [],
    }
    const result1 = await evaluator.evaluate(
      logic,
      { agg: aggVars },
      { baseCurrency: 'EUR', tenantId },
      data
    )
    expect(result1).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 1 },
        },
      ],
      hitDirections: ['ORIGIN'],
    })
    const result2 = await evaluator.evaluate(
      logic,
      { agg: aggVars },
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({
          ...data.transaction,
          originUserId: undefined,
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '1234',
          },
        }),
      }
    )
    expect(result2).toEqual({
      hit: false,
      vars: [
        {
          direction: 'ORIGIN',
          value: {},
        },
      ],
      hitDirections: [],
    })
  })
  test('aggregation type (payment ID)', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const logic = { and: [{ '==': [{ var: 'agg:123' }, 1] }] }
    const aggVars = [
      {
        key: 'agg:123',
        type: 'PAYMENT_DETAILS_TRANSACTIONS',
        userDirection: 'SENDER',
        transactionDirection: 'SENDING',
        aggregationFieldKey: 'TRANSACTION:transactionId',
        aggregationFunc: 'COUNT',
        timeWindow: {
          start: { units: 30, granularity: 'day' },
          end: { units: 0, granularity: 'day' },
        },
        includeCurrentEntity: true,
      },
    ]
    const data: TransactionLogicData = {
      type: 'TRANSACTION',
      transaction: getTestTransaction({
        type: 'TRANSFER',
        originUserId: undefined,
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '1234',
        },
      }),
      transactionEvents: [],
    }
    const result1 = await evaluator.evaluate(
      logic,
      { agg: aggVars },
      { baseCurrency: 'EUR', tenantId },
      data
    )
    expect(result1).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 1 },
        },
      ],
      hitDirections: ['ORIGIN'],
    })
    const result2 = await evaluator.evaluate(
      logic,
      { agg: aggVars },
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({
          ...data.transaction,
          originUserId: 'U-1',
          originPaymentDetails: undefined,
        }),
      }
    )
    expect(result2).toEqual({
      hit: false,
      vars: [
        {
          direction: 'ORIGIN',
          value: {},
        },
      ],
      hitDirections: [],
    })
  })
})

describe('Dataloder cache', () => {
  test('Testing the aggregation variable cache', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const loadAggregationDataSpy = jest.spyOn(
      evaluator as any,
      'loadAggregationData'
    )
    const testTransaction = getTestTransaction({ type: 'TRANSFER' })

    await evaluator.evaluate(
      {
        and: [
          { '==': [{ var: 'agg:123' }, 1] },
          { '==': [{ var: 'agg:124' }, 1] },
          { '==': [{ var: 'agg:125' }, 1] },
          { '==': [{ var: 'agg:126' }, 1] },
        ],
      },
      {
        agg: [
          {
            key: 'agg:123',
            type: 'USER_TRANSACTIONS',
            userDirection: 'SENDER',
            transactionDirection: 'SENDING',
            aggregationFieldKey: 'TRANSACTION:transactionId',
            aggregationFunc: 'COUNT',
            timeWindow: {
              start: { units: 30, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            includeCurrentEntity: true,
          },
          {
            key: 'agg:124',
            type: 'USER_TRANSACTIONS',
            userDirection: 'SENDER',
            transactionDirection: 'SENDING',
            aggregationFieldKey: 'TRANSACTION:transactionId',
            aggregationFunc: 'COUNT',
            timeWindow: {
              start: { units: 30, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            includeCurrentEntity: true,
          },
          {
            key: 'agg:125',
            type: 'USER_TRANSACTIONS',
            userDirection: 'SENDER',
            transactionDirection: 'SENDING',
            aggregationFieldKey: 'TRANSACTION:transactionId',
            aggregationFunc: 'COUNT',
            timeWindow: {
              start: { units: 30, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            includeCurrentEntity: true,
          },
          {
            key: 'agg:126',
            type: 'USER_TRANSACTIONS',
            userDirection: 'SENDER',
            transactionDirection: 'SENDING',
            aggregationFieldKey:
              'TRANSACTION:originAmountDetails-transactionAmount',
            aggregationFunc: 'SUM',
            baseCurrency: 'EUR',
            timeWindow: {
              start: { units: 30, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            includeCurrentEntity: true,
          },
        ],
      },
      { baseCurrency: 'EUR', tenantId },
      { type: 'TRANSACTION', transaction: testTransaction }
    )
    await evaluator.evaluate(
      {
        and: [
          { '==': [{ var: 'agg:123' }, 1] },
          { '==': [{ var: 'agg:124' }, 1] },
          { '==': [{ var: 'agg:126' }, 1] },
        ],
      },
      {
        agg: [
          {
            key: 'agg:123',
            type: 'USER_TRANSACTIONS',
            userDirection: 'SENDER',
            transactionDirection: 'SENDING',
            aggregationFieldKey: 'TRANSACTION:transactionId',
            aggregationFunc: 'COUNT',
            timeWindow: {
              start: { units: 30, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            includeCurrentEntity: true,
          },
          {
            key: 'agg:124',
            type: 'USER_TRANSACTIONS',
            userDirection: 'SENDER',
            transactionDirection: 'SENDING',
            aggregationFieldKey: 'TRANSACTION:transactionId',
            aggregationFunc: 'COUNT',
            timeWindow: {
              start: { units: 30, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            includeCurrentEntity: true,
          },
          {
            key: 'agg:126',
            type: 'USER_TRANSACTIONS',
            userDirection: 'SENDER',
            transactionDirection: 'SENDING',
            aggregationFieldKey:
              'TRANSACTION:originAmountDetails-transactionAmount',
            aggregationFunc: 'SUM',
            baseCurrency: 'EUR',
            timeWindow: {
              start: { units: 30, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            includeCurrentEntity: true,
          },
        ],
      },
      { baseCurrency: 'EUR', tenantId },
      { type: 'TRANSACTION', transaction: testTransaction }
    )
    /** Validating if the cache is called twice as we have two distinct aggregationFunc (COUNT & SUM) accross two evaluate calls */
    expect(loadAggregationDataSpy).toHaveBeenCalledTimes(2)
  })
})

describe('Different aggregate fields for receiving and sending', () => {
  test('testing different aggregationFieldKey based on direction', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    const result = await evaluator.evaluate(
      { and: [{ '==': [{ var: 'agg:123' }, 100] }] },
      {
        agg: [
          {
            key: 'agg:123',
            type: 'USER_TRANSACTIONS',
            userDirection: 'SENDER_OR_RECEIVER',
            transactionDirection: 'SENDING_RECEIVING',
            aggregationFieldKey:
              'TRANSACTION:originAmountDetails-transactionAmount',
            secondaryAggregationFieldKey:
              'TRANSACTION:destinationAmountDetails-transactionAmount',
            aggregationFunc: 'AVG',
            timeWindow: {
              start: { units: 30, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            baseCurrency: 'EUR',
            includeCurrentEntity: true,
          },
        ],
      },
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({
          originAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'EUR',
          },
          destinationAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'EUR',
          },
        }),
      }
    )
    expect(result).toEqual({
      hit: true,
      vars: [
        {
          direction: 'ORIGIN',
          value: { 'agg:123': 100 },
        },
        {
          direction: 'DESTINATION',
          value: { 'agg:123': 100 },
        },
      ],
      hitDirections: ['ORIGIN', 'DESTINATION'],
    })
  })
})

describe('Test canAggregate function', () => {
  test('canAggregate function tests', () => {
    const variable1 = createAggregationVariable({
      timeWindow: {
        start: { units: 30, granularity: 'day' },
        end: { units: 0, granularity: 'day' },
      },
    })
    expect(canAggregate(variable1.timeWindow)).toBe(true)

    const variable2 = createAggregationVariable({
      timeWindow: {
        start: { units: 1, granularity: 'hour' },
        end: { units: 0, granularity: 'hour' },
      },
    })
    expect(canAggregate(variable2.timeWindow)).toBe(true)

    const variable3 = createAggregationVariable({
      timeWindow: {
        start: { units: 0, granularity: 'all_time' },
        end: { units: 0, granularity: 'now' },
      },
    })
    expect(canAggregate(variable3.timeWindow)).toBe(true)

    const variable4 = createAggregationVariable({
      timeWindow: {
        start: { units: 20, granularity: 'minute' },
        end: { units: 0, granularity: 'now' },
      },
    })
    expect(canAggregate(variable4.timeWindow)).toBe(true)

    const variable5 = createAggregationVariable({
      timeWindow: {
        start: { units: 9, granularity: 'minute' },
        end: { units: 0, granularity: 'now' },
      },
    })
    expect(canAggregate(variable5.timeWindow)).toBe(false)

    const variable6 = createAggregationVariable({
      timeWindow: {
        start: { units: 15, granularity: 'minute' },
        end: { units: 0, granularity: 'now' },
      },
    })
    expect(canAggregate(variable6.timeWindow)).toBe(true)

    const variable7 = createAggregationVariable({
      timeWindow: {
        start: { units: 30, granularity: 'minute' },
        end: { units: 10, granularity: 'minute' },
      },
    })
    expect(canAggregate(variable7.timeWindow)).toBe(true)

    const variable8 = createAggregationVariable({
      timeWindow: {
        start: { units: 15, granularity: 'minute' },
        end: { units: 10, granularity: 'minute' },
      },
    })
    expect(canAggregate(variable8.timeWindow)).toBe(false)
  })
})

describe('operators', () => {
  let operatorSpy: jest.SpyInstance
  beforeEach(() => {
    operatorSpy = jest.spyOn(STARTS_WITH_OPERATOR, 'run')
  })
  afterEach(() => {
    operatorSpy.mockRestore()
  })
  test('be called multiple times for different lhs/rhs values', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    await evaluator.evaluate(
      { and: [{ 'op:startswith': ['a', ['b']] }] },
      {},
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    await evaluator.evaluate(
      { and: [{ 'op:startswith': ['b', ['b']] }] },
      {},
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(operatorSpy).toHaveBeenCalledTimes(2)
  })
  test('be called once for the same lhs/rhs values', async () => {
    const tenantId = 'tenant-id'
    const dynamoDbClient = getDynamoDbClient()
    const evaluator = new LogicEvaluator(tenantId, dynamoDbClient)
    await evaluator.evaluate(
      { and: [{ 'op:startswith': ['a', ['b']] }] },
      {},
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    await evaluator.evaluate(
      { and: [{ 'op:startswith': ['a', ['b']] }] },
      {},
      { baseCurrency: 'EUR', tenantId },
      {
        type: 'TRANSACTION',
        transaction: getTestTransaction({ type: 'TRANSFER' }),
      }
    )
    expect(operatorSpy).toHaveBeenCalledTimes(1)
  })
})

describe('SAR details', () => {
  withFeatureHook(['SAR'])
  test('SAR details hit', async () => {
    const tenantId = getTestTenantId()
    const mongoDb = await getMongoDbClient()
    const reportRepository = new ReportRepository(
      tenantId,
      mongoDb,
      getDynamoDbClient()
    )
    await reportRepository.addOrUpdateSarItemsInDynamo('U-1', {
      reportId: '1',
      status: 'SUBMISSION_SUCCESSFUL',
      region: 'US',
    })
    const user = getTestUser({
      userId: 'U-1',
    })
    const evaluator = new LogicEvaluator(tenantId, getDynamoDbClient())
    const result = await evaluator.evaluate(
      {
        and: [
          {
            some: [
              {
                var: 'USER:sarDetails__SENDER',
              },
              {
                and: [
                  {
                    '==': [
                      {
                        var: 'region',
                      },
                      'US',
                    ],
                  },
                  {
                    '==': [
                      {
                        var: 'status',
                      },
                      'SUBMISSION_SUCCESSFUL',
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {},
      {
        tenantId,
        baseCurrency: 'EUR',
      },
      {
        type: 'USER',
        user,
      }
    )
    expect(result).toEqual({
      hit: true,
      hitDirections: ['ORIGIN'],
      vars: [
        {
          direction: 'ORIGIN',
          value: {
            'USER:sarDetails__SENDER': {
              region: ['US'],
              status: ['SUBMISSION_SUCCESSFUL'],
            },
          },
        },
      ],
    })
  })
})

describe('V8 aggregator', () => {
  const getAggVar = (
    aggregationFieldKey: string,
    aggregationFunc: string,
    granularity: string,
    aggregationGroupByFieldKey?: string,
    type?:
      | 'USER_TRANSACTIONS'
      | 'PAYMENT_DETAILS_TRANSACTIONS'
      | 'PAYMENT_DETAILS_ADDRESS'
      | 'PAYMENT_DETAILS_EMAIL'
      | 'PAYMENT_DETAILS_NAME'
  ) => {
    return {
      aggregationFieldKey,
      aggregationGroupByFieldKey,
      aggregationFunc,
      timeWindow: {
        start: {
          granularity: granularity,
          units: granularity === 'minute' ? 40 : 4,
        },
        end: { granularity: 'now', units: 0 },
      },
      userDirection: 'SENDER',
      type: type || 'USER_TRANSACTIONS',
      transactionDirection: 'SENDING',
      version: dayjs().valueOf(),
      key: `agg:${uuidv4()}`,
    } as LogicAggregationVariable
  }

  test('Should rebuild the aggregation data for the user for granularity day - checks count', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2023-01-03T12:00:10.000Z').valueOf()
    const AGG_VARIABLE = getAggVar('TRANSACTION:transactionId', 'COUNT', 'day')
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 200,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-01-02T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 300,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-01-03T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 400,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)
    await logicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '1',
      undefined
    )

    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserLogicTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'day'
    )
    expect(aggData).toEqual([
      { time: '2023-01-01', value: 1 },
      { time: '2023-01-02', value: 1 },
      { time: '2023-01-03', value: 2 },
    ])
  })

  test('Should rebuild the aggregation data for the user for granularity month - checks count', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2023-03-01T12:00:10.000Z').valueOf()
    const AGG_VARIABLE = getAggVar(
      'TRANSACTION:transactionId',
      'COUNT',
      'month'
    )
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-02-01T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 2000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 3000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-03-01T12:00:00.000Z').valueOf(),
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)
    await logicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '1',
      undefined
    )
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserLogicTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'month'
    )
    expect(aggData).toEqual([
      { time: '2023-01', value: 1 },
      { time: '2023-02', value: 1 },
      { time: '2023-03', value: 2 },
    ])
  })

  test('Should rebuild the aggregation data for the user for granularity year - checks count', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2025-01-01T12:00:10.000Z').valueOf()
    const AGG_VARIABLE = getAggVar('TRANSACTION:transactionId', 'COUNT', 'year')
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2024-01-01T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 2000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 3000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2025-01-01T12:00:00.000Z').valueOf(),
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)
    await logicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '1',
      undefined
    )
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserLogicTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'year'
    )
    expect(aggData).toEqual([
      { time: '2023', value: 1 },
      { time: '2024', value: 1 },
      { time: '2025', value: 2 },
    ])
  })

  test('Should rebuild the aggregation data for Address', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const AGG_VARIABLE = getAggVar(
      'TRANSACTION:destinationUserId',
      'COUNT',
      'day',
      undefined,
      'PAYMENT_DETAILS_ADDRESS'
    )

    const getAddress = (address?: Partial<Address>): Address => {
      return {
        ...address,
        addressLines: ['100 Dest Way'],
        city: 'Dest City',
        state: 'Dest State',
        postcode: '12345',
        country: 'US',
      }
    }
    const transactions = [
      getTestTransaction({
        originUserId: 'O-1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: 'D-1',
        destinationPaymentDetails: {
          method: 'CARD',
          cardFingerprint: 'D-1',
          address: getAddress(),
        },
        timestamp: dayjs('2023-01-01T11:01:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: 'O-2',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: 'D-2',
        destinationPaymentDetails: {
          method: 'CARD',
          cardFingerprint: 'D-2',
          address: getAddress(),
        },
        timestamp: dayjs('2023-01-01T11:02:00.000Z').valueOf(),
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)

    await logicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      dayjs('2023-01-01T11:01:00.000Z').valueOf(),
      undefined,
      undefined,
      {
        type: 'ADDRESS',
        value: getAddressStringForAggregation(getAddress()),
      }
    )
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserLogicTimeAggregations(
      getAddressStringForAggregation(getAddress()) || '',
      AGG_VARIABLE,
      dayjs('2023-01-01T11:00:00.000Z').valueOf(),
      dayjs('2023-01-01T12:00:00.000Z').valueOf(),
      'day'
    )
    expect(aggData).toEqual([{ time: '2023-01-01', value: 2 }])
  })

  test('Should rebuild the aggregation data for the user for granularity hour - checks count', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2023-01-01T14:00:10.000Z').valueOf()
    const AGG_VARIABLE = getAggVar('TRANSACTION:transactionId', 'COUNT', 'hour')
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-01-01T13:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 2000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 3000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-01-01T14:00:00.000Z').valueOf(),
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)

    await logicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '1',
      undefined
    )
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserLogicTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'hour'
    )
    expect(aggData).toEqual([
      { time: '2023-01-01-12', value: 1 },
      { time: '2023-01-01-13', value: 1 },
      { time: '2023-01-01-14', value: 2 },
    ])
  })

  test('Should rebuild the aggregation data for the user for granularity minute - checks count', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2023-01-01T12:30:10.000Z').valueOf()
    const AGG_VARIABLE = getAggVar(
      'TRANSACTION:transactionId',
      'COUNT',
      'minute'
    )
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-01-01T12:05:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 2000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 3000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-01-01T12:25:00.000Z').valueOf(),
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)

    await logicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '1',
      undefined
    )
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserLogicTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'minute'
    )
    expect(aggData).toEqual([
      { time: '2023-01-01-12-0', value: 2 },
      { time: '2023-01-01-12-2', value: 1 },
      { time: '2023-01-01-12-3', value: 1 },
    ])
  })

  test('Should rebuild the aggregation data for the user for granularity day - checks unique count', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2023-01-02T12:00:10.000Z').valueOf()
    const AGG_VARIABLE = getAggVar(
      'TRANSACTION:originUserId',
      'UNIQUE_COUNT',
      'day'
    )
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '1',
        destinationAmountDetails: {
          transactionAmount: 200,
          transactionCurrency: 'EUR',
        },
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
      getTestTransaction({
        originUserId: '2',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)

    await logicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '1',
      undefined
    )
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserLogicTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'day'
    )
    expect(aggData).toEqual([
      { time: '2023-01-01', value: ['1'] },
      { time: '2023-01-02', value: ['1'] },
    ])
    await logicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '2',
      undefined
    )
    const aggData2 = await aggregationRepository.getUserLogicTimeAggregations(
      '2',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'day'
    )
    expect(aggData2).toEqual([{ time: '2023-01-02', value: ['2'] }])
  })
  test('Should rebuild the aggregation data for the user for granularity month - checks unique count', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2023-03-01T12:00:10.000Z').valueOf()
    const AGG_VARIABLE = getAggVar(
      'TRANSACTION:originUserId',
      'UNIQUE_COUNT',
      'month'
    )
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '1',
        destinationAmountDetails: {
          transactionAmount: 200,
          transactionCurrency: 'EUR',
        },
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-02-01T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '2',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)

    await logicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '1',
      undefined
    )
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserLogicTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'month'
    )
    expect(aggData).toEqual([
      { time: '2023-01', value: ['1'] },
      { time: '2023-02', value: ['1'] },
    ])
    await logicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '2',
      undefined
    )
    const aggData2 = await aggregationRepository.getUserLogicTimeAggregations(
      '2',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'month'
    )
    expect(aggData2).toEqual([{ time: '2023-03', value: ['2'] }])
  })
  test('Should rebuild the aggregation data for the user for granularity year - checks unique count', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2025-01-01T12:00:10.000Z').valueOf()
    const AGG_VARIABLE = getAggVar(
      'TRANSACTION:originUserId',
      'UNIQUE_COUNT',
      'year'
    )
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '1',
        destinationAmountDetails: {
          transactionAmount: 200,
          transactionCurrency: 'EUR',
        },
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2024-01-01T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '2',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)

    await logicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '1',
      undefined
    )
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserLogicTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'year'
    )
    expect(aggData).toEqual([
      { time: '2023', value: ['1'] },
      { time: '2024', value: ['1'] },
    ])
    await logicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '2',
      undefined
    )
    const aggData2 = await aggregationRepository.getUserLogicTimeAggregations(
      '2',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'year'
    )
    expect(aggData2).toEqual([{ time: '2025', value: ['2'] }])
  })

  test('Should rebuild the aggregation data for the user for granularity hour - checks unique count', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2023-01-01T14:00:10.000Z').valueOf()
    const AGG_VARIABLE = getAggVar(
      'TRANSACTION:originUserId',
      'UNIQUE_COUNT',
      'hour'
    )
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '1',
        destinationAmountDetails: {
          transactionAmount: 200,
          transactionCurrency: 'EUR',
        },
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-01-01T13:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '2',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)

    await logicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '1',
      undefined
    )
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserLogicTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'hour'
    )
    expect(aggData).toEqual([
      { time: '2023-01-01-12', value: ['1'] },
      { time: '2023-01-01-13', value: ['1'] },
    ])
    await logicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '2',
      undefined
    )
    const aggData2 = await aggregationRepository.getUserLogicTimeAggregations(
      '2',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'hour'
    )
    expect(aggData2).toEqual([{ time: '2023-01-01-14', value: ['2'] }])
  })

  test('Should rebuild the aggregation data for the user for granularity minute - checks unique count', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2023-01-01T12:30:10.000Z').valueOf()
    const AGG_VARIABLE = getAggVar(
      'TRANSACTION:originUserId',
      'UNIQUE_COUNT',
      'minute'
    )
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '1',
        destinationAmountDetails: {
          transactionAmount: 200,
          transactionCurrency: 'EUR',
        },
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-01-01T12:12:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '2',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)

    await logicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '1',
      undefined
    )
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserLogicTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'minute'
    )
    expect(aggData).toEqual([
      { time: '2023-01-01-12-0', value: ['1'] },
      { time: '2023-01-01-12-1', value: ['1'] },
    ])
    await logicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '2',
      undefined
    )
    const aggData2 = await aggregationRepository.getUserLogicTimeAggregations(
      '2',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'minute'
    )
    expect(aggData2).toEqual([{ time: '2023-01-01-12-3', value: ['2'] }])
  })

  test('Should rebuild the aggregation data for the user - group by', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const AGG_VARIABLE = getAggVar(
      'TRANSACTION:transactionId',
      'COUNT',
      'day',
      'TRANSACTION:destinationUserId'
    )
    const transactions = [
      getTestTransaction({
        originUserId: '0',
        destinationUserId: 'U-1',
        timestamp: dayjs('2023-01-01T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-1',
        timestamp: dayjs('2023-01-01T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-2',
        timestamp: dayjs('2023-01-01T13:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-1',
        timestamp: dayjs('2023-01-01T14:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-1',
        timestamp: dayjs('2023-01-02T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-2',
        timestamp: dayjs('2023-01-02T13:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-3',
        timestamp: dayjs('2023-01-03T12:00:00.000Z').valueOf(),
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)
    await logicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      dayjs('2023-01-03T15:00:00.000Z').valueOf(),
      '1',
      undefined
    )

    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData1 = await aggregationRepository.getUserLogicTimeAggregations(
      '1',
      AGG_VARIABLE,
      dayjs('2023-01-01T12:00:00.000Z').valueOf(),
      dayjs('2023-01-03T15:00:00.000Z').valueOf(),
      'day',
      'U-1'
    )
    expect(aggData1).toEqual([
      { time: '2023-01-01', value: 2 },
      { time: '2023-01-02', value: 1 },
    ])
    const aggData2 = await aggregationRepository.getUserLogicTimeAggregations(
      '1',
      AGG_VARIABLE,
      dayjs('2023-01-01T12:00:00.000Z').valueOf(),
      dayjs('2023-01-03T15:00:00.000Z').valueOf(),
      'day',
      'U-2'
    )
    expect(aggData2).toEqual([
      { time: '2023-01-01', value: 1 },
      { time: '2023-01-02', value: 1 },
    ])
  })
  test('Skip updating a transaction if it was applied during the last aggregation rebuild', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2023-01-01T14:00:10.000Z').valueOf()
    const AGG_VARIABLE = getAggVar('TRANSACTION:originUserId', 'COUNT', 'hour')
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)

    await logicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '1',
      undefined
    )
    await logicEvaluator.updateAggregationVariable(
      AGG_VARIABLE,
      {
        transaction: transactions[0],
        type: 'TRANSACTION',
        senderUser: getTestUser({ userId: '1' }),
      },
      'origin'
    )
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserLogicTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'hour'
    )
    expect(aggData).toEqual([{ time: '2023-01-01-12', value: 1 }])
  })
})

describe('Aggregation variable with user filter tests', () => {
  const tenantId = getTestTenantId()
  setUpUsersHooks(tenantId, [
    getTestUser({ userId: '1' }),
    getTestUser({ userId: '2' }),
    getTestUser({ userId: '3' }),
  ])
  test('Should rebuild the aggregation data for aggregation variable having user filters', async () => {
    const aggregationVariable = {
      key: 'agg:123',
      type: 'USER_TRANSACTIONS',
      userDirection: 'SENDER',
      transactionDirection: 'SENDING',
      aggregationFieldKey: 'TRANSACTION:transactionId',
      aggregationFunc: 'COUNT',
      timeWindow: {
        start: { units: 30, granularity: 'day' },
        end: { units: 0, granularity: 'day' },
      },
      includeCurrentEntity: true,
      filtersLogic: {
        and: [{ '==': [{ var: 'CONSUMER_USER:userId__BOTH' }, '2'] }],
      },
    } as LogicAggregationVariable

    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2023-01-03T12:00:10.000Z').valueOf()
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        destinationUserId: '2',
        timestamp: dayjs('2023-01-01T12:30:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: '3',
        timestamp: dayjs('2023-01-02T12:30:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: '2',
        timestamp: dayjs('2023-01-02T13:30:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: '2',
        timestamp: dayjs('2023-01-02T14:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '2',
        destinationUserId: '1',
        timestamp: dayjs('2023-01-02T15:00:00.000Z').valueOf(),
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)
    const userGetterSpy = jest.spyOn(UserRepository.prototype, 'getUser')
    await logicEvaluator.rebuildAggregationVariable(
      aggregationVariable,
      beforeTimestamp + 1,
      '1',
      undefined
    )
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserLogicTimeAggregations(
      '1',
      aggregationVariable,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'day'
    )
    expect(aggData).toEqual([
      { time: '2023-01-01', value: 1 },
      { time: '2023-01-02', value: 2 },
    ])
    expect(userGetterSpy).toBeCalledTimes(3)
  })
})

describe('V8 aggregator with transaction count', () => {
  const getAggVar = (
    aggregationFieldKey: string,
    aggregationFunc: string,
    granularity: string,
    aggregationGroupByFieldKey?: string,
    transactionCount?: number
  ) => {
    return {
      aggregationFieldKey,
      aggregationGroupByFieldKey,
      aggregationFunc,
      timeWindow: {
        start: {
          granularity: granularity,
          units: granularity === 'minute' ? 40 : 4,
        },
        end: { granularity: 'now', units: 0 },
      },
      userDirection: 'SENDER',
      type: 'USER_TRANSACTIONS',
      transactionDirection: 'SENDING',
      version: dayjs().valueOf(),
      key: `agg:${uuidv4()}`,
      lastNEntities: transactionCount,
    } as LogicAggregationVariable
  }
  test('Should update the aggregation data for the user for granularity day for last 3 transactions - checks count', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const user = getTestUser({ userId: '1' })
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2023-01-03T12:00:00.000Z').valueOf()
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const AGG_VARIABLE = getAggVar(
      'TRANSACTION:transactionId',
      'COUNT',
      'day',
      undefined,
      3
    )
    await aggregationRepository.setAggregationVariableReady(
      AGG_VARIABLE,
      '1',
      afterTimestamp
    )
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 200,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-01-02T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 300,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 400,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-01-03T12:00:01.000Z').valueOf(),
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)
    for (const transaction of transactions) {
      await logicEvaluator.updateAggregationVariable(
        AGG_VARIABLE,
        {
          transaction,
          type: 'TRANSACTION',
          senderUser: user,
        },
        'origin'
      )
    }
    const aggData = await aggregationRepository.getUserLogicTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'day'
    )

    expect(aggData).toEqual([
      { time: '2023-01-02', value: 1, entities: expect.any(Array) },
      { time: '2023-01-03', value: 2, entities: expect.any(Array) },
    ])
    aggData?.forEach((agg) => {
      expect(agg?.entities?.length ?? 0).toBe(agg.value)
    })
  })

  test('Should update the aggregation data for the user for granularity day for last 2 transactions- checks count', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const user = getTestUser({ userId: '1' })
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2023-01-03T12:00:00.000Z').valueOf()
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const AGG_VARIABLE = getAggVar(
      'TRANSACTION:transactionId',
      'COUNT',
      'day',
      undefined,
      2
    )
    await aggregationRepository.setAggregationVariableReady(
      AGG_VARIABLE,
      '1',
      afterTimestamp
    )
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 200,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-01-02T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 300,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 400,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-01-03T11:00:01.000Z').valueOf(),
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)
    for (const transaction of transactions) {
      await logicEvaluator.updateAggregationVariable(
        AGG_VARIABLE,
        {
          transaction,
          type: 'TRANSACTION',
          senderUser: user,
        },
        'origin'
      )
    }
    const aggData = await aggregationRepository.getUserLogicTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'day'
    )

    expect(aggData).toEqual([
      { time: '2023-01-03', value: 2, entities: expect.any(Array) },
    ])
    aggData?.forEach((agg) => {
      expect(agg?.entities?.length ?? 0).toBe(agg.value)
    })
  })

  test('Should rebuild the aggregation data for the user for granularity day for last 2 transactions- checks unique count', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const afterTimestamp = dayjs('2023-01-01T12:00:00.000Z').valueOf()
    const beforeTimestamp = dayjs('2023-01-02T12:00:10.000Z').valueOf()
    const AGG_VARIABLE = getAggVar(
      'TRANSACTION:originUserId',
      'UNIQUE_COUNT',
      'day',
      undefined,
      2
    )
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '1',
        destinationAmountDetails: {
          transactionAmount: 200,
          transactionCurrency: 'EUR',
        },
        timestamp: afterTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-01-02T12:00:09.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '2',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: beforeTimestamp,
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)

    await logicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '1',
      undefined
    )
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData = await aggregationRepository.getUserLogicTimeAggregations(
      '1',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'day'
    )
    expect(aggData).toEqual([
      { time: '2023-01-02', value: ['1'], entities: expect.any(Array) },
    ])
    await logicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      beforeTimestamp + 1,
      '2',
      undefined
    )
    const aggData2 = await aggregationRepository.getUserLogicTimeAggregations(
      '2',
      AGG_VARIABLE,
      afterTimestamp - 1,
      beforeTimestamp + 1,
      'day'
    )
    expect(aggData2).toEqual([
      { time: '2023-01-02', value: ['2'], entities: expect.any(Array) },
    ])
  })

  test('Should rebuild the aggregation data for the user by transactions count - group by', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const AGG_VARIABLE = getAggVar(
      'TRANSACTION:transactionId',
      'COUNT',
      'day',
      'TRANSACTION:destinationUserId',
      2
    )
    const transactions = [
      getTestTransaction({
        originUserId: '0',
        destinationUserId: 'U-1',
        timestamp: dayjs('2023-01-01T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-1',
        timestamp: dayjs('2023-01-01T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-2',
        timestamp: dayjs('2023-01-01T13:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-1',
        timestamp: dayjs('2023-01-01T14:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-1',
        timestamp: dayjs('2023-01-02T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-2',
        timestamp: dayjs('2023-01-02T13:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-3',
        timestamp: dayjs('2023-01-03T12:00:00.000Z').valueOf(),
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)
    await logicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      dayjs('2023-01-03T15:00:00.000Z').valueOf(),
      '1',
      undefined
    )

    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const aggData1 = await aggregationRepository.getUserLogicTimeAggregations(
      '1',
      AGG_VARIABLE,
      dayjs('2023-01-01T12:00:00.000Z').valueOf(),
      dayjs('2023-01-03T15:00:00.000Z').valueOf(),
      'day',
      'U-1'
    )
    expect(aggData1).toEqual([
      { time: '2023-01-01', value: 1, entities: expect.any(Array) },
      { time: '2023-01-02', value: 1, entities: expect.any(Array) },
    ])
    aggData1?.forEach((agg) => {
      expect(agg?.entities?.length ?? 0).toBe(agg.value)
    })
    const aggData2 = await aggregationRepository.getUserLogicTimeAggregations(
      '1',
      AGG_VARIABLE,
      dayjs('2023-01-01T12:00:00.000Z').valueOf(),
      dayjs('2023-01-03T15:00:00.000Z').valueOf(),
      'day',
      'U-2'
    )
    expect(aggData2).toEqual([
      { time: '2023-01-01', value: 1, entities: expect.any(Array) },
      { time: '2023-01-02', value: 1, entities: expect.any(Array) },
    ])
    aggData2?.forEach((agg) => {
      expect(agg?.entities?.length ?? 0).toBe(agg.value)
    })
  })
  test('Should update the aggregation data for the user with transactions count - group by', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const AGG_VARIABLE = getAggVar(
      'TRANSACTION:transactionId',
      'COUNT',
      'day',
      'TRANSACTION:destinationUserId',
      2
    )
    await aggregationRepository.setAggregationVariableReady(
      AGG_VARIABLE,
      '1',
      0
    )
    const transactions = [
      getTestTransaction({
        originUserId: '0',
        destinationUserId: 'U-1',
        timestamp: dayjs('2023-01-01T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-1',
        timestamp: dayjs('2023-01-01T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-2',
        timestamp: dayjs('2023-01-01T13:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-1',
        timestamp: dayjs('2023-01-01T14:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-1',
        timestamp: dayjs('2023-01-02T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-2',
        timestamp: dayjs('2023-01-02T13:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-2',
        timestamp: dayjs('2023-01-03T12:00:00.000Z').valueOf(),
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)

    for (const transaction of transactions) {
      await logicEvaluator.updateAggregationVariable(
        AGG_VARIABLE,
        {
          transaction,
          type: 'TRANSACTION',
        },
        'origin'
      )
    }
    const aggData1 = await aggregationRepository.getUserLogicTimeAggregations(
      '1',
      AGG_VARIABLE,
      dayjs('2023-01-01T12:00:00.000Z').valueOf(),
      dayjs('2023-01-03T15:00:00.000Z').valueOf(),
      'day',
      'U-1'
    )

    expect(aggData1).toEqual([
      { time: '2023-01-01', value: 1, entities: expect.any(Array) },
      { time: '2023-01-02', value: 1, entities: expect.any(Array) },
    ])
    const aggData2 = await aggregationRepository.getUserLogicTimeAggregations(
      '1',
      AGG_VARIABLE,
      dayjs('2023-01-01T12:00:00.000Z').valueOf(),
      dayjs('2023-01-03T15:00:00.000Z').valueOf(),
      'day',
      'U-2'
    )
    aggData1?.forEach((agg) => {
      expect(agg?.entities?.length ?? 0).toBe(agg.value)
    })
    expect(aggData2).toEqual([
      { time: '2023-01-02', value: 1, entities: expect.any(Array) },
      { time: '2023-01-03', value: 1, entities: expect.any(Array) },
    ])
    aggData2?.forEach((agg) => {
      expect(agg?.entities?.length ?? 0).toBe(agg.value)
    })
  })
})

describe('V8 aggregator for array of objects', () => {
  test('Should update the aggregation data for tags', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const ruleJsonLogicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const AGG_VARIABLE: LogicAggregationVariable = {
      aggregationFieldKey: 'TRANSACTION:tags',
      aggregationFunc: 'UNIQUE_VALUES',
      timeWindow: {
        start: {
          granularity: 'day',
          units: 4,
        },
        end: {
          granularity: 'now',
          units: 0,
        },
      },
      key: 'agg:1',
      type: 'USER_TRANSACTIONS',
      userDirection: 'SENDER',
      transactionDirection: 'SENDING',
      version: dayjs().valueOf(),
      includeCurrentEntity: true,
      aggregationFilterFieldValue: 'tag-1',
      aggregationFilterFieldKey: 'key',
    }
    await aggregationRepository.setAggregationVariableReady(
      AGG_VARIABLE,
      '1',
      0
    )
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-1',
        timestamp: dayjs('2023-01-01T12:00:00.000Z').valueOf(),
        tags: [
          {
            key: 'tag-1',
            value: 'value-1a',
          },
          {
            key: 'tag-2',
            value: 'value-2',
          },
        ],
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-1',
        timestamp: dayjs('2023-01-01T12:00:00.000Z').valueOf(),
        tags: [
          {
            key: 'tag-1',
            value: 'value-1b',
          },
          {
            key: 'tag-3',
            value: 'value-3',
          },
        ],
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-1',
        timestamp: dayjs('2023-01-01T12:00:00.000Z').valueOf(),
        tags: [
          {
            key: 'tag-1',
            value: 'value-1b',
          },
          {
            key: 'tag-2',
            value: 'value-2',
          },
          {
            key: 'tag-4',
            value: 'value-4',
          },
        ],
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)
    for (const transaction of transactions) {
      await ruleJsonLogicEvaluator.updateAggregationVariable(
        AGG_VARIABLE,
        {
          transaction,
          type: 'TRANSACTION',
        },
        'origin'
      )
    }
    const aggData = await aggregationRepository.getUserLogicTimeAggregations(
      '1',
      AGG_VARIABLE,
      dayjs('2023-01-01T12:00:00.000Z').valueOf(),
      dayjs('2023-01-03T15:00:00.000Z').valueOf(),
      'day'
    )
    expect(aggData).toEqual([
      {
        time: '2023-01-01',
        value: expect.arrayContaining(['value-1a', 'value-1b']),
        entities: undefined,
      },
    ])
  })
  test('Should rebuild the aggregation data for tags', async () => {
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const ruleJsonLogicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
    const AGG_VARIABLE: LogicAggregationVariable = {
      aggregationFieldKey: 'TRANSACTION:tags',
      aggregationFunc: 'UNIQUE_VALUES',
      timeWindow: {
        start: {
          granularity: 'day',
          units: 4,
        },
        end: { granularity: 'now', units: 0 },
      },
      key: 'agg:1',
      type: 'USER_TRANSACTIONS',
      userDirection: 'SENDER',
      transactionDirection: 'SENDING',
      version: 1,
      includeCurrentEntity: true,
      aggregationFilterFieldValue: 'tag-1',
      aggregationFilterFieldKey: 'key',
    }

    const transactions = [
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-1',
        timestamp: dayjs('2023-01-01T12:00:00.000Z').valueOf(),
        tags: [
          {
            key: 'tag-1',
            value: 'value-1a',
          },
          {
            key: 'tag-2',
            value: 'value-2',
          },
        ],
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-1',
        timestamp: dayjs('2023-01-01T12:00:00.000Z').valueOf(),
        tags: [
          {
            key: 'tag-1',
            value: 'value-1b',
          },
          {
            key: 'tag-3',
            value: 'value-3',
          },
        ],
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-1',
        timestamp: dayjs('2023-01-01T12:00:00.000Z').valueOf(),
        tags: [
          {
            key: 'tag-1',
            value: 'value-1b',
          },
          {
            key: 'tag-2',
            value: 'value-2',
          },
          {
            key: 'tag-4',
            value: 'value-4',
          },
        ],
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: 'U-1',
        timestamp: dayjs('2023-01-01T12:00:00.000Z').valueOf(),
        tags: [
          {
            key: 'tag-2',
            value: 'value-2',
          },
          {
            key: 'tag-4',
            value: 'value-4',
          },
        ],
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)
    await ruleJsonLogicEvaluator.rebuildAggregationVariable(
      AGG_VARIABLE,
      dayjs('2023-01-01T15:00:00.000Z').valueOf() + 1000,
      '1',
      undefined
    )
    const aggData = await aggregationRepository.getUserLogicTimeAggregations(
      '1',
      AGG_VARIABLE,
      dayjs('2023-01-01T00:00:00.000Z').valueOf(),
      dayjs('2023-01-01T15:00:00.000Z').valueOf(),
      'day'
    )
    expect(aggData).toEqual([
      {
        time: '2023-01-01',
        value: expect.arrayContaining(['value-1b', 'value-1a']),
      },
    ])
  })
})
