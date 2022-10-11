import * as _ from 'lodash'
import dayjs from '@/utils/dayjs'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { DeviceData } from '@/@types/openapi-public/DeviceData'
import { ConsumerName } from '@/@types/openapi-public/ConsumerName'
import { UserType } from '@/@types/user/user-type'

export function isUserBetweenAge(
  user: User | Business | undefined,
  ageRange: { minAge?: number; maxAge?: number } | undefined
): boolean {
  const consumerUser = user as User
  const businessUser = user as Business // For typescript

  if (!user || !ageRange) {
    return true
  }
  if (isConsumerUser(user)) {
    if (!consumerUser.userDetails?.dateOfBirth) {
      return true
    }
    const age = dayjs().diff(
      dayjs(consumerUser.userDetails.dateOfBirth),
      'year'
    )
    return _.inRange(age, ageRange.minAge || 0, ageRange.maxAge || 200)
  } else {
    if (
      !businessUser.legalEntity?.companyRegistrationDetails?.dateOfRegistration
    ) {
      return true
    }
    const age = dayjs().diff(
      dayjs(
        businessUser.legalEntity?.companyRegistrationDetails?.dateOfRegistration
      ),
      'year'
    )
    return _.inRange(age, ageRange.minAge || 0, ageRange.maxAge || 1000)
  }
}

export function isConsumerUser(user: User | Business) {
  return (user as User).userDetails !== undefined
}

export function isBusinessUser(user: User | Business) {
  return !isConsumerUser(user)
}

export function getConsumerName(
  name: ConsumerName,
  ignoreMiddlename?: boolean
): string {
  if (name !== undefined) {
    if (ignoreMiddlename === true) {
      return name.firstName + ' ' + name.lastName
    }
    return name.firstName + ' ' + name.middleName + ' ' + name.lastName
  }
  return ' '
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

export function isUserType(
  user: User | Business | undefined,
  userType: UserType | undefined
) {
  if (!userType) {
    return true
  }
  if (!user) {
    return false
  }
  if (userType === 'CONSUMER') {
    return isConsumerUser(user)
  }
  return isBusinessUser(user)
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
