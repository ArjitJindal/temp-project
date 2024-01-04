import {
  CONSUMER_USER_CREATION_AGE_DAYS,
  CONSUMER_USER_CREATION_AGE_MONTHS,
  CONSUMER_USER_CREATION_AGE_YEARS,
} from '../user-creation-age'
import dayjs from '@/utils/dayjs'
import { getTestUser } from '@/test-utils/user-test-utils'

test('User creation age in days', async () => {
  const user = getTestUser({
    createdTimestamp: dayjs().subtract(5, 'day').valueOf(),
    userDetails: {
      name: {
        firstName: 'John',
        lastName: 'Doe',
      },
    },
  })
  const age = await CONSUMER_USER_CREATION_AGE_DAYS.load(user)

  expect(age).toBe(5)
})

test('User creation age in months', async () => {
  const user = getTestUser({
    createdTimestamp: dayjs().subtract(5, 'month').valueOf(),
    userDetails: {
      name: {
        firstName: 'John',
        lastName: 'Doe',
      },
    },
  })
  const age = await CONSUMER_USER_CREATION_AGE_MONTHS.load(user)
  expect(age).toBe(5)
})

test('User creation age in yexars', async () => {
  const user = getTestUser({
    createdTimestamp: dayjs().subtract(5, 'year').valueOf(),
    userDetails: {
      name: {
        firstName: 'John',
        lastName: 'Doe',
      },
    },
  })
  const age = await CONSUMER_USER_CREATION_AGE_YEARS.load(user)

  expect(age).toBe(5)
})
