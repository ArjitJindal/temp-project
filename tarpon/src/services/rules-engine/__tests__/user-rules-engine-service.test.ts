import { UserManagementService } from '../user-rules-engine-service'
import { RulesEngineService } from '../rules-engine-service'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { withLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getTestBusiness, getTestUser } from '@/test-utils/user-test-utils'
import { setUpRulesHooks } from '@/test-utils/rule-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

const dynamoDb = getDynamoDbClient()
const TEST_TENANT_ID = getTestTenantId()
dynamoDbSetupHook()
withLocalChangeHandler()
describe('Verify User', () => {
  test('Verify User without any rules', async () => {
    const mongoDb = await getMongoDbClient()
    const rulesEngineService = new UserManagementService(
      TEST_TENANT_ID,
      dynamoDb,
      mongoDb
    )
    const user = getTestUser()
    const result = await rulesEngineService.verifyUser(user, 'CONSUMER')
    expect(result).toEqual({
      ...user,
      status: 'ALLOW',
      executedRules: [],
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
    ])
    test('Verify consumer user with V8 user rule', async () => {
      const mongoDb = await getMongoDbClient()
      const rulesEngineService = new UserManagementService(
        TEST_TENANT_ID,
        dynamoDb,
        mongoDb
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
      })
    })

    test('verify consumer user event with V8 user rule', async () => {
      const mongoDb = await getMongoDbClient()
      const rulesEngineService = new UserManagementService(
        TEST_TENANT_ID,
        dynamoDb,
        mongoDb
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
    ])
    test('Verify business user with V8 user rule', async () => {
      const mongoDb = await getMongoDbClient()
      const rulesEngineService = new UserManagementService(
        TEST_TENANT_ID,
        dynamoDb,
        mongoDb
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
      })
    })
    test('Verify business user event with V8 user rule', async () => {
      const mongoDb = await getMongoDbClient()
      const rulesEngineService = new UserManagementService(
        TEST_TENANT_ID,
        dynamoDb,
        mongoDb
      )
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
        timestamp: Date.now(),
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
      })
    })
  })
})
describe('Verify user with V8 rule with aggregation variables', () => {
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
  test('Verify consumer user event with V8 user rule with aggregation variables', async () => {
    const mongoDb = await getMongoDbClient()
    const userRulesEngineService = new UserManagementService(
      TEST_TENANT_ID,
      dynamoDb,
      mongoDb
    )
    const user = getTestUser()
    const result1 = await userRulesEngineService.verifyUser(user, 'CONSUMER')
    expect(result1).toEqual({
      ...user,
      status: 'ALLOW',
      executedRules: [
        {
          isShadow: false,
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
    })
    const rulesEngineService = new RulesEngineService(
      TEST_TENANT_ID,
      dynamoDb,
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
    })
  })

  test('Verify business user event with V8 user rule with aggregation variables', async () => {
    const mongoDb = await getMongoDbClient()
    const userRulesEngineService = new UserManagementService(
      TEST_TENANT_ID,
      dynamoDb,
      mongoDb
    )
    const user = getTestBusiness()
    const result1 = await userRulesEngineService.verifyUser(user, 'BUSINESS')
    expect(result1).toEqual({
      ...user,
      status: 'ALLOW',
      executedRules: [
        {
          isShadow: false,
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
    })
    const rulesEngineService = new RulesEngineService(
      TEST_TENANT_ID,
      dynamoDb,
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
    })
  })
})
