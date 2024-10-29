import { compact, get } from 'lodash'
import { getAgeFromTimestamp, getAgeInDaysFromTimestamp } from '../utils'
import {
  TransactionRiskFactorValueHandler,
  UserRiskFactorValueHandler,
} from '.'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-internal/Business'
import { ParameterAttributeRiskValuesParameterEnum } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import dayjs from '@/utils/dayjs'
import {
  isBusinessUser,
  isConsumerUser,
} from '@/services/rules-engine/utils/user-rule-utils'

function getDerivedAge(
  user: User | Business,
  parameter: ParameterAttributeRiskValuesParameterEnum | 'createdTimestamp',
  granularity = 'YEAR'
): number | undefined {
  const endValue = get(user, parameter)
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
    parameter: 'consumerCreatedTimestamp',
    handler: async (_transaction, users) =>
      compact([users.originUser, users.destinationUser])
        .filter((user) => isConsumerUser(user))
        .map((user) => getDerivedAge(user as User, 'createdTimestamp', 'DAY')),
  },
  {
    entityType: 'TRANSACTION',
    parameter: 'businessCreatedTimestamp',
    handler: async (_transaction, users) =>
      compact([users.originUser, users.destinationUser])
        .filter((user) => isBusinessUser(user))
        .map((user) =>
          getDerivedAge(user as Business, 'createdTimestamp', 'DAY')
        ),
  },
]
