import { TransactionRiskFactorValueHandler } from '.'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-internal/Business'
import {
  isConsumerUser,
  isBusinessUser,
} from '@/services/rules-engine/utils/user-rule-utils'

function getCountryDerivedRiskLevel(
  transactionCountry: string | undefined,
  user: User | Business
) {
  const userCountry = isConsumerUser(user)
    ? (user as User).userDetails?.countryOfResidence
    : (user as Business).legalEntity.companyRegistrationDetails
        ?.registrationCountry
  return transactionCountry && userCountry && transactionCountry === userCountry
    ? 'DOMESTIC'
    : 'FOREIGN'
}

export const ARS_DOMESTIC_FOREIGN_COUNTRY_RISK_HANDLERS: Array<
  TransactionRiskFactorValueHandler<'DOMESTIC' | 'FOREIGN'>
> = [
  {
    entityType: 'TRANSACTION',
    parameter: 'domesticOrForeignOriginCountryConsumer',
    handler: async (transaction, users) => {
      return users.originUser && isConsumerUser(users.originUser)
        ? [
            getCountryDerivedRiskLevel(
              transaction.originAmountDetails?.country,
              users.originUser
            ),
          ]
        : []
    },
  },
  {
    entityType: 'TRANSACTION',
    parameter: 'domesticOrForeignOriginCountryBusiness',
    handler: async (transaction, users) => {
      return users.originUser && isBusinessUser(users.originUser)
        ? [
            getCountryDerivedRiskLevel(
              transaction.originAmountDetails?.country,
              users.originUser
            ),
          ]
        : []
    },
  },
  {
    entityType: 'TRANSACTION',
    parameter: 'domesticOrForeignDestinationCountryConsumer',
    handler: async (transaction, users) => {
      return users.destinationUser && isConsumerUser(users.destinationUser)
        ? [
            getCountryDerivedRiskLevel(
              transaction.destinationAmountDetails?.country,
              users.destinationUser
            ),
          ]
        : []
    },
  },
  {
    entityType: 'TRANSACTION',
    parameter: 'domesticOrForeignDestinationCountryBusiness',
    handler: async (transaction, users) => {
      return users.destinationUser && isBusinessUser(users.destinationUser)
        ? [
            getCountryDerivedRiskLevel(
              transaction.destinationAmountDetails?.country,
              users.destinationUser
            ),
          ]
        : []
    },
  },
]
