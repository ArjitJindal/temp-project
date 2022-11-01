import { UserRuleFilter } from './filter'
import UserCreationAgeRuleFilter, {
  UserCreationAgeRuleFilterParameter,
} from './user-creation-age'
import UserAgeRuleFilter, { UserAgeRuleFilterParameter } from './user-age'
import UserTypeRuleFilter, { UserTypeRuleFilterParameter } from './user-type'
import WhitelistUsersRuleFilter, {
  WhitelistUsersRuleFilterParameter,
} from './whitelist-users'

export type UserFilterKeys =
  | keyof WhitelistUsersRuleFilterParameter
  | keyof UserCreationAgeRuleFilterParameter
  | keyof UserTypeRuleFilterParameter
  | keyof UserAgeRuleFilterParameter

export type UserFilters = WhitelistUsersRuleFilterParameter &
  UserCreationAgeRuleFilterParameter &
  UserTypeRuleFilterParameter &
  UserAgeRuleFilterParameter

const _USER_FILTERS = new Map<UserFilterKeys, any>([
  ['whitelistUsers', WhitelistUsersRuleFilter],
  ['userCreationAgeRange', UserCreationAgeRuleFilter],
  ['userAgeRange', UserAgeRuleFilter],
  ['userType', UserTypeRuleFilter],
])

export const USER_FILTERS = Object.fromEntries(_USER_FILTERS) as {
  [key: string]: typeof UserRuleFilter
}
