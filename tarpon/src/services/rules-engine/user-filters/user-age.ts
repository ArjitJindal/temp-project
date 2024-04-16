import { JSONSchemaType } from 'ajv'

import { inRange } from 'lodash'
import { AGE_RANGE_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { isConsumerUser } from '../utils/user-rule-utils'
import { UserRuleFilter } from './filter'
import dayjs, { duration } from '@/utils/dayjs'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'

type Age = {
  units: number
  granularity: 'day' | 'month' | 'year'
}

export type UserAgeRuleFilterParameter = {
  userAgeRange?: {
    minAge?: Age
    maxAge?: Age
  }
}

export class UserAgeRuleFilter extends UserRuleFilter<UserAgeRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<UserAgeRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        userAgeRange: AGE_RANGE_OPTIONAL_SCHEMA({
          title: 'Target age range',
          description:
            'When users of a transaction are within this age range, the rule is run',
          uiSchema: {
            group: 'user',
          },
        }),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    return this.isUserBetweenAge(this.user)
  }

  private isUserBetweenAge(user: User | Business): boolean {
    const consumerUser = user as User
    const businessUser = user as Business // For typescript

    let ageInMs = 0
    if (isConsumerUser(user) && consumerUser.userDetails?.dateOfBirth) {
      ageInMs = dayjs().diff(dayjs(consumerUser.userDetails.dateOfBirth), 'ms')
    } else if (
      businessUser.legalEntity?.companyRegistrationDetails?.dateOfRegistration
    ) {
      ageInMs = dayjs().diff(
        dayjs(
          businessUser.legalEntity?.companyRegistrationDetails
            ?.dateOfRegistration
        ),
        'ms'
      )
    }
    const { minAge, maxAge } = this.parameters.userAgeRange ?? {}
    return inRange(
      ageInMs,
      minAge?.granularity && minAge?.units ? this.getAgeInMs(minAge) : 0,
      maxAge?.granularity && maxAge?.units
        ? this.getAgeInMs(maxAge)
        : Number.MAX_SAFE_INTEGER
    )
  }

  private getAgeInMs(age: Age): number {
    return duration(age.units, age.granularity).asMilliseconds()
  }
}
