import { jobRunnerHandler } from '@/lambdas/batch-job/app'
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
import { SanctionsService } from '@/services/sanctions'
import { RulesEngineService } from '@/services/rules-engine'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import dayjs from '@/utils/dayjs'
import {
  DELTA_SANCTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { preprocessUsers } from '@/services/batch-jobs/ongoing-screening-user-rule-batch-job-runner'

dynamoDbSetupHook()
withFeatureHook(['SANCTIONS'])

const MIDDLE_OF_JUNE = '2024-06-15T12:00:00.000Z'
const END_OF_JUNE = '2024-06-30T12:00:00.000Z'
const END_OF_JULY = '2024-07-30T12:00:00.000Z'

const TEST_SANCTIONS_HITS = ['Vladimir Putin']

const fakeTimers = jest.useFakeTimers({
  advanceTimers: true,
  doNotFake: ['performance'],
})

fakeTimers.setSystemTime(new Date(MIDDLE_OF_JUNE))

jest.mock('@/services/sanctions', () => {
  type SanctionsServiceInstanceType = InstanceType<typeof SanctionsService>
  return {
    SanctionsService: jest.fn().mockImplementation(() => {
      type SearchMethodType = SanctionsServiceInstanceType['search']
      return {
        search: jest
          .fn()
          .mockImplementation(
            async (
              ...params: Parameters<SearchMethodType>
            ): ReturnType<SearchMethodType> => {
              const [request] = params
              const rawComplyAdvantageResponse = TEST_SANCTIONS_HITS.includes(
                request.searchTerm
              )
                ? MOCK_CA_SEARCH_RESPONSE
                : MOCK_CA_SEARCH_NO_HIT_RESPONSE

              return {
                hitsCount: rawComplyAdvantageResponse.content.data.hits.length,
                searchId: 'test-search-id',
                providerSearchId: 'test-provider-search-id',
                createdAt: 1683301138980,
              }
            }
          ),
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
        fuzziness: 50,
        screeningTypes: ['SANCTIONS'],
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

  beforeEach(() => {
    fakeTimers.setSystemTime(new Date(MIDDLE_OF_JUNE))
  })

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

  beforeEach(() => {
    fakeTimers.setSystemTime(new Date(MIDDLE_OF_JUNE))
  })

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'R-16',
      defaultParameters: {
        screeningTypes: ['SANCTIONS'],
        fuzziness: 50,
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

  describe.each<string>([MIDDLE_OF_JUNE, END_OF_JULY])(
    'when today is %s',
    (today) => {
      it('should not run in other days', async () => {
        fakeTimers.setSystemTime(new Date(today))
        const dynamoDb = getDynamoDbClient()
        const ruleInstanceRepository = new RuleInstanceRepository(
          TEST_TENANT_ID,
          {
            dynamoDb,
          }
        )
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
    }
  )

  it('should run if rule created on the end of month and next month have more days', async () => {
    fakeTimers.setSystemTime(new Date(END_OF_JUNE))
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
    expect(spy).toBeCalledTimes(1)
  })
})

describe('preprocessUsers', () => {
  it('should match users based on name similarity and document IDs', async () => {
    const tenantId = getTestTenantId()
    const client = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const sanctionsCollection = client
      .db()
      .collection(DELTA_SANCTIONS_COLLECTION(tenantId))
    const usersCollection = client.db().collection(USERS_COLLECTION(tenantId))

    // Seed sanctions data
    await sanctionsCollection.insertMany([
      {
        id: 's1',
        name: 'John Doe',
        aka: ['Jonathan Doe'],
        documents: [{ id: 'doc1', formattedId: 'doc001' }],
        provider: 'comply-advantage',
      },
      {
        id: 's2',
        name: 'Jane Smith',
        aka: [],
        documents: [{ id: 'doc2' }],
        provider: 'comply-advantage',
      },
    ])

    // Seed users data
    await usersCollection.insertMany([
      {
        userId: 'u1',
        legalDocuments: [{ documentNumber: 'doc001' }],
        username: 'Jon Doe',
      },
      {
        userId: 'u2',
        legalDocuments: [{ documentNumber: 'doc3' }],
        username: 'Jane Smithy',
      },
      {
        userId: 'u3',
        legalDocuments: [{ documentNumber: 'doc2' }],
        username: 'Mary Johnson',
      },
    ])

    const result = await preprocessUsers(tenantId, client, dynamoDb)

    expect(result).toEqual(new Set(['u1', 'u3']))
  })

  it.skip('should return an empty set if no matches are found', async () => {
    // TODO: enable atlas in github actions
    const tenantId = getTestTenantId()
    const client = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const sanctionsCollection = client
      .db()
      .collection(DELTA_SANCTIONS_COLLECTION(tenantId))
    const usersCollection = client.db().collection(USERS_COLLECTION(tenantId))

    // Seed sanctions data
    await sanctionsCollection.insertMany([
      {
        id: 's1',
        name: 'Nonexistent Name',
        aka: [],
        documents: [],
      },
    ])

    // Seed users data
    await usersCollection.insertMany([
      {
        userId: 'u1',
        legalDocuments: [],
        username: 'Another User',
      },
    ])

    const result = await preprocessUsers(tenantId, client, dynamoDb)

    expect(result).toEqual(new Set())
  })
})
