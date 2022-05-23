import dayjs from 'dayjs'
import * as _ from 'lodash'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { DeviceData } from '@/@types/openapi-public/DeviceData'

export function isUserBetweenAge(
  user: User | Business | undefined,
  ageRange: { minAge: number; maxAge: number } | undefined
): boolean {
  const consumerUser = user as User
  if (
    !user ||
    !isConsumerUser(user) ||
    !ageRange ||
    !consumerUser.userDetails?.dateOfBirth
  ) {
    return true
  }
  const age = dayjs().diff(dayjs(consumerUser.userDetails.dateOfBirth), 'year')
  return _.inRange(age, ageRange.minAge, ageRange.maxAge)
}

export function isConsumerUser(user: User | Business) {
  return (user as User).userDetails !== undefined
}

export function isBusinessUser(user: User | Business) {
  return !isConsumerUser(user)
}

export function isUserInList(
  user: User | Business | undefined,
  userIds: string[] | undefined
) {
  if (!userIds || userIds.length === 0) {
    return true
  }
  return !user || userIds.includes(user.userId)
}

export function isIpAddressInList(
  deviceData: DeviceData | undefined,
  ipAddresses: string[] | undefined
) {
  if (!ipAddresses || ipAddresses.length === 0) {
    return true
  }
  return deviceData && deviceData.ipAddress
    ? ipAddresses.includes(deviceData.ipAddress)
    : false
}
