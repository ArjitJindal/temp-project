import { jobRunnerHandler } from '@/lambdas/batch-job/app'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsConsumerUserRuleParameters } from '@/services/rules-engine/user-rules/sanctions-consumer-user'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import {
  MOCK_CA_SEARCH_NO_HIT_RESPONSE,
  MOCK_CA_SEARCH_RESPONSE,
} from '@/test-utils/resources/mock-ca-search-response'
import { setUpRulesHooks } from '@/test-utils/rule-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestUser, setUpUsersHooks } from '@/test-utils/user-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { OngoingScreeningUserRuleBatchJob } from '@/@types/batch-job'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { CaseCreationService } from '@/services/cases/case-creation-service'
import { RulesEngineService } from '@/services/rules-engine'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import dayjs from '@/utils/dayjs'

dynamoDbSetupHook()
withFeatureHook(['SANCTIONS'])

const TEST_SANCTIONS_HITS = ['Vladimir Putin']

jest.mock('@/services/sanctions', () => {
  return {
    SanctionsService: jest.fn().mockImplementation(() => {
      return {
        search: jest
          .fn()
          .mockImplementation((request: SanctionsSearchRequest) => {
            const rawComplyAdvantageResponse = TEST_SANCTIONS_HITS.includes(
              request.searchTerm
            )
              ? MOCK_CA_SEARCH_RESPONSE
              : MOCK_CA_SEARCH_NO_HIT_RESPONSE

            return {
              data: rawComplyAdvantageResponse.content.data.hits,
              searchId: 'test-search-id',
            }
          }),
      }
    }),
  }
})

describe('Batch Job Sanctions Screening Rule', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'R-16',
      defaultParameters: {
        screeningTypes: ['SANCTIONS'],
        fuzziness: 0.5,
        ongoingScreening: true,
      } as SanctionsConsumerUserRuleParameters,
    },
  ])

  const user1 = getTestUser({
    userId: 'user-1',
    userDetails: {
      name: {
        firstName: 'Vladimir',
        lastName: 'Putin',
      },
    },
  })

  const user2 = getTestUser({
    userId: 'user-2',
    userDetails: {
      name: {
        firstName: 'Aman',
        lastName: 'Dugar',
      },
    },
  })

  setUpUsersHooks(TEST_TENANT_ID, [user1, user2])

  it('should run screening rules', async () => {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()

    const userRepository = new UserRepository(TEST_TENANT_ID, {
      mongoDb,
      dynamoDb,
    })

    const testJob: OngoingScreeningUserRuleBatchJob = {
      tenantId: TEST_TENANT_ID,
      type: 'ONGOING_SCREENING_USER_RULE',
    }

    const spy = jest.spyOn(CaseCreationService.prototype, 'handleUser')

    await jobRunnerHandler(testJob)

    const user1After = await userRepository.getUser<UserWithRulesResult>(
      user1.userId
    )

    expect(spy).toBeCalledTimes(1)

    expect(user1After).toMatchObject({
      legalDocuments: [
        {
          documentIssuedDate: 1639939034000,
          documentExpirationDate: 1839939034000,
          documentType: 'passport',
          documentNumber: 'Z9431P',
          documentIssuedCountry: 'DE',
          tags: [
            {
              value: 'wallet',
              key: 'customerType',
            },
          ],
        },
      ],
      contactDetails: {
        emailIds: ['baran@flagright.com'],
        websites: ['flagright.com'],
        addresses: [
          {
            postcode: '10557',
            country: 'Germany',
            addressLines: ['Klara-Franke Str 20'],
            state: 'Berlin',
            city: 'Berlin',
            tags: [
              {
                value: 'customValue',
                key: 'customKey',
              },
            ],
          },
        ],
        contactNumbers: ['+37112345432'],
      },
      userDetails: {
        name: {
          firstName: 'Vladimir',
          lastName: 'Putin',
        },
      },
      tags: [
        {
          value: 'customValue',
          key: 'customKey',
        },
      ],
    })
    const user2After = await userRepository.getUser<UserWithRulesResult>(
      user2.userId
    )

    expect(user2After).toMatchObject({
      legalDocuments: [
        {
          documentIssuedDate: 1639939034000,
          documentExpirationDate: 1839939034000,
          documentType: 'passport',
          documentNumber: 'Z9431P',
          documentIssuedCountry: 'DE',
          tags: [
            {
              value: 'wallet',
              key: 'customerType',
            },
          ],
        },
      ],
      contactDetails: {
        emailIds: ['baran@flagright.com'],
        websites: ['flagright.com'],
        addresses: [
          {
            postcode: '10557',
            country: 'Germany',
            addressLines: ['Klara-Franke Str 20'],
            state: 'Berlin',
            city: 'Berlin',
            tags: [
              {
                value: 'customValue',
                key: 'customKey',
              },
            ],
          },
        ],
        contactNumbers: ['+37112345432'],
      },
      userDetails: {
        name: {
          firstName: 'Aman',
          lastName: 'Dugar',
        },
      },
      userId: 'user-2',
      tags: [
        {
          value: 'customValue',
          key: 'customKey',
        },
      ],
    })
  })
})

describe('Batch Job Sanctions Screening Rule Ongoing Screening is Off', () => {
  const TEST_TENANT_ID = 'test-tenant-id-2'

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'R-16',
      defaultParameters: {
        screeningTypes: ['SANCTIONS'],
        fuzziness: 0.5,
        ongoingScreening: false,
      } as SanctionsConsumerUserRuleParameters,
    },
  ])

  const user1 = getTestUser({
    userId: 'user-1',
    userDetails: {
      name: {
        firstName: 'Vladimir',
        lastName: 'Putin',
      },
    },
  })

  setUpUsersHooks(TEST_TENANT_ID, [user1])

  it('should not execute the rule', async () => {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()

    const userRepository = new UserRepository(TEST_TENANT_ID, {
      mongoDb,
      dynamoDb,
    })

    const testJob: OngoingScreeningUserRuleBatchJob = {
      tenantId: TEST_TENANT_ID,
      type: 'ONGOING_SCREENING_USER_RULE',
    }

    await jobRunnerHandler(testJob)

    const user1After = await userRepository.getUser<UserWithRulesResult>(
      user1.userId
    )

    expect(user1After).toMatchObject({
      legalDocuments: [
        {
          documentIssuedDate: 1639939034000,
          documentExpirationDate: 1839939034000,
          documentType: 'passport',
          documentNumber: 'Z9431P',
          documentIssuedCountry: 'DE',
          tags: [
            {
              value: 'wallet',
              key: 'customerType',
            },
          ],
        },
      ],
      contactDetails: {
        emailIds: ['baran@flagright.com'],
        websites: ['flagright.com'],
        addresses: [
          {
            postcode: '10557',
            country: 'Germany',
            addressLines: ['Klara-Franke Str 20'],
            state: 'Berlin',
            city: 'Berlin',
            tags: [
              {
                value: 'customValue',
                key: 'customKey',
              },
            ],
          },
        ],
        contactNumbers: ['+37112345432'],
      },
      userDetails: {
        name: {
          firstName: 'Vladimir',
          lastName: 'Putin',
        },
      },
      userId: 'user-1',
      tags: [
        {
          value: 'customValue',
          key: 'customKey',
        },
      ],
    })
  })
})

describe('V8 ongoing screening', () => {
  const TEST_TENANT_ID = getTestTenantId()
  const spy = jest.spyOn(RulesEngineService.prototype, 'verifyUserByRules')

  beforeEach(() => {
    spy.mockClear()
  })

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      ruleInstanceId: 'test-rule-instance-id',
      type: 'USER',
      userRuleRunCondition: {
        entityUpdated: false,
        schedule: { value: 1, unit: 'MONTH' },
      },
      createdAt: Date.now(),
    },
  ])

  const user = getTestUser()
  setUpUsersHooks(TEST_TENANT_ID, [user])

  it('should run on the same say when the rule is ', async () => {
    const testJob: OngoingScreeningUserRuleBatchJob = {
      tenantId: TEST_TENANT_ID,
      type: 'ONGOING_SCREENING_USER_RULE',
    }
    await jobRunnerHandler(testJob)
    expect(spy).toBeCalledTimes(1)
  })
  it('should only run once every x time units', async () => {
    const dynamoDb = getDynamoDbClient()
    const ruleInstanceRepository = new RuleInstanceRepository(TEST_TENANT_ID, {
      dynamoDb,
    })
    const ruleInstance = (await ruleInstanceRepository.getRuleInstanceById(
      'test-rule-instance-id'
    )) as RuleInstance
    await ruleInstanceRepository.createOrUpdateRuleInstance({
      ...ruleInstance,
      createdAt: dayjs().add(1, 'month').valueOf(),
    })
    const testJob: OngoingScreeningUserRuleBatchJob = {
      tenantId: TEST_TENANT_ID,
      type: 'ONGOING_SCREENING_USER_RULE',
    }
    await jobRunnerHandler(testJob)
    expect(spy).toBeCalledTimes(1)
  })
  it('should not run in other days', async () => {
    const dynamoDb = getDynamoDbClient()
    const ruleInstanceRepository = new RuleInstanceRepository(TEST_TENANT_ID, {
      dynamoDb,
    })
    const ruleInstance = (await ruleInstanceRepository.getRuleInstanceById(
      'test-rule-instance-id'
    )) as RuleInstance
    await ruleInstanceRepository.createOrUpdateRuleInstance({
      ...ruleInstance,
      createdAt: dayjs().add(1, 'month').add(1, 'day').valueOf(),
    })
    const testJob: OngoingScreeningUserRuleBatchJob = {
      tenantId: TEST_TENANT_ID,
      type: 'ONGOING_SCREENING_USER_RULE',
    }
    await jobRunnerHandler(testJob)
    expect(spy).toBeCalledTimes(0)
  })
})
