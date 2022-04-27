import AccountAccessEventRule from './account-access-event'
import { UserRule } from './rule'

export const USER_RULES = {
  'account-access-event': AccountAccessEventRule,
} as unknown as { [key: string]: typeof UserRule }
