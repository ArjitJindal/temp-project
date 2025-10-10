import {
  FieldOrGroup,
  NumberFieldSettings,
} from '@react-awesome-query-builder/core'
import { BusinessUserLogicVariable, ConsumerUserLogicVariable } from './types'
import { User } from '@/@types/openapi-internal/User'
import { Business } from '@/@types/openapi-internal/Business'
import dayjs from '@/utils/dayjs'
import {
  isBusinessUser,
  isConsumerUser,
} from '@/services/rules-engine/utils/user-rule-utils'

export type AgeUnit = 'days' | 'months' | 'years'

const calculateConsumerUserAge = (
  user: User,
  unit: 'days' | 'months' | 'years'
): number | undefined => {
  if (!isConsumerUser(user)) {
    return
  }
  if (user.userDetails?.dateOfBirth) {
    return dayjs().diff(dayjs(user.userDetails.dateOfBirth), unit)
  }
}
const calculateBusinessUserAge = (
  user: Business,
  unit: 'days' | 'months' | 'years'
): number | undefined => {
  if (!isBusinessUser(user)) {
    return
  }
  const registrationDate =
    user.legalEntity?.companyRegistrationDetails?.dateOfRegistration
  if (registrationDate) {
    return dayjs().diff(dayjs(registrationDate), unit)
  }
}

const MAX_AGE = 120
const getUiDefinition = (unit: AgeUnit): FieldOrGroup => ({
  label: `age (${unit})`,
  type: 'number',
  valueSources: ['value', 'field', 'func'],
  fieldSettings: {
    min: 0,
    max:
      unit === 'years'
        ? MAX_AGE
        : unit === 'months'
        ? 12 * MAX_AGE
        : 365 * MAX_AGE,
    step: 1,
  } as NumberFieldSettings,
})

const createConsumerAgeVariable = (
  key: string,
  unit: AgeUnit
): ConsumerUserLogicVariable<number | undefined> => ({
  key,
  entity: 'CONSUMER_USER',
  valueType: 'number',
  uiDefinition: getUiDefinition(unit),
  load: async (user: User) => calculateConsumerUserAge(user, unit),
})
const createBusinessAgeVariable = (
  key: string,
  unit: AgeUnit
): BusinessUserLogicVariable<number | undefined> => ({
  key,
  entity: 'BUSINESS_USER',
  valueType: 'number',
  uiDefinition: getUiDefinition(unit),
  load: async (user: Business) => calculateBusinessUserAge(user, unit),
})

export const CONSUMER_USER_AGE_DAYS = createConsumerAgeVariable(
  'ageDays',
  'days'
)
export const CONSUMER_USER_AGE_MONTHS = createConsumerAgeVariable(
  'ageMonths',
  'months'
)
export const CONSUMER_USER_AGE_YEARS = createConsumerAgeVariable(
  'ageYears',
  'years'
)
export const BUSINESS_USER_AGE_DAYS = createBusinessAgeVariable(
  'ageDays',
  'days'
)
export const BUSINESS_USER_AGE_MONTHS = createBusinessAgeVariable(
  'ageMonths',
  'months'
)
export const BUSINESS_USER_AGE_YEARS = createBusinessAgeVariable(
  'ageYears',
  'years'
)
