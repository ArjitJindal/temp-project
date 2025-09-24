import compact from 'lodash/compact'
import { COUNTRIES_SCHEMA } from '../utils/rule-parameter-schemas'
import { RuleHitResult } from '../rule'
import { isConsumerUser } from '../utils/user-rule-utils'
import { UserRule } from './rule'
import { CountryCode } from '@/@types/openapi-internal/CountryCode'
import { User } from '@/@types/openapi-internal/User'
import { Business } from '@/@types/openapi-internal/Business'

type ChecksFor = 'nationality' | 'residence' | 'registration'

export type UserOnboardedFromHighRiskCountryRuleParameters = {
  checksFor: Array<ChecksFor>
  highRiskCountries: Array<CountryCode>
}

export default class UserOnboardedFromHighRiskCountry extends UserRule<UserOnboardedFromHighRiskCountryRuleParameters> {
  public static getSchema() {
    return {
      type: 'object',
      properties: {
        checksFor: {
          type: 'array',
          title: 'Checks for',
          description: 'The checks to be performed for high risk countries',
          items: {
            type: 'string',
            enum: ['nationality', 'residence', 'registration'],
            enumNames: [
              'Country of nationality',
              'Country of residence',
              'Business registration country',
            ],
          },
        },
        highRiskCountries: COUNTRIES_SCHEMA({
          title: 'High risk countries',
          description: 'The list of high risk countries',
        }),
      },
      required: ['checksFor', 'highRiskCountries'],
      additionalProperties: false,
    }
  }

  public async computeRule() {
    const { checksFor, highRiskCountries } = this.parameters
    const user = this.user
    const countries: Array<CountryCode> = []

    if (isConsumerUser(user)) {
      const consumerUser = user as User
      const countryOfNationality =
        consumerUser?.userDetails?.countryOfNationality
      const countryOfResidence = consumerUser?.userDetails?.countryOfResidence

      if (countryOfNationality && checksFor.includes('nationality')) {
        countries.push(countryOfNationality)
      }

      if (countryOfResidence && checksFor.includes('residence')) {
        countries.push(countryOfResidence)
      }
    } else {
      const businessUser = user as Business
      const businessRegistrationCountry =
        businessUser.legalEntity.companyRegistrationDetails?.registrationCountry

      const shareHoldersCountriesOfNationality = compact(
        businessUser?.shareHolders?.map(
          (shareHolder) => shareHolder.generalDetails.countryOfNationality
        )
      )
      const shareHoldersResidenceCountries = compact(
        businessUser?.shareHolders?.map(
          (shareHolder) => shareHolder.generalDetails.countryOfResidence
        )
      )

      const directorsCountriesOfNationality = compact(
        businessUser?.directors?.map(
          (director) => director.generalDetails.countryOfNationality
        ) ?? []
      )

      const directorsCountriesOfResidence =
        compact(
          businessUser?.directors?.map(
            (shareHolder) => shareHolder.generalDetails.countryOfResidence
          )
        ) ?? []

      if (businessRegistrationCountry && checksFor.includes('registration')) {
        countries.push(businessRegistrationCountry)
      }

      if (checksFor.includes('nationality')) {
        countries.push(
          ...shareHoldersCountriesOfNationality,
          ...directorsCountriesOfNationality
        )
      }

      if (checksFor.includes('residence')) {
        countries.push(
          ...directorsCountriesOfResidence,
          ...shareHoldersResidenceCountries
        )
      }
    }

    const countriesSet = new Set(countries)
    const hitResult: RuleHitResult = []

    for (const country of highRiskCountries) {
      if (countriesSet.has(country)) {
        hitResult.push({ direction: 'ORIGIN', vars: this.getUserVars() })
        break
      }
    }

    return hitResult
  }
}
