import { JSONSchemaType } from 'ajv'
import { COUNTRIES_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { UserRuleFilter } from './filter'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { expandCountryGroup } from '@/utils/countries'

export type UserCountryOfNationalityRuleFilterParameter = {
  userNationalityCountries?: string[]
}

export class UserCountryOfNationalityRuleFilter extends UserRuleFilter<UserCountryOfNationalityRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<UserCountryOfNationalityRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        userNationalityCountries: COUNTRIES_OPTIONAL_SCHEMA({
          title: 'Nationality Countries',
          uiSchema: {
            group: 'geography',
          },
        }),
      },
    }
  }
  public async predicate(): Promise<boolean> {
    return this.isUserCountry(this.user)
  }

  private isUserCountry(user: User | Business | undefined): boolean {
    let { userNationalityCountries } = this.parameters
    if (!user || !userNationalityCountries) {
      return true
    }
    const consumerUser = user as User
    const businessUser = user as Business // For typescript

    userNationalityCountries = expandCountryGroup(userNationalityCountries)
    return (
      (userNationalityCountries.some(
        (x) => x === consumerUser.userDetails?.countryOfNationality
      ) ||
        businessUser.shareHolders?.some((item) =>
          userNationalityCountries?.some(
            (x) => x === item.generalDetails?.countryOfNationality
          )
        ) ||
        businessUser.directors?.some((item) =>
          userNationalityCountries?.some(
            (x) => x === item.generalDetails.countryOfNationality
          )
        )) ??
      false
    )
  }
}
