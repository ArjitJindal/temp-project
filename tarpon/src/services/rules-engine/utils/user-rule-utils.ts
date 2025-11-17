import { MINUTE_GROUP_SIZE } from '@flagright/lib/constants'
import groupBy from 'lodash/groupBy'
import { isV8RuleInstance } from '../utils'
import { UserFilters } from '../filters'
import {
  AuxiliaryIndexUserEvent,
  RulesEngineUserRepositoryInterface,
  UserEventAttributes,
} from '../repositories/user-repository-interface'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import dayjs from '@/utils/dayjs'
import { LogicAggregationTimeWindowGranularity } from '@/@types/openapi-internal/LogicAggregationTimeWindowGranularity'
import { zipGenerators } from '@/utils/generator'
import { UserRuleStage } from '@/@types/openapi-internal/UserRuleStage'

export function isConsumerUser(user: User | Business): user is User {
  return !isBusinessUser(user)
}

export function isBusinessUser(user: User | Business): user is Business {
  return (user as Business).legalEntity !== undefined
}

export async function groupUsersByGranularity<T>(
  userEvents: AuxiliaryIndexUserEvent[],
  aggregator: (userEvents: AuxiliaryIndexUserEvent[]) => Promise<T>,
  granularity: LogicAggregationTimeWindowGranularity
): Promise<{ [timeKey: string]: T }> {
  return groupUsers(
    userEvents,
    (userEvent) =>
      getUserStatsTimeGroupLabel(userEvent.timestamp ?? 0, granularity),
    aggregator
  )
}

export async function groupUsers<T>(
  userEvents: AuxiliaryIndexUserEvent[],
  iteratee: (userEvents: AuxiliaryIndexUserEvent) => string,
  aggregator: (userEvents: AuxiliaryIndexUserEvent[]) => Promise<T>
): Promise<{ [timeKey: string]: T }> {
  const groups = groupBy(userEvents, iteratee)
  const newGroups: { [key: string]: T } = {}
  for (const group in groups) {
    newGroups[group] = await aggregator(groups[group])
  }
  return newGroups
}

export async function* getUserEventsGenerator(
  userId: string | undefined,
  // to change TODO
  userRepository: RulesEngineUserRepositoryInterface,
  options: {
    afterTimestamp: number
    beforeTimestamp: number
    filters: UserFilters
  },
  attributesToFetch: Array<UserEventAttributes>,
  isConsumer: boolean
): AsyncGenerator<{
  userEvents: AuxiliaryIndexUserEvent[]
}> {
  const { beforeTimestamp, afterTimestamp, filters } = options
  const usersGenerator = userRepository.getGenericUserEventsGenerator(
    userId,
    {
      afterTimestamp,
      beforeTimestamp,
    },
    {
      userCreationAgeRange: filters.userCreationAgeRange,
      userType: filters.userType,
      userAgeRange: filters.userAgeRange,
      userIds: filters.userIds,
      userResidenceCountries: filters.userResidenceCountries,
      userNationalityCountries: filters.userNationalityCountries,
      userRegistrationCountries: filters.userRegistrationCountries,
      acquisitionChannels: filters.acquisitionChannels,
    },
    attributesToFetch as Array<UserEventAttributes>,
    isConsumer
  )

  for await (const data of zipGenerators(usersGenerator, usersGenerator, [])) {
    yield {
      userEvents: data[0],
    }
  }
}

export function isOngoingUserRuleInstance(
  ruleInstance: RuleInstance,
  isRiskLevelsEnabled: boolean
) {
  const schedule = ruleInstance.userRuleRunCondition?.schedule
  if (schedule) {
    return true
  }

  const checkForOngoing = (parameters: {
    ongoingScreening?: boolean
    ruleStages?: UserRuleStage[]
  }) =>
    Boolean(
      parameters?.ongoingScreening ||
        parameters?.ruleStages?.includes('ONGOING')
    )

  if (isRiskLevelsEnabled && ruleInstance.riskLevelParameters) {
    return Boolean(
      Object.values(ruleInstance.riskLevelParameters).find(checkForOngoing)
    )
  }
  return checkForOngoing(ruleInstance.parameters)
}

export function getUserStatsTimeGroupLabel(
  timestamp: number,
  timeGranularity: LogicAggregationTimeWindowGranularity
): string {
  switch (timeGranularity) {
    case 'minute': {
      const date = dayjs(timestamp)
      const minuteGroup = Math.floor(date.minute() / MINUTE_GROUP_SIZE)
      return dayjs(timestamp).format('YYYY-MM-DD-HH') + `-${minuteGroup}`
    }
    case 'day':
      return dayjs(timestamp).format('YYYY-MM-DD')
    case 'week': {
      const time = dayjs(timestamp)
      return `${time.format('YYYY')}-W${time.week()}`
    }
    case 'month':
      return dayjs(timestamp).format('YYYY-MM')
    case 'year':
      return dayjs(timestamp).format('YYYY')
    default:
      return dayjs(timestamp).format('YYYY-MM-DD-HH')
  }
}

export function isRuleInstanceUpdateOrOnboarding(
  ruleInstance: RuleInstance,
  stage: UserRuleStage,
  isRiskLevelsEnabled: boolean
) {
  const checkForUpdatedEntity = (parameters: {
    ongoingScreening?: boolean
    ruleStages?: UserRuleStage[]
  }) => {
    return Boolean(
      (isV8RuleInstance(ruleInstance) &&
        ruleInstance.userRuleRunCondition?.entityUpdated !== false) ||
        (!isV8RuleInstance(ruleInstance) &&
          (parameters?.ruleStages == null ||
            parameters.ruleStages.includes(stage)))
    )
  }

  if (isRiskLevelsEnabled && ruleInstance.riskLevelParameters) {
    return Boolean(
      Object.values(ruleInstance.riskLevelParameters).find(
        checkForUpdatedEntity
      )
    )
  }
  return checkForUpdatedEntity(ruleInstance.parameters)
}

export const RuleIdsFor314AConsumer = ['R-42']
export const RuleIdsFor314ABusiness = ['R-43']
export const RuleIdsFor314A: string[] = [
  ...RuleIdsFor314AConsumer,
  ...RuleIdsFor314ABusiness,
]
export const ListSubTypesFor314A = ['314A_INDIVIDUAL', '314A_BUSINESS']
