import { difference, uniq } from 'lodash'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { BusinessWithRulesResult } from '@/@types/openapi-internal/BusinessWithRulesResult'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'

const internalUserAttributes = InternalUser.getAttributeTypeMap().map(
  (v) => v.name
)
const businessUserAttributes =
  BusinessWithRulesResult.getAttributeTypeMap().map((v) => v.name)
const consumerUserAttributes = UserWithRulesResult.getAttributeTypeMap().map(
  (v) => v.name
)

export const INTERNAL_ONLY_USER_ATTRIBUTES = difference(
  internalUserAttributes,
  uniq(businessUserAttributes.concat(consumerUserAttributes))
)

export const DYNAMO_ONLY_USER_ATTRIBUTES = businessUserAttributes.concat(
  consumerUserAttributes
)
