import _ from 'lodash'
import { getAgeFromTimestamp, getAgeInDaysFromTimestamp } from '../utils'
import {
  TransactionRiskFactorValueHandler,
  UserRiskFactorValueHandler,
} from '.'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-internal/Business'
import { ParameterAttributeRiskValuesParameterEnum } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import dayjs from '@/utils/dayjs'

function getDerivedAge(
  user: User | Business,
  parameter: ParameterAttributeRiskValuesParameterEnum,
  granularity = 'YEAR'
): number | undefined {
  const endValue = _.get(user, parameter)
  if (!endValue) {
    return
  }
  return granularity === 'YEAR'
    ? getAgeFromTimestamp(dayjs(endValue).valueOf())
    : getAgeInDaysFromTimestamp(dayjs(endValue).valueOf())
}

export const KRS_USER_AGE_RISK_HANDLERS: Array<
  UserRiskFactorValueHandler<number>
> = [
  {
    entityType: 'BUSINESS',
    parameter: 'legalEntity.companyRegistrationDetails.dateOfRegistration',
    handler: async (user, parameter) => [
      getDerivedAge(user, parameter, 'YEAR'),
    ],
  },
  {
    entityType: 'CONSUMER_USER',
    parameter: 'userDetails.dateOfBirth',
    handler: async (user, parameter) => [
      getDerivedAge(user, parameter, 'YEAR'),
    ],
  },
]

export const ARS_USER_AGE_RISK_HANDLERS: Array<
  TransactionRiskFactorValueHandler<number>
> = [
  {
    entityType: 'TRANSACTION',
    parameter: 'createdTimestamp',
    handler: async (_transaction, users, parameter) =>
      [users.originUser, users.destinationUser]
        .filter(Boolean)
        .map((user) => getDerivedAge(user as User, parameter, 'DAY')),
  },
]
