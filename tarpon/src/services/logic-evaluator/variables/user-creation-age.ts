import {
  FieldOrGroup,
  NumberFieldSettings,
} from '@react-awesome-query-builder/core'
import { BusinessUserLogicVariable, ConsumerUserLogicVariable } from './types'
import { AgeUnit } from './user-age'
import { User } from '@/@types/openapi-internal/User'
import { Business } from '@/@types/openapi-internal/Business'
import dayjs from '@/utils/dayjs'

const calculateAge = (
  user: User | Business,
  unit: 'days' | 'months' | 'years'
): number | undefined => {
  const createdTimestamp = user.createdTimestamp
  return dayjs().diff(dayjs(createdTimestamp), unit)
}

const getUiDefinition = (unit: AgeUnit): FieldOrGroup => ({
  label: `age on platform (${unit})`,
  type: 'number',
  valueSources: ['value', 'field', 'func'],
  fieldSettings: {
    min: 0,
    step: 1,
  } as NumberFieldSettings,
})

const createConsumerCreationAgeVariable = (
  key: string,
  unit: AgeUnit
): ConsumerUserLogicVariable<number | undefined> => ({
  key,
  entity: 'CONSUMER_USER',
  valueType: 'number',
  uiDefinition: getUiDefinition(unit),
  load: async (user: User) => calculateAge(user, unit),
})
const createBusinessCreationAgeVariable = (
  key: string,
  unit: AgeUnit
): BusinessUserLogicVariable<number | undefined> => ({
  key,
  entity: 'BUSINESS_USER',
  valueType: 'number',
  uiDefinition: getUiDefinition(unit),
  load: async (user: User) => calculateAge(user, unit),
})

export const CONSUMER_USER_CREATION_AGE_DAYS =
  createConsumerCreationAgeVariable('creationAgeDays', 'days')
export const CONSUMER_USER_CREATION_AGE_MONTHS =
  createConsumerCreationAgeVariable('creationAgeMonths', 'months')
export const CONSUMER_USER_CREATION_AGE_YEARS =
  createConsumerCreationAgeVariable('creationAgeYears', 'years')
export const BUSINESS_USER_CREATION_AGE_DAYS =
  createBusinessCreationAgeVariable('creationAgeDays', 'days')
export const BUSINESS_USER_CREATION_AGE_MONTHS =
  createBusinessCreationAgeVariable('creationAgeMonths', 'months')
export const BUSINESS_USER_CREATION_AGE_YEARS =
  createBusinessCreationAgeVariable('creationAgeYears', 'years')
