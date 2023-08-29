import * as _ from 'lodash'
import { inRange } from 'lodash'
import dayjs from '@/utils/dayjs'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { DeviceData } from '@/@types/openapi-public/DeviceData'
import { getOriginIpAddress } from '@/utils/ipAddress'

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
    return inRange(age, ageRange.minAge || 0, ageRange.maxAge || 200)
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
    return inRange(age, ageRange.minAge || 0, ageRange.maxAge || 1000)
  }
}

export function isConsumerUser(user: User | Business) {
  return !isBusinessUser(user)
}

export function isBusinessUser(user: User | Business) {
  return (user as Business).legalEntity !== undefined
}

export function isIpAddressInList(
  deviceData: DeviceData | undefined,
  ipAddresses: string[] | undefined
) {
  if (!ipAddresses || ipAddresses.length === 0) {
    return true
  }

  const ipAddress = getOriginIpAddress(deviceData)

  return deviceData && ipAddress ? ipAddresses.includes(ipAddress) : false
}
