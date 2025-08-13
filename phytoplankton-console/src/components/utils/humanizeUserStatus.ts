import { humanizeConstant } from '@flagright/lib/utils/humanize';
import { UserState } from '@/apis/models/UserState';
import { TenantSettings } from '@/apis/models/TenantSettings';

export function humanizeUserStatus(
  state: UserState,
  userStateAlias: TenantSettings['userStateAlias'],
): string {
  const alias = userStateAlias?.find((item) => item.state === state)?.alias;
  if (alias) {
    return alias;
  }
  return humanizeConstant(state);
}
