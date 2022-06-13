import dayjs from 'dayjs'
import { AccountAccessEventRuleParameters } from '../account-access-event'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import {
  setUpRulesHooks,
  createUserRuleTestCase,
  UserRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestUserEvent } from '@/test-utils/user-event-test-utils'
import {
  getTestUser,
  setUpConsumerUsersHooks,
} from '@/test-utils/user-test-utils'

dynamoDbSetupHook()

describe('Core logic', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'USER',
      ruleImplementationName: 'account-access-event',
      defaultParameters: {
        accessThreshold: 1,
        timeWindowInSeconds: 86400,
        ipAddressesToCheck: ['1.1.1.1'],
        userIdsToCheck: ['1-1', '1-3', '1-4', '1-5'],
      } as AccountAccessEventRuleParameters,
    },
  ])
  setUpConsumerUsersHooks(TEST_TENANT_ID, [
    getTestUser({ userId: '1-1' }),
    getTestUser({ userId: '1-2' }),
  ])

  describe.each<UserRuleTestCase>([
    {
      name: 'Too frequent account access - hit',
      userEvents: [
        getTestUserEvent({
          userId: '1-1',
          type: 'LOGGED_IN',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          metaData: { ipAddress: '1.1.1.1' },
        }),
        getTestUserEvent({
          userId: '1-1',
          type: 'LOGGED_IN',
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
          metaData: { ipAddress: '1.1.1.1' },
        }),
        getTestUserEvent({
          userId: '1-1',
          type: 'LOGGED_IN',
          timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
          metaData: { ipAddress: '1.1.1.1' },
        }),
      ],
      expectedHits: [false, true, false],
    },
    {
      name: 'Too frequent account access (not target user) - not hit',
      userEvents: [
        getTestUserEvent({
          userId: '1-2',
          type: 'LOGGED_IN',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          metaData: { ipAddress: '1.1.1.1' },
        }),
        getTestUserEvent({
          userId: '1-2',
          type: 'LOGGED_IN',
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
          metaData: { ipAddress: '1.1.1.1' },
        }),
      ],
      expectedHits: [false, false],
    },
    {
      name: 'Too frequent account access (not target ip) - not hit',
      userEvents: [
        getTestUserEvent({
          userId: '1-3',
          type: 'LOGGED_IN',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          metaData: { ipAddress: '2.2.2.2' },
        }),
        getTestUserEvent({
          userId: '1-3',
          type: 'LOGGED_IN',
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
          metaData: { ipAddress: '2.2.2.2' },
        }),
      ],
      expectedHits: [false, false],
    },
    {
      name: 'Too frequent account access (mixed IPs) - not hit',
      userEvents: [
        getTestUserEvent({
          userId: '1-4',
          type: 'LOGGED_IN',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          metaData: { ipAddress: '1.1.1.1' },
        }),
        getTestUserEvent({
          userId: '1-4',
          type: 'LOGGED_IN',
          timestamp: dayjs('2022-01-01T03:00:00.000Z').valueOf(),
          metaData: { ipAddress: '1.1.1.2' },
        }),
        getTestUserEvent({
          userId: '1-4',
          type: 'LOGGED_IN',
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
          metaData: { ipAddress: '1.1.1.2' },
        }),
        getTestUserEvent({
          userId: '1-4',
          type: 'LOGGED_IN',
          timestamp: dayjs('2022-01-02T00:00:00.000Z').valueOf(),
          metaData: { ipAddress: '1.1.1.1' },
        }),
      ],
      expectedHits: [false, false, false, false],
    },
    {
      name: 'Normal account access - not hit',
      userEvents: [
        getTestUserEvent({
          userId: '1-5',
          type: 'LOGGED_IN',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          metaData: { ipAddress: '1.1.1.1' },
        }),
        getTestUserEvent({
          userId: '1-5',
          type: 'LOGGED_IN',
          timestamp: dayjs('2022-01-02T00:00:00.000Z').valueOf(),
          metaData: { ipAddress: '1.1.1.1' },
        }),
      ],
      expectedHits: [false, false],
    },
  ])('', ({ name, userEvents, expectedHits }) => {
    createUserRuleTestCase(name, TEST_TENANT_ID, userEvents, expectedHits)
  })
})
