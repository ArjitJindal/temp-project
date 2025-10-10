import { JSONSchemaType } from 'ajv'
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
          title: 'Registration countries',
          uiSchema: {
            group: 'geography',
          },
        }),
      },
    }
  }
  public async predicate(): Promise<boolean> {
    if (process.env.__INTERNAL_ENBALE_RULES_ENGINE_V8__) {
      return await this.v8Runner()
    }
    return this.isUserCountry(this.user)
  }

  private isUserCountry(user: User | Business): boolean {
    const businessUser = user as Business // For typescript
    if (businessUser && !businessUser.legalEntity) {
      return false
    }
    const userRegistrationCountries = expandCountryGroup(
      this.parameters.userRegistrationCountries ?? []
    )
    return userRegistrationCountries.some(
      (x) =>
        x ===
        businessUser.legalEntity.companyRegistrationDetails?.registrationCountry
    )
  }
}
