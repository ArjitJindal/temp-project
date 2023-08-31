import * as _ from 'lodash'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'

export function isConsumerUser(user: User | Business) {
  return !isBusinessUser(user)
}

export function isBusinessUser(user: User | Business) {
  return (user as Business).legalEntity !== undefined
}
