import { UserRuleFilter } from './filter'
import UserCreationAgeRuleFilter, {
  UserCreationAgeRuleFilterParameter,
} from './user-creation-age'
import UserAgeRuleFilter, { UserAgeRuleFilterParameter } from './user-age'
import UserCountryOfResidenceRuleFilter, {
  UserCountryOfResidenceRuleFilterParameter,
} from './user-country-of-residence'
import UserTypeRuleFilter, { UserTypeRuleFilterParameter } from './user-type'
import WhitelistUsersRuleFilter, {
  WhitelistUsersRuleFilterParameter,
} from './whitelist-users'
import UserCountryOfNationalityRuleFilter, {
  UserCountryOfNationalityRuleFilterParameter,
} from './user-country-of-nationality'
import UserCountryOfRegistrationRuleFilter, {
  UserCountryOfRegistrationRuleFilterParameter,
} from './user-country-of-registration'

export type UserFilterKeys =
  | keyof WhitelistUsersRuleFilterParameter
  | keyof UserCreationAgeRuleFilterParameter
  | keyof UserTypeRuleFilterParameter
  | keyof UserAgeRuleFilterParameter
  | keyof UserCountryOfResidenceRuleFilterParameter
  | keyof UserCountryOfNationalityRuleFilterParameter
  | keyof UserCountryOfRegistrationRuleFilterParameter

export type UserFilters = WhitelistUsersRuleFilterParameter &
  UserCreationAgeRuleFilterParameter &
  UserTypeRuleFilterParameter &
  UserAgeRuleFilterParameter &
  UserCountryOfResidenceRuleFilterParameter &
  UserCountryOfNationalityRuleFilterParameter &
  UserCountryOfRegistrationRuleFilterParameter

const _USER_FILTERS = new Map<UserFilterKeys, any>([
  ['whitelistUsers', WhitelistUsersRuleFilter],
  ['userCreationAgeRange', UserCreationAgeRuleFilter],
  ['userAgeRange', UserAgeRuleFilter],
  ['userType', UserTypeRuleFilter],
  ['userResidenceCountries', UserCountryOfResidenceRuleFilter],
  ['userNationalityCountries', UserCountryOfNationalityRuleFilter],
  ['userRegistrationCountries', UserCountryOfRegistrationRuleFilter],
])

export const USER_FILTERS = Object.fromEntries(_USER_FILTERS) as {
  [key: string]: typeof UserRuleFilter
}
