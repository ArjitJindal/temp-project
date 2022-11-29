import { JSONSchemaType } from 'ajv'
import _ from 'lodash'
import { COUNTRIES_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { UserRuleFilter } from './filter'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { expandCountryGroup } from '@/utils/countries'

export type UserCountryOfRegistrationRuleFilterParameter = {
  userRegistrationCountries?: string[]
}

export class UserCountryOfRegistrationRuleFilter extends UserRuleFilter<UserCountryOfRegistrationRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<UserCountryOfRegistrationRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        userRegistrationCountries: COUNTRIES_OPTIONAL_SCHEMA({
          title: 'Registration Countries',
        }),
      },
    }
  }
  public async predicate(): Promise<boolean> {
    return this.isUserCountry(this.user)
  }

  private isUserCountry(user: User | Business | undefined): boolean {
    let { userRegistrationCountries } = this.parameters
    if (!user || !userRegistrationCountries) {
      return true
    }
    const businessUser = user as Business // For typescript
    if (businessUser && !businessUser.legalEntity) {
      return true
    }
    userRegistrationCountries = expandCountryGroup(userRegistrationCountries)
    return userRegistrationCountries.some(
      (x) =>
        x ===
        businessUser.legalEntity.companyRegistrationDetails?.registrationCountry
    )
  }
}
