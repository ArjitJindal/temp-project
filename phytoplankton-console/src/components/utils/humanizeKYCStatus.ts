import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { KYCStatus } from '@/apis';
import { TenantSettings } from '@/apis/models/TenantSettings';

export function humanizeKYCStatus(
  state: KYCStatus,
  kycStatusAlias?: TenantSettings['kycStatusAlias'],
): string {
  if (kycStatusAlias) {
    const alias = kycStatusAlias?.find((item) => item.state === state)?.alias;
    if (alias) {
      return alias;
    }
  }
  if (state === 'EDD_IN_PROGRESS') {
    return 'EDD in progress';
  }
  return humanizeAuto(state);
}
