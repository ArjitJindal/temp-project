import {
  CONSUMER_USER_AGE_DAYS,
  CONSUMER_USER_AGE_MONTHS,
  CONSUMER_USER_AGE_YEARS,
} from '../user-age'
import dayjs from '@/utils/dayjs'
import { getTestUser } from '@/test-utils/user-test-utils'

test('User age in days', async () => {
  const user = getTestUser({
    userDetails: {
      name: {
        firstName: 'John',
        lastName: 'Doe',
      },
      dateOfBirth: dayjs().subtract(5, 'days').toISOString(),
    },
  })
  const age = await CONSUMER_USER_AGE_DAYS.load(user)

  expect(age).toBe(5)
})

test('User age in months', async () => {
  const user = getTestUser({
    userDetails: {
      name: {
        firstName: 'John',
        lastName: 'Doe',
      },
      dateOfBirth: dayjs().subtract(5, 'months').toISOString(),
    },
  })
  const age = await CONSUMER_USER_AGE_MONTHS.load(user)

  expect(age).toBe(5)
})

test('User age in years', async () => {
  const user = getTestUser({
    userDetails: {
      name: {
        firstName: 'John',
        lastName: 'Doe',
      },
      dateOfBirth: dayjs().subtract(5, 'years').toISOString(),
    },
  })
  const age = await CONSUMER_USER_AGE_YEARS.load(user)

  expect(age).toBe(5)
})
