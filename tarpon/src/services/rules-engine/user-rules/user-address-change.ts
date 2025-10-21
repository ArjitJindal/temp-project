import { JSONSchemaType } from 'ajv'
import isEqual from 'lodash/isEqual'
import xorWith from 'lodash/xorWith'
import isEmpty from 'lodash/isEmpty'
import { isBusinessUser } from '../utils/user-rule-utils'
import { RuleHitResult } from '../rule'
import { UserRule } from './rule'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'

export interface UserAddressChangeRuleParameters {} // eslint-disable-line @typescript-eslint/no-empty-interface

export default class UserAddressChange extends UserRule<UserAddressChangeRuleParameters> {
  public static getSchema(): JSONSchemaType<UserAddressChangeRuleParameters> {
    return {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    }
  }

  public async computeRule() {
    const user = this.user
    const userRepository = new UserRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const isBusiness = isBusinessUser(user)

    const userData = isBusiness
      ? await userRepository.getBusinessUser(user.userId)
      : await userRepository.getConsumerUser(user.userId)

    if (!userData) {
      return
    }

    const userAddressExisting = isBusiness
      ? (userData as Business).legalEntity?.contactDetails?.addresses
      : (userData as User).contactDetails?.addresses

    const userAddressNew = isBusiness
      ? (user as Business).legalEntity?.contactDetails?.addresses
      : (user as User).contactDetails?.addresses

    const areSame = isEmpty(
      xorWith(userAddressExisting, userAddressNew, isEqual)
    )

    const ruleHit: RuleHitResult = []

    if (!areSame) {
      ruleHit.push({
        direction: 'ORIGIN',
        vars: this.getUserVars(),
      })
    }

    return {
      ruleHitResult: ruleHit,
    }
  }
}
