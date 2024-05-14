import { nanoid } from 'nanoid'
import { MerchantMonitoringIndustryUserRuleParameters } from '../merchant-monitoring-industry'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  UserRuleTestCase,
  createUserRuleTestCase,
  setUpRulesHooks,
} from '@/test-utils/rule-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestBusiness, getTestUser } from '@/test-utils/user-test-utils'
import dayjs from '@/utils/dayjs'
import { MERCHANT_MONITORING_DATA_COLLECTION } from '@/utils/mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'

const tenantId = getTestTenantId()
const userId1 = nanoid()
const userId2 = nanoid()
const userId3 = nanoid()

const merchantMonitoringCollectionName =
  MERCHANT_MONITORING_DATA_COLLECTION(tenantId)

const exampleDate = new Date('2021-01-01T00:00:00.000Z')

dynamoDbSetupHook()

beforeAll(async () => {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()

  await db.collection(merchantMonitoringCollectionName).insertMany([
    {
      source: { sourceType: 'COMPANIES_HOUSE' },
      userId: userId1,
      industry: 'Technology',
      updatedAt: dayjs(exampleDate).valueOf(),
    },
    {
      source: { sourceType: 'COMPANIES_HOUSE' },
      userId: userId1,
      industry: 'Consulting',
      updatedAt: dayjs(exampleDate)
        .subtract(1, 'day')
        .subtract(1, 'hour')
        .valueOf(),
    },
  ])
})

afterAll(async () => {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()

  await db.collection(merchantMonitoringCollectionName).deleteMany({
    userId: { $in: [userId1, userId2] },
  })
})

describe.each<UserRuleTestCase>([
  {
    name: 'Should not flag user if merchant industry has not changed',
    users: [
      getTestBusiness({
        userId: userId2,
      }),
    ],
    expectetRuleHitMetadata: [undefined],
  },
  {
    name: 'Should flag user if merchant industry has changed',
    users: [
      getTestBusiness({
        userId: userId1,
      }),
    ],
    expectetRuleHitMetadata: [
      {
        hitDirections: ['ORIGIN'],
        isOngoingScreeningHit: true,
      },
    ],
    expectedRuleDescriptions: [
      'Business industry for user has changed on COMPANIES_HOUSE.',
    ],
  },
  {
    name: 'Does not run for consumer users',
    users: [
      getTestUser({
        userId: userId3,
      }),
    ],
    expectetRuleHitMetadata: [undefined],
  },
])(
  'Merchant Monitoring Industry User Rule',
  ({ name, users, expectetRuleHitMetadata, expectedRuleDescriptions }) => {
    setUpRulesHooks(tenantId, [
      {
        id: 'R-17',
        defaultParameters: {
          sourceType: ['COMPANIES_HOUSE'],
        } as MerchantMonitoringIndustryUserRuleParameters,
      },
    ])
    createUserRuleTestCase(
      name,
      tenantId,
      users,
      expectetRuleHitMetadata,
      expectedRuleDescriptions,
      true
    )
  }
)
