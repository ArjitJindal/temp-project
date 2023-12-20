import { lowerCase } from 'lodash'
import { NumberFieldSettings } from '@react-awesome-query-builder/core'
import { UserRuleVariable } from './types'
import { AgeConfig } from './common'
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

const createAgeVariable = (
  config: AgeConfig,
  key: string
): UserRuleVariable<number | undefined> => ({
  key,
  entity: 'USER',
  uiDefinition: {
    label: `User age on platform: (${lowerCase(config.label)})`,
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

export const USER_CREATION_AGE_DAYS = createAgeVariable(
  { label: 'Days', unit: 'days' },
  'userCreationAgeDays'
)
export const USER_CREATION_AGE_MONTHS = createAgeVariable(
  { label: 'Months', unit: 'months' },
  'userCreationAgeMonths'
)
export const USER_CREATION_AGE_YEARS = createAgeVariable(
  { label: 'Years', unit: 'years' },
  'userCreationAgeYears'
)
