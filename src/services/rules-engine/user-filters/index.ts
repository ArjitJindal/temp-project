import { UserRuleFilter } from './filter'
import WhitelistUsersRuleFilter from './whitelist-users'

export type UserFilterKeys = keyof WhitelistUsersRuleFilter

export const USER_FILTERS = {
  whitelistUsers: WhitelistUsersRuleFilter,
} as unknown as { [key: string]: typeof UserRuleFilter }
