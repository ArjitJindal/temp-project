import isEmpty from 'lodash/isEmpty'
import { TimeRange } from '../../repositories/user-repository-interface'
import { UserCreationAgeRange } from '../../utils/rule-parameter-schemas'
import dayjs from '@/utils/dayjs'

type Age = {
  units: number
  granularity: 'day' | 'month' | 'year'
}

export const userCreationTimeRangeRuleFilterPredicate = (
  userCreationTimestamp: number,
  userCreationTimeRange?: UserCreationAgeRange
) => {
  if (!userCreationTimeRange || isEmpty(userCreationTimeRange)) {
    return true
  }
  const minAge = userCreationTimeRange.minAge
  const maxAge = userCreationTimeRange.maxAge
  const minAgeInMs = minAge?.granularity ? getAgeInMs(minAge) : 0
  const maxAgeInMs = maxAge?.granularity ? getAgeInMs(maxAge) : 0
  const userCreationAgeInMs = dayjs().diff(dayjs(userCreationTimestamp), 'ms')
  return userCreationAgeInMs >= minAgeInMs && userCreationAgeInMs <= maxAgeInMs
}

export const userEventTimeRangeRuleFilterPredicate = (
  userEventTimestamp: number,
  userEventTimeRange?: TimeRange
) => {
  if (!userEventTimeRange || isEmpty(userEventTimeRange)) {
    return true
  }
  const startTime = userEventTimeRange.afterTimestamp
  const endTime = userEventTimeRange.beforeTimestamp
  return startTime <= userEventTimestamp && userEventTimestamp <= endTime
}

// TODO: move to utils
function getAgeInMs(age: Age): number {
  const { units, granularity } = age
  return dayjs().diff(dayjs().subtract(units, granularity), 'ms')
}
