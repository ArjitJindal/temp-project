import { JSONSchemaType } from 'ajv'

import { inRange } from 'lodash'
import { AGE_RANGE_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { UserRuleFilter } from './filter'
import dayjs, { duration } from '@/utils/dayjs'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'

type Age = {
  units: number
  granularity: 'day' | 'month' | 'year'
}

export type UserCreationAgeRuleFilterParameter = {
  userCreationAgeRange?: {
    minAge?: Age
    maxAge?: Age
  }
}

export class UserCreationAgeRuleFilter extends UserRuleFilter<UserCreationAgeRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<UserCreationAgeRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        userCreationAgeRange: AGE_RANGE_OPTIONAL_SCHEMA({
          title: '{{UserAlias}} creation age range',
          description:
            '{{UserAlias}} creation age is calculated by "NOW - createdTimestamp of a {{userAlias}}"',
          uiSchema: {
            group: 'user',
            defaultGranularity: 'day',
          },
        }),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    if (process.env.__INTERNAL_ENBALE_RULES_ENGINE_V8__) {
      return await this.v8Runner()
    }
    return this.isUserBetweenAge(this.user)
  }

  private isUserBetweenAge(user: User | Business): boolean {
    const { minAge, maxAge } = this.parameters.userCreationAgeRange ?? {}
    const creationAgeInMs = dayjs().diff(dayjs(user.createdTimestamp), 'ms')
    return inRange(
      creationAgeInMs,
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
