import dayjs from 'dayjs'
import _ from 'lodash'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'

export function isUserBetweenAge(
  user: User,
  ageRange: { minAge: number; maxAge: number }
): boolean | undefined {
  if (!user.userDetails.dateOfBirth) {
    return undefined
  }
  const { day, month, year } = user.userDetails.dateOfBirth
  const age = dayjs().diff(dayjs(new Date(year, month, day)), 'year')
  return _.inRange(age, ageRange.minAge, ageRange.maxAge)
}

export function isConsumerUser(user: User | Business) {
  return (user as User).userDetails !== undefined
}

export function isBusinessUser(user: User | Business) {
  return !isConsumerUser(user)
}
