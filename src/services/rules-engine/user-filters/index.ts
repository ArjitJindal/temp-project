import { UserRuleFilter } from './filter'
import UserCreationAgeRuleFilter, {
  UserCreationAgeRuleFilterParameter,
} from './user-creation-age'
import WhitelistUsersRuleFilter, {
  WhitelistUsersRuleFilterParameter,
} from './whitelist-users'

export type UserFilterKeys =
  | keyof WhitelistUsersRuleFilterParameter
  | keyof UserCreationAgeRuleFilterParameter

const _USER_FILTERS = new Map<UserFilterKeys, any>([
  ['whitelistUsers', WhitelistUsersRuleFilter],
  ['userCreationAgeRange', UserCreationAgeRuleFilter],
])

export const USER_FILTERS = Object.fromEntries(_USER_FILTERS) as {
  [key: string]: typeof UserRuleFilter
}
