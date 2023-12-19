import { lowerCase } from 'lodash'
import { NumberFieldSettings } from '@react-awesome-query-builder/core'
import { isConsumerUser, isBusinessUser } from '../utils/user-rule-utils'
import { UserRuleVariable } from './types'
import { User } from '@/@types/openapi-internal/User'
import { Business } from '@/@types/openapi-internal/Business'
import dayjs from '@/utils/dayjs'

interface AgeConfig {
  label: string
  unit: 'days' | 'months' | 'years'
}

const calculateAge = (
  user: User | Business,
  unit: 'days' | 'months' | 'years'
): number | undefined => {
  const consumerUser = user as User
  const businessUser = user as Business

  const userDetails = isConsumerUser(user) ? consumerUser.userDetails : null
  const registrationDate = isBusinessUser(user)
    ? businessUser.legalEntity?.companyRegistrationDetails?.dateOfRegistration
    : null

  if (userDetails?.dateOfBirth) {
    return dayjs().diff(dayjs(userDetails.dateOfBirth), unit)
  }

  if (registrationDate) {
    return dayjs().diff(dayjs(registrationDate), unit)
  }

  return
}

const createAgeVariable = (
  config: AgeConfig,
  key: string
): UserRuleVariable<number | undefined> => ({
  key,
  entity: 'USER',
  uiDefinition: {
    label: `user age (${lowerCase(config.label)})`,
    type: 'number',
    preferWidgets: ['slider', 'rangeslider'],
    valueSources: ['value', 'field', 'func'],
    fieldSettings: {
      min: 0,
      max: 120,
      step: 1,
      marks: {
        0: '0',
        120: '120',
      },
    } as NumberFieldSettings,
  },
  load: async (user: User | Business) => calculateAge(user, config.unit),
})

export const USER_AGE_DAYS = createAgeVariable(
  { label: 'Days', unit: 'days' },
  'userAgeDays'
)
export const USER_AGE_MONTHS = createAgeVariable(
  { label: 'Months', unit: 'months' },
  'userAgeMonths'
)
export const USER_AGE_YEARS = createAgeVariable(
  { label: 'Years', unit: 'years' },
  'userAgeYears'
)
