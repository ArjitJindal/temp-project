import { UserManagementService } from '../user-rules-engine-service'
import { RulesEngineService } from '../rules-engine-service'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { withLocalChangeHandler } from '@/utils/local-change-handler'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getTestBusiness, getTestUser } from '@/test-utils/user-test-utils'
import { setUpRulesHooks } from '@/test-utils/rule-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { TenantService } from '@/services/tenants'
import {
  getTestRiskFactor,
  setUpRiskFactorsHook,
} from '@/test-utils/pulse-test-utils'
import {
  getTestBusinessEvent,
  getTestUserEvent,
} from '@/test-utils/user-event-test-utils'
import { pickKnownEntityFields } from '@/utils/object'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'

const dynamoDb = getDynamoDbClient()
const TEST_TENANT_ID = getTestTenantId()
dynamoDbSetupHook()
withLocalChangeHandler()
describe('Verify User', () => {
  test('Verify User without any rules', async () => {
    const mongoDb = await getMongoDbClient()
    const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
    const rulesEngineService = new UserManagementService(
      TEST_TENANT_ID,
      dynamoDb,
      mongoDb,
      logicEvaluator
    )
    const user = getTestUser()
    const result = await rulesEngineService.verifyUser(user, 'CONSUMER')
    expect(result).toEqual({
      ...user,
      status: 'ALLOW',
      executedRules: [],
      riskScoreDetails: {
        craRiskLevel: 'VERY_HIGH',
        craRiskScore: 90,
        kycRiskLevel: 'VERY_HIGH',
        kycRiskScore: 90,
      },
      hitRules: [],
    })
  })
  describe('Verify User with V8 rules consumer user', () => {
    withFeatureHook(['RULES_ENGINE_V8'])
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'RC-test-rule',
        type: 'USER',
        defaultLogic: {
          and: [
            {
              '==': [
                { var: 'CONSUMER_USER:userDetails-name-firstName__SENDER' },
                'tester',
              ],
            },
          ],
        },
      },
      {
        id: 'RC-test-rule-async',
        type: 'USER',
        defaultLogic: {
          and: [
            {
              '==': [
                { var: 'CONSUMER_USER:userDetails-name-firstName__SENDER' },
                'tester',
              ],
            },
          ],
        },
        ruleRunMode: 'LIVE',
        ruleExecutionMode: 'ASYNC',
      },
    ])
    test('Verify consumer user with V8 user rule', async () => {
      const mongoDb = await getMongoDbClient()
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngineService = new UserManagementService(
        TEST_TENANT_ID,
        dynamoDb,
        mongoDb,
        logicEvaluator
      )
      const user = getTestUser({
        userDetails: {
          name: {
            firstName: 'tester',
          },
        },
      })
      const result = await rulesEngineService.verifyUser(user, 'CONSUMER')
      expect(result).toEqual({
        ...user,
        executedRules: [
          {
            isShadow: false,
            labels: [],
            nature: 'AML',
            ruleAction: 'FLAG',
            ruleDescription: '',
            ruleHit: true,
            ruleHitMeta: {
              falsePositiveDetails: undefined,
              hitDirections: ['ORIGIN'],
              isOngoingScreeningHit: undefined,
              sanctionsDetails: undefined,
            },
            ruleId: 'RC-test-rule',
            ruleInstanceId: 'RC-test-rule',
            ruleName: 'test rule name',
            executedAt: expect.any(Number),
            vars: [
              {
                direction: 'ORIGIN',
                value: {
                  'CONSUMER_USER:userDetails-name-firstName__SENDER': 'tester',
                },
              },
            ],
          },
        ],
        hitRules: [
          {
            isShadow: false,
            labels: [],
            nature: 'AML',
            ruleAction: 'FLAG',
            ruleDescription: '',
            executedAt: expect.any(Number),
            ruleHitMeta: {
              falsePositiveDetails: undefined,
              hitDirections: ['ORIGIN'],
              isOngoingScreeningHit: undefined,
              sanctionsDetails: undefined,
            },
            ruleId: 'RC-test-rule',
            ruleInstanceId: 'RC-test-rule',
            ruleName: 'test rule name',
          },
        ],
        status: 'FLAG',
        riskScoreDetails: {
          craRiskLevel: 'VERY_HIGH',
          craRiskScore: 90,
          kycRiskLevel: 'VERY_HIGH',
          kycRiskScore: 90,
        },
      })

      await rulesEngineService.verifyAsyncRulesUser('CONSUMER', user)

      const result2 = await rulesEngineService.userRepository.getConsumerUser(
        user.userId
      )

      expect(result2).toEqual({
        ...user,
        type: 'CONSUMER',
        hitRules: [
          {
            ruleAction: 'FLAG',
            executedAt: expect.any(Number),
            nature: 'AML',
            ruleName: 'test rule name',
            ruleInstanceId: 'RC-test-rule-async',
            isShadow: false,
            ruleId: 'RC-test-rule-async',
            ruleDescription: '',
            ruleHitMeta: {
              hitDirections: ['ORIGIN'],
            },
            labels: [],
          },
          {
            ruleAction: 'FLAG',
            executedAt: expect.any(Number),
            nature: 'AML',
            ruleName: 'test rule name',
            ruleInstanceId: 'RC-test-rule',
            isShadow: false,
            ruleId: 'RC-test-rule',
            ruleDescription: '',
            ruleHitMeta: {
              hitDirections: ['ORIGIN'],
            },
            labels: [],
          },
        ],
        executedRules: [
          {
            ruleAction: 'FLAG',
            executedAt: expect.any(Number),
            nature: 'AML',
            ruleName: 'test rule name',
            ruleHit: true,
            ruleInstanceId: 'RC-test-rule-async',
            vars: [
              {
                value: {
                  'CONSUMER_USER:userDetails-name-firstName__SENDER': 'tester',
                },
                direction: 'ORIGIN',
              },
            ],
            isShadow: false,
            ruleId: 'RC-test-rule-async',
            ruleDescription: '',
            ruleHitMeta: {
              hitDirections: ['ORIGIN'],
            },
            labels: [],
          },
          {
            ruleAction: 'FLAG',
            nature: 'AML',
            ruleName: 'test rule name',
            executedAt: expect.any(Number),
            ruleHit: true,
            ruleInstanceId: 'RC-test-rule',
            vars: [
              {
                value: {
                  'CONSUMER_USER:userDetails-name-firstName__SENDER': 'tester',
                },
                direction: 'ORIGIN',
              },
            ],
            isShadow: false,
            ruleId: 'RC-test-rule',
            ruleDescription: '',
            ruleHitMeta: {
              hitDirections: ['ORIGIN'],
            },
            labels: [],
          },
        ],
        status: 'FLAG',
        updateCount: expect.any(Number),
      })
    })

    test('verify consumer user event with V8 user rule', async () => {
      const mongoDb = await getMongoDbClient()
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngineService = new UserManagementService(
        TEST_TENANT_ID,
        dynamoDb,
        mongoDb,
        logicEvaluator
      )
      const user = getTestUser({})
      const savedUser = await rulesEngineService.verifyUser(user, 'CONSUMER')
      const result = await rulesEngineService.verifyConsumerUserEvent({
        userId: savedUser.userId,
        updatedConsumerUserAttributes: {
          userDetails: {
            name: {
              firstName: 'tester',
            },
          },
        },
        timestamp: Date.now(),
      })
      expect(result).toEqual({
        ...user,
        userDetails: {
          ...user.userDetails,
          name: {
            ...user.userDetails?.name,
            firstName: 'tester',
          },
        },
        status: 'FLAG',
        riskScoreDetails: undefined,
        executedRules: [
          {
            isShadow: false,
            labels: [],
            nature: 'AML',
            ruleAction: 'FLAG',
            ruleDescription: '',
            ruleHit: true,
            ruleHitMeta: {
              falsePositiveDetails: undefined,
              hitDirections: ['ORIGIN'],
              isOngoingScreeningHit: undefined,
              sanctionsDetails: undefined,
            },
            ruleId: 'RC-test-rule',
            ruleInstanceId: 'RC-test-rule',
            ruleName: 'test rule name',
            executedAt: expect.any(Number),
            vars: [
              {
                direction: 'ORIGIN',
                value: {
                  'CONSUMER_USER:userDetails-name-firstName__SENDER': 'tester',
                },
              },
            ],
          },
        ],
        hitRules: [
          {
            isShadow: false,
            executedAt: expect.any(Number),
            labels: [],
            nature: 'AML',
            ruleAction: 'FLAG',
            ruleDescription: '',
            ruleHitMeta: {
              falsePositiveDetails: undefined,
              hitDirections: ['ORIGIN'],
              isOngoingScreeningHit: undefined,
              sanctionsDetails: undefined,
            },
            ruleId: 'RC-test-rule',
            ruleInstanceId: 'RC-test-rule',
            ruleName: 'test rule name',
          },
        ],
        updateCount: expect.any(Number),
      })
    })
  })

  describe('Verify User with V8 rules business user ', () => {
    withFeatureHook(['RULES_ENGINE_V8'])
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'RC-test-rule',
        type: 'USER',
        defaultLogic: {
          and: [
            {
              '==': [
                {
                  var: 'BUSINESS_USER:legalEntity-companyGeneralDetails-legalName__SENDER',
                },
                'tester',
              ],
            },
          ],
        },
      },
      {
        id: 'RC-test-rule-async',
        type: 'USER',
        defaultLogic: {
          and: [
            {
              '==': [
                {
                  var: 'BUSINESS_USER:legalEntity-companyGeneralDetails-legalName__SENDER',
                },
                'tester',
              ],
            },
          ],
        },
        ruleRunMode: 'LIVE',
        ruleExecutionMode: 'ASYNC',
      },
    ])
    test('Verify business user with V8 user rule', async () => {
      const mongoDb = await getMongoDbClient()
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngineService = new UserManagementService(
        TEST_TENANT_ID,
        dynamoDb,
        mongoDb,
        logicEvaluator
      )
      const user = getTestBusiness({
        legalEntity: {
          companyGeneralDetails: {
            legalName: 'tester',
          },
        },
      })
      const result = await rulesEngineService.verifyUser(user, 'BUSINESS')
      expect(result).toEqual({
        ...user,
        executedRules: [
          {
            isShadow: false,
            labels: [],
            nature: 'AML',
            ruleAction: 'FLAG',
            ruleDescription: '',
            ruleHit: true,
            ruleHitMeta: {
              falsePositiveDetails: undefined,
              hitDirections: ['ORIGIN'],
              isOngoingScreeningHit: undefined,
              sanctionsDetails: undefined,
            },
            ruleId: 'RC-test-rule',
            ruleInstanceId: 'RC-test-rule.1',
            ruleName: 'test rule name',
            executedAt: expect.any(Number),
            vars: [
              {
                direction: 'ORIGIN',
                value: {
                  'BUSINESS_USER:legalEntity-companyGeneralDetails-legalName__SENDER':
                    'tester',
                },
              },
            ],
          },
        ],
        hitRules: [
          {
            isShadow: false,
            executedAt: expect.any(Number),
            labels: [],
            nature: 'AML',
            ruleAction: 'FLAG',
            ruleDescription: '',
            ruleHitMeta: {
              falsePositiveDetails: undefined,
              hitDirections: ['ORIGIN'],
              isOngoingScreeningHit: undefined,
              sanctionsDetails: undefined,
            },
            ruleId: 'RC-test-rule',
            ruleInstanceId: 'RC-test-rule.1',
            ruleName: 'test rule name',
          },
        ],
        status: 'FLAG',
        riskScoreDetails: {
          craRiskLevel: 'VERY_HIGH',
          craRiskScore: 90,
          kycRiskLevel: 'VERY_HIGH',
          kycRiskScore: 90,
        },
      })
    })
    test('Verify business user event with V8 user rule', async () => {
      const mongoDb = await getMongoDbClient()
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngineService = new UserManagementService(
        TEST_TENANT_ID,
        dynamoDb,
        mongoDb,
        logicEvaluator
      )
      const eventTimestamp = Date.now()
      const user = getTestBusiness()
      const savedUser = await rulesEngineService.verifyUser(user, 'BUSINESS')
      const result = await rulesEngineService.verifyBusinessUserEvent({
        userId: savedUser.userId,
        updatedBusinessUserAttributes: {
          legalEntity: {
            companyGeneralDetails: {
              legalName: 'tester',
            },
          },
        },
        timestamp: eventTimestamp,
      })
      expect(result).toEqual({
        ...user,
        legalEntity: {
          ...user.legalEntity,
          companyGeneralDetails: {
            ...user.legalEntity?.companyGeneralDetails,
            legalName: 'tester',
          },
        },
        executedRules: [
          {
            isShadow: false,
            labels: [],
            nature: 'AML',
            ruleAction: 'FLAG',
            ruleDescription: '',
            ruleHit: true,
            ruleHitMeta: {
              falsePositiveDetails: undefined,
              hitDirections: ['ORIGIN'],
              isOngoingScreeningHit: undefined,
              sanctionsDetails: undefined,
            },
            ruleId: 'RC-test-rule',
            ruleInstanceId: 'RC-test-rule.1',
            ruleName: 'test rule name',
            executedAt: expect.any(Number),
            vars: [
              {
                direction: 'ORIGIN',
                value: {
                  'BUSINESS_USER:legalEntity-companyGeneralDetails-legalName__SENDER':
                    'tester',
                },
              },
            ],
          },
        ],
        hitRules: [
          {
            isShadow: false,
            executedAt: expect.any(Number),
            labels: [],
            nature: 'AML',
            ruleAction: 'FLAG',
            ruleDescription: '',
            ruleHitMeta: {
              falsePositiveDetails: undefined,
              hitDirections: ['ORIGIN'],
              isOngoingScreeningHit: undefined,
              sanctionsDetails: undefined,
            },
            ruleId: 'RC-test-rule',
            ruleInstanceId: 'RC-test-rule.1',
            ruleName: 'test rule name',
          },
        ],
        riskScoreDetails: undefined,
        status: 'FLAG',
        updateCount: expect.any(Number),
      })

      await rulesEngineService.verifyAsyncRulesUserEvent(
        'BUSINESS',
        result,
        eventTimestamp
      )

      const result2 = await rulesEngineService.userRepository.getBusinessUser(
        user.userId
      )

      expect(result2).toEqual({
        ...user,
        type: 'BUSINESS',
        legalEntity: {
          ...user.legalEntity,
          companyGeneralDetails: {
            ...user.legalEntity?.companyGeneralDetails,
            legalName: 'tester',
          },
        },
        hitRules: [
          {
            ruleAction: 'FLAG',
            executedAt: expect.any(Number),
            nature: 'AML',
            ruleName: 'test rule name',
            ruleInstanceId: 'RC-test-rule-async.1',
            isShadow: false,
            ruleId: 'RC-test-rule-async',
            ruleDescription: '',
            ruleHitMeta: {
              hitDirections: ['ORIGIN'],
            },
            labels: [],
          },
          {
            ruleAction: 'FLAG',
            executedAt: expect.any(Number),
            nature: 'AML',
            ruleName: 'test rule name',
            ruleInstanceId: 'RC-test-rule.1',
            isShadow: false,
            ruleId: 'RC-test-rule',
            ruleDescription: '',
            ruleHitMeta: {
              hitDirections: ['ORIGIN'],
            },
            labels: [],
          },
        ],
        executedRules: [
          {
            ruleAction: 'FLAG',
            executedAt: expect.any(Number),
            nature: 'AML',
            ruleName: 'test rule name',
            ruleHit: true,
            ruleInstanceId: 'RC-test-rule-async.1',
            vars: [
              {
                value: {
                  'BUSINESS_USER:legalEntity-companyGeneralDetails-legalName__SENDER':
                    'tester',
                },
                direction: 'ORIGIN',
              },
            ],
            isShadow: false,
            ruleId: 'RC-test-rule-async',
            ruleDescription: '',
            ruleHitMeta: {
              hitDirections: ['ORIGIN'],
            },
            labels: [],
          },
          {
            ruleAction: 'FLAG',
            executedAt: expect.any(Number),
            nature: 'AML',
            ruleName: 'test rule name',
            ruleHit: true,
            ruleInstanceId: 'RC-test-rule.1',
            vars: [
              {
                value: {
                  'BUSINESS_USER:legalEntity-companyGeneralDetails-legalName__SENDER':
                    'tester',
                },
                direction: 'ORIGIN',
              },
            ],
            isShadow: false,
            ruleId: 'RC-test-rule',
            ruleDescription: '',
            ruleHitMeta: {
              hitDirections: ['ORIGIN'],
            },
            labels: [],
          },
        ],
        status: 'FLAG',
        updateCount: expect.any(Number),
      })
    })
  })
})
describe('Verify user with V8 rule with transaction aggregation variables', () => {
  withFeatureHook(['RULES_ENGINE_V8'])
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'RC-test-rule',
      type: 'USER',
      defaultLogicAggregationVariables: [
        {
          key: 'agg:123',
          aggregationFunc: 'COUNT',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          type: 'USER_TRANSACTIONS',
          timeWindow: {
            start: {
              granularity: 'hour',
              units: 1,
            },
            end: {
              granularity: 'hour',
              units: 0,
            },
          },
          includeCurrentEntity: true,
        },
      ],
      defaultLogic: {
        and: [
          {
            '>=': [
              {
                var: 'agg:123',
              },
              1,
            ],
          },
        ],
      },
    },
  ])
  test('Verify consumer user event with V8 user rule with transaction aggregation variables', async () => {
    const mongoDb = await getMongoDbClient()
    const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
    const userRulesEngineService = new UserManagementService(
      TEST_TENANT_ID,
      dynamoDb,
      mongoDb,
      logicEvaluator
    )

    const user = getTestUser()
    const result1 = await userRulesEngineService.verifyUser(user, 'CONSUMER')
    expect(result1).toEqual({
      ...user,
      status: 'ALLOW',
      executedRules: [
        {
          isShadow: false,
          executedAt: expect.any(Number),
          labels: [],
          nature: 'AML',
          ruleAction: 'FLAG',
          ruleDescription: '',
          ruleHit: false,
          ruleHitMeta: undefined,
          ruleId: 'RC-test-rule',
          ruleInstanceId: 'RC-test-rule.2',
          ruleName: 'test rule name',
          vars: [
            {
              direction: 'ORIGIN',
              value: {
                'agg:123': 0,
              },
            },
            {
              direction: 'DESTINATION',
              value: {
                'agg:123': 0,
              },
            },
          ],
        },
      ],
      hitRules: [],
      riskScoreDetails: {
        craRiskLevel: 'VERY_HIGH',
        craRiskScore: 90,
        kycRiskLevel: 'VERY_HIGH',
        kycRiskScore: 90,
      },
    })
    const rulesEngineService = new RulesEngineService(
      TEST_TENANT_ID,
      dynamoDb,
      logicEvaluator,
      mongoDb
    )
    const transaction = getTestTransaction({
      originUserId: user.userId,
    })
    await rulesEngineService.verifyTransaction(transaction)
    const result2 = await userRulesEngineService.verifyConsumerUserEvent({
      userId: user.userId,
      timestamp: Date.now(),
    })
    expect(result2).toEqual({
      ...user,
      status: 'FLAG',
      riskScoreDetails: undefined,
      executedRules: [
        {
          isShadow: false,
          executedAt: expect.any(Number),
          labels: [],
          nature: 'AML',
          ruleAction: 'FLAG',
          ruleDescription: '',
          ruleHit: true,
          ruleHitMeta: {
            falsePositiveDetails: undefined,
            hitDirections: ['ORIGIN'],
            isOngoingScreeningHit: undefined,
            sanctionsDetails: undefined,
          },
          ruleId: 'RC-test-rule',
          ruleInstanceId: 'RC-test-rule.2',
          ruleName: 'test rule name',
          vars: [
            {
              direction: 'ORIGIN',
              value: {
                'agg:123': 1,
              },
            },
            {
              direction: 'DESTINATION',
              value: {
                'agg:123': 1,
              },
            },
          ],
        },
      ],
      hitRules: [
        {
          isShadow: false,
          executedAt: expect.any(Number),
          labels: [],
          nature: 'AML',
          ruleAction: 'FLAG',
          ruleDescription: '',
          ruleHitMeta: {
            falsePositiveDetails: undefined,
            hitDirections: ['ORIGIN'],
            isOngoingScreeningHit: undefined,
            sanctionsDetails: undefined,
          },
          ruleId: 'RC-test-rule',
          ruleInstanceId: 'RC-test-rule.2',
          ruleName: 'test rule name',
        },
      ],
      updateCount: expect.any(Number),
    })
  })

  test('Verify business user event with V8 user rule with transaction aggregation variables', async () => {
    const mongoDb = await getMongoDbClient()
    const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
    const userRulesEngineService = new UserManagementService(
      TEST_TENANT_ID,
      dynamoDb,
      mongoDb,
      logicEvaluator
    )
    const user = getTestBusiness()
    const result1 = await userRulesEngineService.verifyUser(user, 'BUSINESS')
    expect(result1).toEqual({
      ...user,
      status: 'ALLOW',
      executedRules: [
        {
          isShadow: false,
          executedAt: expect.any(Number),
          labels: [],
          nature: 'AML',
          ruleAction: 'FLAG',
          ruleDescription: '',
          ruleHit: false,
          ruleHitMeta: undefined,
          ruleId: 'RC-test-rule',
          ruleInstanceId: 'RC-test-rule.2',
          ruleName: 'test rule name',
          vars: [
            {
              direction: 'ORIGIN',
              value: {
                'agg:123': 0,
              },
            },
            {
              direction: 'DESTINATION',
              value: {
                'agg:123': 0,
              },
            },
          ],
        },
      ],
      hitRules: [],
      riskScoreDetails: {
        craRiskLevel: 'VERY_HIGH',
        craRiskScore: 90,
        kycRiskLevel: 'VERY_HIGH',
        kycRiskScore: 90,
      },
    })
    const rulesEngineService = new RulesEngineService(
      TEST_TENANT_ID,
      dynamoDb,
      logicEvaluator,
      mongoDb
    )
    const transaction = getTestTransaction({
      originUserId: user.userId,
    })
    await rulesEngineService.verifyTransaction(transaction)
    const result2 = await userRulesEngineService.verifyBusinessUserEvent({
      userId: user.userId,
      timestamp: Date.now(),
    })
    expect(result2).toEqual({
      ...user,
      status: 'FLAG',
      riskScoreDetails: undefined,
      executedRules: [
        {
          isShadow: false,
          executedAt: expect.any(Number),
          labels: [],
          nature: 'AML',
          ruleAction: 'FLAG',
          ruleDescription: '',
          ruleHit: true,
          ruleHitMeta: {
            falsePositiveDetails: undefined,
            hitDirections: ['ORIGIN'],
            isOngoingScreeningHit: undefined,
            sanctionsDetails: undefined,
          },
          ruleId: 'RC-test-rule',
          ruleInstanceId: 'RC-test-rule.2',
          ruleName: 'test rule name',
          vars: [
            {
              direction: 'ORIGIN',
              value: {
                'agg:123': 1,
              },
            },
            {
              direction: 'DESTINATION',
              value: {
                'agg:123': 1,
              },
            },
          ],
        },
      ],
      hitRules: [
        {
          isShadow: false,
          executedAt: expect.any(Number),
          labels: [],
          nature: 'AML',
          ruleAction: 'FLAG',
          ruleDescription: '',
          ruleHitMeta: {
            falsePositiveDetails: undefined,
            hitDirections: ['ORIGIN'],
            isOngoingScreeningHit: undefined,
            sanctionsDetails: undefined,
          },
          ruleId: 'RC-test-rule',
          ruleInstanceId: 'RC-test-rule.2',
          ruleName: 'test rule name',
        },
      ],
      updateCount: expect.any(Number),
    })
  })
})

describe('Verify Consumer user with V8 rule with transaction aggregation variables', () => {
  withFeatureHook(['RULES_ENGINE_V8'])
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'RC-test-rule-user-agg',
      type: 'USER',
      defaultLogicAggregationVariables: [
        {
          key: 'agg:142',
          aggregationFunc: 'UNIQUE_COUNT',
          aggregationFieldKey: 'CONSUMER_USER:occupation__SENDER',
          type: 'USER_DETAILS',
          timeWindow: {
            start: {
              granularity: 'hour',
              units: 2,
            },
            end: {
              granularity: 'hour',
              units: 0,
            },
          },
          includeCurrentEntity: true,
        },
      ],
      defaultLogic: {
        and: [
          {
            '>=': [
              {
                var: 'agg:142',
              },
              2,
            ],
          },
        ],
      },
    },
    {
      id: 'RC-test-rule-user-agg-1',
      type: 'USER',
      defaultLogicAggregationVariables: [
        {
          key: 'agg:132',
          aggregationFunc: 'UNIQUE_COUNT',
          aggregationFieldKey: 'CONSUMER_USER:occupation__SENDER',
          type: 'USER_DETAILS',
          timeWindow: {
            start: {
              granularity: 'hour',
              units: 1,
            },
            end: {
              granularity: 'hour',
              units: 0,
            },
          },
          includeCurrentEntity: true,
        },
      ],
      defaultLogic: {
        and: [
          {
            '>=': [
              {
                var: 'agg:132',
              },
              1,
            ],
          },
        ],
      },
    },
  ])
  test('Verify Consumer user with user details aggregation variable', async () => {
    const mongoDb = await getMongoDbClient()
    const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
    const userRulesEngineService = new UserManagementService(
      TEST_TENANT_ID,
      dynamoDb,
      mongoDb,
      logicEvaluator
    )
    const user = getTestUser({ occupation: 'abc' })
    const result = await userRulesEngineService.verifyUser(user, 'CONSUMER')
    expect(result.hitRules).toEqual([
      {
        ruleInstanceId: 'RC-test-rule-user-agg-1',
        ruleId: 'RC-test-rule-user-agg-1',
        ruleName: 'test rule name',
        isShadow: false,
        executedAt: expect.any(Number),
        labels: [],
        nature: 'AML',
        ruleAction: 'FLAG',
        ruleDescription: '',
        ruleHitMeta: {
          falsePositiveDetails: undefined,
          hitDirections: ['ORIGIN'],
          isOngoingScreeningHit: undefined,
          sanctionsDetails: undefined,
        },
      },
    ])
  })

  test('Verify Consumer user event with user details aggregation variable', async () => {
    const mongoDb = await getMongoDbClient()
    const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
    const userRulesEngineService = new UserManagementService(
      TEST_TENANT_ID,
      dynamoDb,
      mongoDb,
      logicEvaluator
    )
    const user = getTestUser({ occupation: 'abc' })
    const result = await userRulesEngineService.verifyUser(user, 'CONSUMER')
    expect(result.hitRules).toEqual([
      {
        ruleInstanceId: 'RC-test-rule-user-agg-1',
        ruleId: 'RC-test-rule-user-agg-1',
        ruleName: 'test rule name',
        isShadow: false,
        executedAt: expect.any(Number),
        labels: [],
        nature: 'AML',
        ruleAction: 'FLAG',
        ruleDescription: '',
        ruleHitMeta: {
          falsePositiveDetails: undefined,
          hitDirections: ['ORIGIN'],
          isOngoingScreeningHit: undefined,
          sanctionsDetails: undefined,
        },
      },
    ])
    const userEvent = getTestUserEvent({
      userId: user.userId,
      updatedConsumerUserAttributes: { occupation: 'bcd' },
      timestamp: user.createdTimestamp + 10,
    })
    const result2 = await userRulesEngineService.verifyConsumerUserEvent(
      userEvent
    )
    expect(result2.hitRules?.length).toEqual(2)
    expect(result2.hitRules).toEqual([
      {
        ruleInstanceId: 'RC-test-rule-user-agg',
        ruleId: 'RC-test-rule-user-agg',
        ruleName: 'test rule name',
        isShadow: false,
        executedAt: expect.any(Number),
        labels: [],
        nature: 'AML',
        ruleAction: 'FLAG',
        ruleDescription: '',
        ruleHitMeta: {
          falsePositiveDetails: undefined,
          hitDirections: ['ORIGIN'],
          isOngoingScreeningHit: undefined,
          sanctionsDetails: undefined,
        },
      },
      {
        ruleInstanceId: 'RC-test-rule-user-agg-1',
        ruleId: 'RC-test-rule-user-agg-1',
        ruleName: 'test rule name',
        isShadow: false,
        executedAt: expect.any(Number),
        labels: [],
        nature: 'AML',
        ruleAction: 'FLAG',
        ruleDescription: '',
        ruleHitMeta: {
          falsePositiveDetails: undefined,
          hitDirections: ['ORIGIN'],
          isOngoingScreeningHit: undefined,
          sanctionsDetails: undefined,
        },
      },
    ])
  })
})
describe('Verify Business user with V8 rule with transaction aggregation variables', () => {
  withFeatureHook(['RULES_ENGINE_V8'])
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'RC-test-rule-user-agg-bus',
      type: 'USER',
      defaultLogicAggregationVariables: [
        {
          key: 'agg:142',
          aggregationFunc: 'UNIQUE_COUNT',
          aggregationFieldKey: 'BUSINESS_USER:mccDetails-code__SENDER',
          type: 'USER_DETAILS',
          timeWindow: {
            start: {
              granularity: 'hour',
              units: 2,
            },
            end: {
              granularity: 'hour',
              units: 0,
            },
          },
          includeCurrentEntity: true,
        },
      ],
      defaultLogic: {
        and: [
          {
            '>=': [
              {
                var: 'agg:142',
              },
              2,
            ],
          },
        ],
      },
    },
    {
      id: 'RC-test-rule-user-agg-bus-1',
      type: 'USER',
      defaultLogicAggregationVariables: [
        {
          key: 'agg:132',
          aggregationFunc: 'UNIQUE_COUNT',
          aggregationFieldKey: 'BUSINESS_USER:mccDetails-code__SENDER',
          type: 'USER_DETAILS',
          timeWindow: {
            start: {
              granularity: 'hour',
              units: 1,
            },
            end: {
              granularity: 'hour',
              units: 0,
            },
          },
          includeCurrentEntity: true,
        },
      ],
      defaultLogic: {
        and: [
          {
            '>=': [
              {
                var: 'agg:132',
              },
              1,
            ],
          },
        ],
      },
    },
  ])
  test('Verify Business user with user details aggregation variable', async () => {
    const mongoDb = await getMongoDbClient()
    const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
    const userRulesEngineService = new UserManagementService(
      TEST_TENANT_ID,
      dynamoDb,
      mongoDb,
      logicEvaluator
    )
    const user = getTestBusiness({
      mccDetails: {
        code: 1,
      },
    })
    const result = await userRulesEngineService.verifyUser(user, 'BUSINESS')
    expect(result.hitRules).toEqual([
      {
        ruleInstanceId: 'RC-test-rule-user-agg-bus-1',
        ruleId: 'RC-test-rule-user-agg-bus-1',
        ruleName: 'test rule name',
        isShadow: false,
        executedAt: expect.any(Number),
        labels: [],
        nature: 'AML',
        ruleAction: 'FLAG',
        ruleDescription: '',
        ruleHitMeta: {
          falsePositiveDetails: undefined,
          hitDirections: ['ORIGIN'],
          isOngoingScreeningHit: undefined,
          sanctionsDetails: undefined,
        },
      },
    ])
  })

  test('Verify Business user event with user details aggregation variable', async () => {
    const mongoDb = await getMongoDbClient()
    const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
    const userRulesEngineService = new UserManagementService(
      TEST_TENANT_ID,
      dynamoDb,
      mongoDb,
      logicEvaluator
    )
    const user = getTestBusiness({
      mccDetails: {
        code: 1,
      },
    })
    const result = await userRulesEngineService.verifyUser(user, 'BUSINESS')
    expect(result.hitRules).toEqual([
      {
        ruleInstanceId: 'RC-test-rule-user-agg-bus-1',
        ruleId: 'RC-test-rule-user-agg-bus-1',
        ruleName: 'test rule name',
        isShadow: false,
        executedAt: expect.any(Number),
        labels: [],
        nature: 'AML',
        ruleAction: 'FLAG',
        ruleDescription: '',
        ruleHitMeta: {
          falsePositiveDetails: undefined,
          hitDirections: ['ORIGIN'],
          isOngoingScreeningHit: undefined,
          sanctionsDetails: undefined,
        },
      },
    ])
    const userEvent = getTestBusinessEvent({
      userId: user.userId,
      updatedBusinessUserAttributes: {
        mccDetails: {
          code: 2,
        },
      },
      timestamp: user.createdTimestamp + 10,
    })
    const result2 = await userRulesEngineService.verifyBusinessUserEvent(
      userEvent
    )
    expect(result2.hitRules?.length).toEqual(2)
    expect(result2.hitRules).toEqual([
      {
        ruleInstanceId: 'RC-test-rule-user-agg-bus',
        ruleId: 'RC-test-rule-user-agg-bus',
        ruleName: 'test rule name',
        isShadow: false,
        executedAt: expect.any(Number),
        labels: [],
        nature: 'AML',
        ruleAction: 'FLAG',
        ruleDescription: '',
        ruleHitMeta: {
          falsePositiveDetails: undefined,
          hitDirections: ['ORIGIN'],
          isOngoingScreeningHit: undefined,
          sanctionsDetails: undefined,
        },
      },
      {
        ruleInstanceId: 'RC-test-rule-user-agg-bus-1',
        ruleId: 'RC-test-rule-user-agg-bus-1',
        ruleName: 'test rule name',
        isShadow: false,
        executedAt: expect.any(Number),
        labels: [],
        nature: 'AML',
        ruleAction: 'FLAG',
        ruleDescription: '',
        ruleHitMeta: {
          falsePositiveDetails: undefined,
          hitDirections: ['ORIGIN'],
          isOngoingScreeningHit: undefined,
          sanctionsDetails: undefined,
        },
      },
    ])
  })
})
describe('Create a consumer user event with risk scoring V8', () => {
  const TEST_TENANT_ID = getTestTenantId()
  beforeAll(async () => {
    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()
    const tenantService = new TenantService(TEST_TENANT_ID, {
      dynamoDb,
      mongoDb,
    })
    await tenantService.createOrUpdateTenantSettings({
      riskScoringAlgorithm: {
        type: 'FORMULA_SIMPLE_AVG',
      },
      riskScoringCraEnabled: true,
    })
  })
  withFeatureHook(['RISK_SCORING', 'RISK_LEVELS'])
  setUpRiskFactorsHook(TEST_TENANT_ID, [
    getTestRiskFactor({
      id: 'RF1',
      type: 'CONSUMER_USER',
      riskLevelLogic: [
        {
          logic: {
            and: [
              {
                '==': [
                  { var: 'CONSUMER_USER:kycStatusDetails-status__SENDER' },
                  'CANCELLED',
                ],
              },
            ],
          },
          riskLevel: 'MEDIUM',
          riskScore: 50,
          weight: 1,
        },
        {
          logic: {
            and: [
              {
                '==': [
                  { var: 'CONSUMER_USER:kycStatusDetails-status__SENDER' },
                  'FAILED',
                ],
              },
            ],
          },
          riskLevel: 'VERY_HIGH',
          riskScore: 90,
          weight: 1,
        },
      ],
    }),
  ])
  test('returns updated user', async () => {
    const consumerUser = getTestUser({
      userId: 'foo',
      kycStatusDetails: { status: 'CANCELLED' },
    })
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const userManagementService = new UserManagementService(
      TEST_TENANT_ID,
      dynamoDb,
      mongoDb,
      new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
    )
    const creationResponse = await userManagementService.verifyUser(
      consumerUser,
      'CONSUMER'
    )
    const user = creationResponse
    expect(user).toMatchObject({
      userId: 'foo',
    })
    const userEvent = getTestUserEvent({
      eventId: '1',
      userId: 'foo',
      updatedConsumerUserAttributes: {
        tags: [{ key: 'key', value: 'value' }],
        kycStatusDetails: { status: 'FAILED' },
      },
    })
    const response = await userManagementService.verifyConsumerUserEvent(
      userEvent
    )
    expect(response).toEqual({
      ...pickKnownEntityFields(consumerUser, User),
      kycStatusDetails: { status: 'FAILED' },
      riskLevel: 'VERY_HIGH',
      tags: [
        { key: 'customKey', value: 'customValue' },
        { key: 'key', value: 'value' },
      ],
      status: 'ALLOW',
      executedRules: [],
      hitRules: [],
      riskScoreDetails: {
        craRiskLevel: 'VERY_HIGH',
        craRiskScore: 90,
        kycRiskLevel: 'VERY_HIGH',
        kycRiskScore: 90,
      },
      updateCount: expect.any(Number),
    })
  })
})
describe('Create a business user event with risk scoring V8', () => {
  const TEST_TENANT_ID = getTestTenantId()
  beforeAll(async () => {
    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()
    const tenantService = new TenantService(TEST_TENANT_ID, {
      dynamoDb,
      mongoDb,
    })
    await tenantService.createOrUpdateTenantSettings({
      riskScoringAlgorithm: {
        type: 'FORMULA_SIMPLE_AVG',
      },
      riskScoringCraEnabled: true,
    })
  })
  withFeatureHook(['RISK_SCORING'])
  setUpRiskFactorsHook(TEST_TENANT_ID, [
    getTestRiskFactor({
      id: 'RF1',
      type: 'BUSINESS',
      riskLevelLogic: [
        {
          logic: {
            and: [
              {
                '==': [
                  { var: 'BUSINESS_USER:kycStatusDetails-status__SENDER' },
                  'CANCELLED',
                ],
              },
            ],
          },
          riskLevel: 'MEDIUM',
          riskScore: 50,
          weight: 1,
        },
        {
          logic: {
            and: [
              {
                '==': [
                  { var: 'BUSINESS_USER:kycStatusDetails-status__SENDER' },
                  'FAILED',
                ],
              },
            ],
          },
          riskLevel: 'VERY_HIGH',
          riskScore: 90,
          weight: 1,
        },
      ],
    }),
  ])
  test('returns saved user ID', async () => {
    const businessUser1 = getTestBusiness({
      userId: '1',
      kycStatusDetails: {
        status: 'CANCELLED',
      },
    })
    const mongoDb = await getMongoDbClient()
    const userManagementService = new UserManagementService(
      TEST_TENANT_ID,
      getDynamoDbClient(),
      mongoDb,
      new LogicEvaluator(TEST_TENANT_ID, getDynamoDbClient())
    )
    const creationResponse = await userManagementService.verifyUser(
      businessUser1,
      'BUSINESS'
    )
    const user = creationResponse
    expect(user).toMatchObject({
      userId: '1',
    })
    const userEvent = getTestBusinessEvent({
      eventId: '1',
      userId: user.userId,
      updatedBusinessUserAttributes: {
        tags: [{ key: 'key', value: 'value' }],
        kycStatusDetails: { status: 'FAILED' },
      },
    })
    const response = await userManagementService.verifyBusinessUserEvent(
      userEvent
    )
    expect(response).toEqual({
      ...pickKnownEntityFields(businessUser1, Business),
      kycStatusDetails: { status: 'FAILED' },
      riskLevel: 'VERY_HIGH',
      tags: [{ key: 'key', value: 'value' }],
      status: 'ALLOW',
      executedRules: [],
      hitRules: [],
      riskScoreDetails: {
        craRiskLevel: 'VERY_HIGH',
        craRiskScore: 90,
        kycRiskLevel: 'VERY_HIGH',
        kycRiskScore: 90,
      },
      updateCount: expect.any(Number),
    })
  })
})
