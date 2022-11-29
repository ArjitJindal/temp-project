import { JSONSchemaType } from 'ajv'
import _ from 'lodash'
import { COUNTRIES_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { UserRuleFilter } from './filter'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { expandCountryGroup } from '@/utils/countries'

export type UserCountryOfResidenceRuleFilterParameter = {
  userResidenceCountries?: string[]
}

export class UserCountryOfResidenceRuleFilter extends UserRuleFilter<UserCountryOfResidenceRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<UserCountryOfResidenceRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        userResidenceCountries: COUNTRIES_OPTIONAL_SCHEMA({
          title: 'Residence Countries',
        }),
      },
    }
  }
  public async predicate(): Promise<boolean> {
    return this.isUserCountry(this.user)
  }

  private isUserCountry(user: User | Business | undefined): boolean {
    let { userResidenceCountries } = this.parameters
    if (!userResidenceCountries) {
      return true
    }
    const consumerUser = user as User
    const businessUser = user as Business // For typescript
    userResidenceCountries = expandCountryGroup(userResidenceCountries)
    return (
      (userResidenceCountries.some(
        (x) => x === consumerUser.userDetails?.countryOfResidence
      ) ||
        businessUser.shareHolders?.some((item) =>
          userResidenceCountries?.some(
            (x) => x === item.generalDetails?.countryOfResidence
          )
        ) ||
        businessUser.directors?.some((item) =>
          userResidenceCountries?.some(
            (x) => x === item.generalDetails.countryOfResidence
          )
        )) ??
      false
    )
  }
}
