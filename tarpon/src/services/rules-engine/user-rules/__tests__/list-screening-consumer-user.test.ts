import { getTestUser } from '@/test-utils/user-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import {
  setUpRulesHooks,
  createUserRuleTestCase,
  UserRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { ListRepository } from '@/services/list/repositories/list-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { ListScreeningConsumerUserRuleParameters } from '@/services/rules-engine/user-rules/list-screening-consumer-user'

dynamoDbSetupHook()

describe('Core logic', () => {
  const TEST_TENANT_ID = getTestTenantId()
  const listId = 'L-1'
  beforeAll(async () => {
    const listRepository = new ListRepository(
      TEST_TENANT_ID,
      getDynamoDbClient()
    )
    await listRepository.createList(
      'BLACKLIST',
      'STRING',
      {
        items: [
          {
            key: 'Vladimir Putin',
            metadata: {
              reason: '',
            },
          },
        ],
      },
      listId
    )
  })

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'R-19',
      defaultParameters: {
        screeningTypes: ['SANCTIONS'],
        fuzzinessRange: {
          lowerBound: 0,
          upperBound: 30,
        },
        listId,
        ongoingScreening: false,
      } as ListScreeningConsumerUserRuleParameters,
    },
  ])

  describe.each<UserRuleTestCase>([
    {
      name: '',
      users: [
        getTestUser({}),
        getTestUser({
          userDetails: {
            name: {
              firstName: 'Bar',
              lastName: 'Foo',
            },
          },
        }),
        getTestUser({
          userDetails: {
            name: {
              firstName: 'Vladimir',
              lastName: 'Putin',
            },
          },
        }),
        getTestUser({
          userDetails: {
            name: {
              firstName: 'Vladr',
              lastName: 'Putin',
            },
          },
        }),
      ],
      expectetRuleHitMetadata: [
        undefined,
        undefined,
        {
          hitDirections: ['ORIGIN'],
          sanctionsDetails: [
            {
              name: 'Vladimir Putin',
              entityType: 'CONSUMER_NAME',
              searchId: expect.any(String),
              hitContext: expect.any(Object),
            },
          ],
        },
        {
          hitDirections: ['ORIGIN'],
          sanctionsDetails: [
            {
              name: 'Vladr Putin',
              entityType: 'CONSUMER_NAME',
              searchId: expect.any(String),
              hitContext: expect.any(Object),
            },
          ],
        },
      ],
    },
  ])('', ({ name, users, expectetRuleHitMetadata }) => {
    createUserRuleTestCase(name, TEST_TENANT_ID, users, expectetRuleHitMetadata)
  })
})

describe('Matching on document ID', () => {
  const TEST_TENANT_ID = getTestTenantId()
  const listId = 'L-1'
  beforeAll(async () => {
    const listRepository = new ListRepository(
      TEST_TENANT_ID,
      getDynamoDbClient()
    )
    await listRepository.createList(
      'BLACKLIST',
      'STRING',
      {
        items: [
          {
            key: 'Vladimir Putin',
            metadata: {
              reason: '123456',
            },
          },
        ],
      },
      listId
    )
  })

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'R-19',
      defaultParameters: {
        screeningTypes: ['SANCTIONS'],
        fuzzinessRange: {
          lowerBound: 0,
          upperBound: 30,
        },
        screeningValues: ['NRIC'],
        listId,
        ongoingScreening: false,
      } as ListScreeningConsumerUserRuleParameters,
    },
  ])

  describe.each<UserRuleTestCase>([
    {
      name: '',
      users: [
        getTestUser({
          userDetails: {
            name: {
              firstName: 'Vladimir',
              lastName: 'Putin',
            },
          },
          legalDocuments: [
            {
              documentType: 'passport',
              documentNumber: '123456',
              documentIssuedCountry: 'AF',
            },
          ],
        }),
        getTestUser({
          userDetails: {
            name: {
              firstName: 'Vladimir',
              lastName: 'Putin',
            },
          },
          legalDocuments: [
            {
              documentType: 'passport',
              documentNumber: '111111',
              documentIssuedCountry: 'AF',
            },
          ],
        }),
        getTestUser({
          userDetails: {
            name: {
              firstName: 'Vladimir',
              lastName: 'Putin',
            },
          },
          legalDocuments: [
            {
              documentType: 'passport',
              documentNumber: '111111',
              documentIssuedCountry: 'AF',
            },
            {
              documentType: 'passport',
              documentNumber: '123456',
              documentIssuedCountry: 'AF',
            },
          ],
        }),
      ],
      expectetRuleHitMetadata: [
        {
          hitDirections: ['ORIGIN'],
          sanctionsDetails: [
            {
              name: 'Vladimir Putin',
              entityType: 'CONSUMER_NAME',
              searchId: expect.any(String),
              hitContext: expect.any(Object),
            },
          ],
        },
        undefined,
        {
          hitDirections: ['ORIGIN'],
          sanctionsDetails: [
            {
              name: 'Vladimir Putin',
              entityType: 'CONSUMER_NAME',
              searchId: expect.any(String),
              hitContext: expect.any(Object),
            },
          ],
        },
      ],
    },
  ])('', ({ name, users, expectetRuleHitMetadata }) => {
    createUserRuleTestCase(name, TEST_TENANT_ID, users, expectetRuleHitMetadata)
  })
})
